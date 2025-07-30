const cds = require('@sap/cds')

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

  // Delegate requests to the underlying generic service
  return super.init()
}}
