const cds = require('@sap/cds')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { loadSuppliersData, initializeMaterialsData } = require('./data-loader')
const { AIChatRouter } = require('./ai-chat/index')
const productMapper = require('./ai-chat/productMaterialMapper')
require('dotenv').config()

// Initialize Gemini AI (legacy)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
console.log('Gemini API Key loaded:', GEMINI_API_KEY ? 'Yes' : 'No')
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// Chat sessions storage (in production, use proper database)
const chatSessions = new Map()

// Initialize AI Chat Router
const aiChatRouter = new AIChatRouter()

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
    const { ID, name, supplier, supplierName, quantity, category, unitPrice, currency, unit, description, location, deliveryPeriod } = req.data

    try {
      // Check if material ID already exists
      const existing = await SELECT.one.from(Materials).where({ ID })
      if (existing) {
        return { success: false, message: `Material with ID ${ID} already exists` }
      }

      // Prepare material data
      const materialData = {
        ID,
        name,
        quantity,
        category: category || 'General',
        unitPrice: unitPrice || 0,
        currency_code: currency || 'USD',
        unit: unit || 'pcs',
        description: description || '',
        location: location || 'Warehouse A',
        deliveryPeriod: deliveryPeriod || '',
        isActive: true,
        lastUpdated: new Date().toISOString()
      };

      // Handle supplier - can be either ID or name
      if (supplier && typeof supplier === 'number') {
        // If supplier is a number, treat as supplier ID
        materialData.supplier_ID = supplier;

        // Try to get supplier name
        try {
          const supplierData = await SELECT.one.from(Suppliers).where({ ID: supplier });
          if (supplierData) {
            materialData.supplierName = supplierData.name;
          }
        } catch (err) {
          console.log('Could not fetch supplier name:', err);
        }
      } else if (supplierName) {
        // If supplierName is provided, use it directly
        materialData.supplierName = supplierName;
      } else if (supplier && typeof supplier === 'string') {
        // If supplier is a string, treat as supplier name
        materialData.supplierName = supplier;
      }

      // Insert new material
      await INSERT.into(Materials).entries(materialData);

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

  // Send chat message - Enhanced with Agentic RAG
  this.on('sendChatMessage', async (req) => {
    const { sessionId, message } = req.data

    try {
      if (!sessionId || !chatSessions.has(sessionId)) {
        return {
          success: false,
          error: 'Invalid session. Please refresh the page to start a new session.'
        }
      }

      console.log(`🤖 Processing message: "${message}" for session: ${sessionId}`);

      // Use new AI Chat Router for enhanced processing
      const aiResponse = await aiChatRouter.processMessage(message, sessionId);

      if (aiResponse.success) {
        // Update session history
        const session = chatSessions.get(sessionId);
        session.history.push({
          role: 'user',
          message: message,
          timestamp: new Date()
        });
        session.history.push({
          role: 'assistant',
          message: aiResponse.response,
          timestamp: new Date(),
          intent: aiResponse.intent,
          confidence: aiResponse.confidence
        });

        return {
          success: true,
          response: aiResponse.response,
          intent: aiResponse.intent,
          confidence: aiResponse.confidence,
          actions: aiResponse.actions,
          sessionId: sessionId
        };
      } else {
        // Fallback to legacy Gemini if AI Router fails
        console.log('🔄 Falling back to legacy Gemini...');
        return await this.legacyGeminiChat(sessionId, message);
      }

    } catch (error) {
      console.error('Chat error details:', error.message, error.stack);

      // Fallback to legacy system
      try {
        return await this.legacyGeminiChat(sessionId, message);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return {
          success: false,
          error: 'Sorry, I encountered an error. Please try again.',
          fallbackResponse: 'I apologize, but I\'m having trouble connecting to my AI service right now. However, I can still help you with basic procurement tasks. What would you like to do?',
          sessionId: sessionId
        };
      }
    }
  })

  // Legacy Gemini chat method (fallback)
  this.legacyGeminiChat = async (sessionId, message) => {
    const session = chatSessions.get(sessionId);
    const chat = session.chat;

    // Add user message to history
    session.history.push({
      role: 'user',
      message: message,
      timestamp: new Date()
    });

    // Get AI response from Gemini
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const aiMessage = response.text();

    // Add AI response to history
    session.history.push({
      role: 'assistant',
      message: aiMessage,
      timestamp: new Date()
    });

    return {
      success: true,
      response: aiMessage,
      sessionId: sessionId,
      fallback: true
    };
  }

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

  // Enhanced supplier search endpoint for manual ordering
  this.on('enhancedSupplierSearch', async (req) => {
    try {
      const { searchTerm, region, category, minRating, limit } = req.data;
      console.log('🔍 Enhanced supplier search request:', req.data);

      if (!searchTerm) {
        return {
          success: false,
          message: 'Search term is required',
          suppliers: []
        };
      }

      // Get enhanced search terms using product mapping
      const enhancedSearch = productMapper.getEnhancedSearchTerms(searchTerm);
      console.log('🔍 Enhanced search terms:', enhancedSearch);

      // Build query filters
      const filters = [];
      const materialFilters = [];

      // Add original search term
      materialFilters.push(`contains(tolower(material), '${searchTerm.toLowerCase()}')`);
      materialFilters.push(`contains(tolower(name), '${searchTerm.toLowerCase()}')`);

      // Add mapped material categories
      enhancedSearch.matchingMaterials.forEach(material => {
        materialFilters.push(`contains(material, '${material}')`);
      });

      // Combine material filters with OR logic
      if (materialFilters.length > 0) {
        filters.push(`(${materialFilters.join(' or ')})`);
      }

      // Add other filters
      if (region) {
        filters.push(`region eq '${region}'`);
      }
      if (category) {
        filters.push(`category eq '${category}'`);
      }
      if (minRating) {
        filters.push(`rating ge ${minRating}`);
      }

      // Get suppliers with their products using separate queries for efficiency
      const allSuppliers = await SELECT.from('sap.procurement.Suppliers')
        .columns([
          'ID', 'name', 'category', 'material', 'region', 'leadTime',
          'rating', 'contact', 'location', 'isActive'
        ])
        .orderBy('rating desc');

      // Get all supplier products separately for efficient searching
      const allProducts = await SELECT.from('sap.procurement.SupplierProducts')
        .columns(['supplier_ID', 'name', 'description', 'price']);

      // Create a map of supplier ID to products for efficient lookup
      const supplierProductsMap = {};
      allProducts.forEach(product => {
        if (!supplierProductsMap[product.supplier_ID]) {
          supplierProductsMap[product.supplier_ID] = [];
        }
        supplierProductsMap[product.supplier_ID].push(product);
      });

      // Attach products to suppliers
      allSuppliers.forEach(supplier => {
        supplier.products = supplierProductsMap[supplier.ID] || [];
      });

      // Enhanced filtering with product search
      console.log(`🔍 Filtering ${allSuppliers.length} suppliers for term: "${searchTerm}"`);
      console.log(`🔍 Enhanced materials to search:`, enhancedSearch.matchingMaterials);

      const filteredSuppliers = allSuppliers.filter(supplier => {
        // Check material matches
        let materialMatch = false;

        // Direct search term match in material
        if (supplier.material && supplier.material.toLowerCase().includes(searchTerm.toLowerCase())) {
          materialMatch = true;
        }

        // Enhanced material matches
        for (const material of enhancedSearch.matchingMaterials) {
          if (supplier.material === material) {
            materialMatch = true;
            break;
          }
        }

        // Check product matches (NEW!)
        let productMatch = false;
        if (supplier.products && Array.isArray(supplier.products)) {
          productMatch = supplier.products.some(product => {
            if (product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase())) {
              return true;
            }
            if (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) {
              return true;
            }
            return false;
          });
        }

        // Check supplier name match
        const nameMatch = supplier.name && supplier.name.toLowerCase().includes(searchTerm.toLowerCase());

        // Apply other filters
        const regionMatch = !region || supplier.region === region;
        const categoryMatch = !category || supplier.category === category;
        const ratingMatch = !minRating || supplier.rating >= minRating;

        const finalMatch = (materialMatch || productMatch || nameMatch) && regionMatch && categoryMatch && ratingMatch;

        // Debug matches
        if (finalMatch) {
          const matchType = materialMatch ? 'Material' : productMatch ? 'Product' : 'Name';
          console.log(`✅ MATCH (${matchType}): ${supplier.name} - ${supplier.material} (${supplier.region})`);
          if (productMatch && supplier.products) {
            const matchingProducts = supplier.products.filter(p =>
              p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              p.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            console.log(`   📦 Matching products:`, matchingProducts.map(p => p.name));
          }
        }

        return finalMatch;
      });

      // Limit results
      const limitedResults = limit ? filteredSuppliers.slice(0, limit) : filteredSuppliers;

      return {
        success: true,
        suppliers: limitedResults,
        totalFound: filteredSuppliers.length,
        searchTerms: enhancedSearch,
        message: `Found ${limitedResults.length} suppliers matching "${searchTerm}"`
      };

    } catch (error) {
      console.error('❌ Error in enhanced supplier search:', error);
      return {
        success: false,
        message: `Search error: ${error.message}`,
        suppliers: []
      };
    }
  });

  // API Key status endpoint
  this.on('getAPIKeyStatus', async (req) => {
    try {
      const apiKeyManager = require('./ai-chat/apiKeyManager');
      const status = apiKeyManager.getDetailedStatus();

      console.log('📊 API Key status requested');
      return {
        success: true,
        status: status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ API Key status error:', error);
      req.error(500, `Failed to get API key status: ${error.message}`);
    }
  });

  // Switch API Key endpoint
  this.on('switchAPIKey', async (req) => {
    try {
      const { keyIndex } = req.data;
      const apiKeyManager = require('./ai-chat/apiKeyManager');

      if (!keyIndex || keyIndex < 1) {
        req.error(400, 'Invalid key index. Must be 1 or greater.');
        return;
      }

      const newKey = apiKeyManager.switchToKey(keyIndex - 1); // Convert to 0-based index
      const status = apiKeyManager.getDetailedStatus();

      console.log(`🔄 API Key switched to ${keyIndex} via endpoint`);
      return {
        success: true,
        message: `Switched to API_KEY_${keyIndex}`,
        currentKey: status.currentKeyName,
        status: status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ API Key switch error:', error);
      req.error(500, `Failed to switch API key: ${error.message}`);
    }
  });

  // Unified RFQ Generation endpoint
  this.on('generateRFQ', async (req) => {
    try {
      let { suppliers, material, product, quantity } = req.data;

      console.log('📋 Generating RFQ:', { suppliers, material, product, quantity });

      // Parse suppliers if it's a string
      if (typeof suppliers === 'string') {
        try {
          console.log('🔄 Parsing suppliers JSON string:', suppliers);
          suppliers = JSON.parse(suppliers);
          console.log('✅ Parsed suppliers:', suppliers);
        } catch (error) {
          console.error('❌ Error parsing suppliers JSON:', error);
          req.error(400, 'Invalid suppliers JSON format');
          return;
        }
      }

      console.log('📊 Final suppliers array:', suppliers, 'Type:', typeof suppliers, 'IsArray:', Array.isArray(suppliers));

      if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
        console.error('❌ Suppliers validation failed:', { suppliers, isArray: Array.isArray(suppliers), length: suppliers?.length });
        req.error(400, 'Suppliers array is required and must not be empty');
        return;
      }

      if (!quantity || quantity <= 0) {
        req.error(400, 'Valid quantity is required');
        return;
      }

      const RFQProcessor = require('./rfq-processor');
      const rfqProcessor = new RFQProcessor();

      // Process RFQ with backend
      const rfqRequest = {
        suppliers: suppliers,
        material: material || 'Unknown Material',
        product: product || material || 'Unknown Product',
        quantity: parseInt(quantity)
      };

      const rfqResponse = await rfqProcessor.processRFQ(rfqRequest);

      if (rfqResponse.success) {
        console.log(`✅ RFQ generated successfully for ${rfqResponse.totalSuppliers} suppliers`);
        return {
          success: true,
          rfqId: rfqResponse.requestId,
          rfqResults: rfqResponse.rfqResults,
          totalSuppliers: rfqResponse.totalSuppliers,
          formattedMessage: rfqProcessor.formatRFQForChat(rfqResponse),
          timestamp: rfqResponse.timestamp
        };
      } else {
        console.error('❌ RFQ generation failed:', rfqResponse.error);
        req.error(500, `RFQ generation failed: ${rfqResponse.error}`);
      }

    } catch (error) {
      console.error('❌ RFQ generation error:', error);
      req.error(500, `Failed to generate RFQ: ${error.message}`);
    }
  });

  // Quick Action: Create Purchase Order from RFQ
  this.on('createPOFromRFQ', async (req) => {
    try {
      const { rfqId, supplierName } = req.data;

      console.log('🛒 Creating PO from RFQ:', { rfqId, supplierName });

      if (!rfqId || !supplierName) {
        req.error(400, 'RFQ ID and supplier name are required');
        return;
      }

      // For now, create a mock order since we don't have RFQ storage
      // In a real system, you'd fetch the RFQ details from database
      const orderData = {
        supplierName: supplierName,
        material: 'USB Hub', // Default for demo
        product: 'USB Hub',
        quantity: 10,
        estimatedTotal: 315.00 // Use the RFQ estimated total
      };

      const PurchaseOrderProcessor = require('./purchase-order-processor');
      const poProcessor = new PurchaseOrderProcessor();

      const orderResponse = await poProcessor.processPurchaseOrder(orderData);

      if (orderResponse.success) {
        console.log(`✅ Purchase order created from RFQ: ${orderResponse.purchaseOrder.orderNumber}`);
        return {
          success: true,
          orderNumber: orderResponse.purchaseOrder.orderNumber,
          purchaseOrder: orderResponse.purchaseOrder,
          inventoryUpdate: orderResponse.inventoryUpdate,
          formattedMessage: poProcessor.formatOrderConfirmationForChat(orderResponse),
          timestamp: orderResponse.timestamp
        };
      } else {
        console.error('❌ Purchase order creation failed:', orderResponse.error);
        req.error(500, `Purchase order creation failed: ${orderResponse.error}`);
      }

    } catch (error) {
      console.error('❌ Create PO from RFQ error:', error);
      req.error(500, `Failed to create purchase order: ${error.message}`);
    }
  });

  // Unified Purchase Order endpoint
  this.on('createUnifiedPurchaseOrder', async (req) => {
    try {
      const { supplierName, material, product, quantity, estimatedTotal } = req.data;

      console.log('🛒 Creating purchase order:', { supplierName, material, product, quantity, estimatedTotal });

      if (!supplierName) {
        req.error(400, 'Supplier name is required');
        return;
      }

      if (!quantity || quantity <= 0) {
        req.error(400, 'Valid quantity is required');
        return;
      }

      const PurchaseOrderProcessor = require('./purchase-order-processor');
      const poProcessor = new PurchaseOrderProcessor();

      // Process purchase order with backend
      const orderRequest = {
        supplierName: supplierName,
        material: material || 'Unknown Material',
        product: product || material || 'Unknown Product',
        quantity: parseInt(quantity),
        estimatedTotal: estimatedTotal ? parseFloat(estimatedTotal) : null
      };

      const orderResponse = await poProcessor.processPurchaseOrder(orderRequest);

      if (orderResponse.success) {
        console.log(`✅ Purchase order created: ${orderResponse.purchaseOrder.orderNumber}`);
        return {
          success: true,
          orderNumber: orderResponse.purchaseOrder.orderNumber,
          purchaseOrder: orderResponse.purchaseOrder,
          inventoryUpdate: orderResponse.inventoryUpdate,
          formattedMessage: poProcessor.formatOrderConfirmationForChat(orderResponse),
          timestamp: orderResponse.timestamp
        };
      } else {
        console.error('❌ Purchase order creation failed:', orderResponse.error);
        req.error(500, `Purchase order creation failed: ${orderResponse.error}`);
      }

    } catch (error) {
      console.error('❌ Purchase order creation error:', error);
      req.error(500, `Failed to create purchase order: ${error.message}`);
    }
  });

  // Debug endpoint to test supplier filtering
  this.on('debugSupplierSearch', async (req) => {
    try {
      const { searchTerm } = req.data;
      console.log('🐛 Debug search for:', searchTerm);

      // Get all suppliers
      const allSuppliers = await SELECT.from('sap.procurement.Suppliers');
      console.log('🐛 Total suppliers:', allSuppliers.length);

      // Find suppliers with exact material match
      const exactMatches = allSuppliers.filter(s => s.material === searchTerm);
      console.log('🐛 Exact matches:', exactMatches.length);

      // Find suppliers with partial material match
      const partialMatches = allSuppliers.filter(s => s.material && s.material.includes(searchTerm));
      console.log('🐛 Partial matches:', partialMatches.length);

      return {
        searchTerm,
        totalSuppliers: allSuppliers.length,
        exactMatches: exactMatches.length,
        partialMatches: partialMatches.length,
        sampleExactMatches: exactMatches.slice(0, 3),
        samplePartialMatches: partialMatches.slice(0, 3)
      };

    } catch (error) {
      console.error('🐛 Debug search error:', error);
      return { error: error.message };
    }
  });

  // Delegate requests to the underlying generic service
  return super.init()
}}
