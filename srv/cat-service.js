const cds = require('@sap/cds')

module.exports = class ProcurementService extends cds.ApplicationService { init() {

  const { Suppliers, Materials, PurchaseOrders, PurchaseOrderItems } = cds.entities('sap.procurement')

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
