const cds = require('@sap/cds')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { loadSuppliersData, initializeMaterialsData } = require('./data-loader')
require('dotenv').config()

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
console.log('Gemini API Key loaded:', GEMINI_API_KEY ? 'Yes' : 'No')
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// Chat sessions storage (in production, use proper database)
const chatSessions = new Map()

module.exports = class ProcurementService extends cds.ApplicationService {
  async init() {

  const { Suppliers, Materials, PurchaseOrders, PurchaseOrderItems } = this.entities

  // Add business logic for suppliers
  this.after('each', 'Suppliers', supplier => {
    // Add computed fields or business logic
    if (supplier.rating >= 4.5) {
      supplier.isPreferred = true
    }
  })

  // Add business logic for materials - check stock levels
  this.after('each', 'Materials', material => {
    if (material.quantity <= material.minStockLevel) {
      material.stockStatus = 'Low Stock'
    } else if (material.quantity >= material.maxStockLevel) {
      material.stockStatus = 'Overstock'
    } else {
      material.stockStatus = 'Normal'
    }
  })

  // Phase 3: Warehouse Management Action Handlers

  // OData CRUD Handlers for Materials
  this.before('CREATE', 'Materials', async (req) => {
    // Handle supplier field - if it's a string, store it as supplier_ID
    if (req.data.supplier && typeof req.data.supplier === 'string') {
      req.data.supplier_ID = req.data.supplier;
      delete req.data.supplier;
    }
  });

  this.before('UPDATE', 'Materials', async (req) => {
    // Handle supplier field - if it's a string, store it as supplier_ID
    if (req.data.supplier && typeof req.data.supplier === 'string') {
      req.data.supplier_ID = req.data.supplier;
      delete req.data.supplier;
    }
  });

  // DELETE handler for Materials
  this.before('DELETE', 'Materials', async (req) => {
    console.log('Deleting material with ID:', req.params[0]);
  });

  this.after('DELETE', 'Materials', async (req) => {
    console.log('Material deleted successfully');
  });

  // Add Material Action
  this.on('addMaterial', async (req) => {
    const { ID, name, supplier, quantity, category, unitPrice, currency, unit, description, location } = req.data

    try {
      // Check if material ID already exists
      const existing = await SELECT.one.from(Materials).where({ ID })
      if (existing) {
        return { success: false, message: `Material with ID ${ID} already exists` }
      }

      // Insert new material
      await INSERT.into(Materials).entries({
        ID,
        name,
        supplier_ID: supplier,
        quantity,
        category: category || 'General',
        unitPrice: unitPrice || 0,
        currency_code: currency || 'USD',
        unit: unit || 'pcs',
        description: description || '',
        location: location || 'Warehouse A',
        isActive: true,
        lastUpdated: new Date().toISOString()
      })

      return { success: true, message: `Material ${name} added successfully` }
    } catch (error) {
      console.error('Error adding material:', error)
      return { success: false, message: 'Failed to add material: ' + error.message }
    }
  })

  // Update Material Quantity Action
  this.on('updateMaterialQuantity', async (req) => {
    const { materialID, newQuantity } = req.data

    try {
      const result = await UPDATE(Materials)
        .set({
          quantity: newQuantity,
          lastUpdated: new Date().toISOString()
        })
        .where({ ID: materialID })

      if (result === 0) {
        return { success: false, message: `Material with ID ${materialID} not found` }
      }

      return { success: true, message: `Material quantity updated to ${newQuantity}` }
    } catch (error) {
      console.error('Error updating material quantity:', error)
      return { success: false, message: 'Failed to update quantity: ' + error.message }
    }
  })

  // Import Materials from CSV Action
  this.on('importMaterialsFromCSV', async (req) => {
    const { csvData } = req.data

    try {
      const lines = csvData.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      let imported = 0
      const errors = []

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim())
          const material = {}

          headers.forEach((header, index) => {
            material[header] = values[index]
          })

          // Validate required fields
          if (!material.ID || !material.name || !material.supplier_ID) {
            errors.push(`Line ${i + 1}: Missing required fields (ID, name, supplier_ID)`)
            continue
          }

          // Check if material already exists
          const existing = await SELECT.one.from(Materials).where({ ID: material.ID })
          if (existing) {
            errors.push(`Line ${i + 1}: Material ${material.ID} already exists`)
            continue
          }

          // Insert material
          await INSERT.into(Materials).entries({
            ID: material.ID,
            name: material.name,
            supplier_ID: material.supplier_ID,
            quantity: parseInt(material.quantity) || 0,
            category: material.category || 'General',
            unitPrice: parseFloat(material.unitPrice) || 0,
            currency_code: material.currency_code || 'USD',
            unit: material.unit || 'pcs',
            description: material.description || '',
            location: material.location || 'Warehouse A',
            isActive: true,
            lastUpdated: new Date().toISOString()
          })

          imported++
        } catch (lineError) {
          errors.push(`Line ${i + 1}: ${lineError.message}`)
        }
      }

      return { success: true, imported, errors }
    } catch (error) {
      console.error('Error importing CSV:', error)
      return { success: false, imported: 0, errors: [error.message] }
    }
  })

  // Export Materials to CSV Action
  this.on('exportMaterialsToCSV', async (req) => {
    try {
      const materials = await SELECT.from(Materials)

      const headers = ['ID', 'name', 'supplier_ID', 'quantity', 'category', 'unitPrice', 'currency_code', 'unit', 'description', 'location']
      let csvData = headers.join(',') + '\n'

      materials.forEach(material => {
        const row = headers.map(header => material[header] || '').join(',')
        csvData += row + '\n'
      })

      return { csvData }
    } catch (error) {
      console.error('Error exporting CSV:', error)
      return { csvData: '' }
    }
  })

  // Create Purchase Order action
  this.on('createPurchaseOrder', async req => {
    const { supplier, items } = req.data

    // Validate supplier exists
    const supplierData = await SELECT.one.from(Suppliers, supplier)
    if (!supplierData) return req.error(404, `Supplier #${supplier} doesn't exist`)

    // Generate order number
    const orderNumber = `PO-${Date.now()}`

    // Calculate total amount
    let totalAmount = 0
    items.forEach(item => {
      totalAmount += item.quantity * item.unitPrice
    })

    // Create purchase order
    const order = await INSERT.into(PurchaseOrders).entries({
      orderNumber,
      supplier_ID: supplier,
      orderDate: new Date().toISOString().split('T')[0],
      status: 'Draft',
      totalAmount,
      currency_code: 'INR'
    })

    // Create order items
    for (const item of items) {
      await INSERT.into(PurchaseOrderItems).entries({
        order_ID: order.ID,
        material_ID: item.material,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        currency_code: 'INR'
      })
    }

    // Emit event
    await this.emit('PurchaseOrderCreated', {
      orderNumber,
      supplier: supplierData.name,
      totalAmount
    })

    return { orderNumber }
  })

  // Send RFQ action
  this.on('sendRFQ', async req => {
    const { title, description, items, suppliers } = req.data

    // Generate RFQ number
    const rfqNumber = `RFQ-${Date.now()}`

    // Create RFQ
    await INSERT.into('RFQs').entries({
      rfqNumber,
      title,
      description,
      issueDate: new Date().toISOString().split('T')[0],
      responseDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days
      status: 'Draft'
    })

    // Emit event
    await this.emit('RFQSent', {
      rfqNumber,
      title,
      supplierCount: suppliers.length
    })

    return { rfqNumber }
  })

  // Phase 4: Gemini AI Chat Integration

  // Initialize chat session
  this.on('initChatSession', async (req) => {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

    // Create new chat session with Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'You are an AI-powered procurement assistant. You help with supplier management, material procurement, inventory management, purchase orders, and RFQs. Be helpful, professional, and provide specific procurement-related advice.' }]
        },
        {
          role: 'model',
          parts: [{ text: 'Hello! I\'m your AI-powered procurement assistant. I can help you with supplier management, material procurement, inventory tracking, creating purchase orders, sending RFQs, and providing procurement insights. How can I assist you today?' }]
        }
      ]
    })

    chatSessions.set(sessionId, {
      chat: chat,
      history: [],
      createdAt: new Date()
    })

    return {
      sessionId: sessionId,
      welcomeMessage: 'Hello! I\'m your AI-powered procurement assistant. I can help you with supplier management, material procurement, inventory tracking, creating purchase orders, sending RFQs, and providing procurement insights. How can I assist you today?'
    }
  })

  // Send chat message
  this.on('sendChatMessage', async (req) => {
    const { sessionId, message } = req.data

    try {
      if (!sessionId || !chatSessions.has(sessionId)) {
        return {
          success: false,
          error: 'Invalid session. Please refresh the page to start a new session.'
        }
      }

      const session = chatSessions.get(sessionId)
      const chat = session.chat

      // Add user message to history
      session.history.push({
        role: 'user',
        message: message,
        timestamp: new Date()
      })

      // Get AI response from Gemini
      const result = await chat.sendMessage(message)
      const response = await result.response
      const aiMessage = response.text()

      // Add AI response to history
      session.history.push({
        role: 'assistant',
        message: aiMessage,
        timestamp: new Date()
      })

      return {
        success: true,
        response: aiMessage,
        sessionId: sessionId
      }

    } catch (error) {
      console.error('Chat error details:', error.message, error.stack)
      return {
        success: false,
        error: 'Sorry, I encountered an error. Please try again.',
        fallbackResponse: 'I apologize, but I\'m having trouble connecting to my AI service right now. However, I can still help you with basic procurement tasks. What would you like to do?',
        sessionId: sessionId
      }
    }
  })

  // Get chat history
  this.on('getChatHistory', async (req) => {
    const { sessionId } = req.data

    if (!sessionId || !chatSessions.has(sessionId)) {
      return { success: false, history: [] }
    }

    const session = chatSessions.get(sessionId)
    return {
      success: true,
      history: session.history
    }
  })

  // Clear chat session
  this.on('clearChatSession', async (req) => {
    const { sessionId } = req.data

    if (sessionId && chatSessions.has(sessionId)) {
      chatSessions.delete(sessionId)
    }

    return { success: true }
  })

  // Data Management Action Handlers
  this.on('loadSuppliersData', async (req) => {
    try {
      console.log('🔄 Loading suppliers data from JSON...')
      const result = await loadSuppliersData()

      return {
        success: true,
        loaded: result.loaded,
        errors: result.errors,
        message: `Successfully loaded ${result.loaded} suppliers with ${result.errors} errors`
      }
    } catch (error) {
      console.error('❌ Error loading suppliers data:', error)
      return {
        success: false,
        loaded: 0,
        errors: 1,
        message: `Error loading suppliers: ${error.message}`
      }
    }
  })

  this.on('initializeMaterialsData', async (req) => {
    try {
      console.log('🔄 Initializing materials data...')
      await initializeMaterialsData()

      return {
        success: true,
        message: 'Successfully initialized sample materials data'
      }
    } catch (error) {
      console.error('❌ Error initializing materials:', error)
      return {
        success: false,
        message: `Error initializing materials: ${error.message}`
      }
    }
  })

  // Delegate requests to the underlying generic service
  return super.init()
}}
