const cds = require('@sap/cds');

class PurchaseOrderProcessor {
  constructor() {
    this.orderCounter = 1000; // Starting order number
  }

  /**
   * Process purchase order and update inventory
   */
  async processPurchaseOrder(orderRequest) {
    try {
      console.log('🛒 Processing purchase order:', orderRequest);

      const { supplierName, material, product, quantity, estimatedTotal } = orderRequest;

      // Get supplier details (try database first, then create mock supplier)
      let supplier = await this.getSupplierDetails(supplierName);
      if (!supplier) {
        console.log(`⚠️ Supplier not found in database: ${supplierName}, creating mock supplier`);
        // Create a mock supplier for AI chat and manual order scenarios
        supplier = {
          ID: Date.now(), // Use timestamp as mock ID
          name: supplierName,
          material: material || 'Unknown Material',
          contact: `${supplierName.toLowerCase().replace(/\s+/g, '')}@example.com`,
          location: 'Unknown Location',
          leadTime: '1-2 weeks',
          rating: 4.0
        };
      }

      // Ensure supplier is an object, not a string (this should not happen but safety check)
      if (typeof supplier === 'string') {
        console.log(`⚠️ Supplier is a string, converting to object: ${supplier}`);
        const originalSupplierName = supplier;
        supplier = {
          ID: Date.now(),
          name: originalSupplierName,
          material: material || 'Unknown Material',
          contact: `${originalSupplierName.toLowerCase().replace(/\s+/g, '')}@example.com`,
          location: 'Unknown Location',
          leadTime: '1-2 weeks',
          rating: 4.0
        };
      }

      // Ensure supplier has required properties
      if (!supplier.ID) {
        supplier.ID = Date.now();
      }
      if (!supplier.name) {
        supplier.name = supplierName || 'Unknown Supplier';
      }

      console.log('✅ Supplier object validated:', { ID: supplier.ID, name: supplier.name, type: typeof supplier });

      // Create purchase order
      const purchaseOrder = await this.createPurchaseOrder(supplier, material, product, quantity, estimatedTotal);
      
      // Update inventory
      const inventoryUpdate = await this.updateInventory(material, product, quantity, supplier);
      
      return {
        success: true,
        purchaseOrder: purchaseOrder,
        inventoryUpdate: inventoryUpdate,
        message: `✅ Purchase order ${purchaseOrder.orderNumber} created successfully!`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Purchase order processing failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get supplier details
   */
  async getSupplierDetails(supplierName) {
    try {
      const { SELECT } = cds.ql;
      
      const supplier = await SELECT.one.from('sap.procurement.Suppliers')
        .where({ name: supplierName });

      return supplier;
    } catch (error) {
      console.error('❌ Error getting supplier details:', error);
      return null;
    }
  }

  /**
   * Create purchase order record
   */
  async createPurchaseOrder(supplier, material, product, quantity, estimatedTotal) {
    try {
      const { INSERT } = cds.ql;
      
      const orderNumber = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const productName = product || material || 'Unknown Product';
      
      // Calculate pricing details
      const unitPrice = estimatedTotal ? (parseFloat(estimatedTotal) / quantity) : 50.0;
      const totalAmount = unitPrice * quantity;
      
      const purchaseOrder = {
        orderNumber: orderNumber,
        supplier_ID: supplier.ID,
        supplierName: supplier.name,
        material: material || supplier.material,
        product: productName,
        quantity: quantity,
        unitPrice: unitPrice.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        status: 'Pending',
        orderDate: new Date().toISOString(),
        expectedDelivery: this.calculateDeliveryDate(supplier.leadTime),
        contact: supplier.contact,
        location: supplier.location
      };

      // Insert into database
      await INSERT.into('sap.procurement.PurchaseOrders').entries(purchaseOrder);
      
      console.log(`✅ Purchase order created: ${orderNumber}`);
      return purchaseOrder;

    } catch (error) {
      console.error('❌ Error creating purchase order:', error);
      throw error;
    }
  }

  /**
   * Update inventory with new stock
   */
  async updateInventory(material, product, quantity, supplier) {
    try {
      console.log('📦 Updating inventory with supplier:', { supplier, type: typeof supplier, hasID: !!supplier.ID });

      const { SELECT, UPDATE, INSERT } = cds.ql;

      const productName = product || material || 'Unknown Product';
      const category = this.getCategoryFromMaterial(material || (supplier && supplier.material ? supplier.material : 'Unknown'));
      
      // Check if inventory item exists
      const existingItem = await SELECT.one.from('sap.procurement.Materials')
        .where({ name: productName });

      if (existingItem) {
        // Update existing inventory
        const newQuantity = (existingItem.quantity || 0) + quantity;
        const newValue = newQuantity * (existingItem.unitPrice || 50.0);
        
        await UPDATE('sap.procurement.Materials')
          .set({
            quantity: newQuantity,
            totalValue: newValue.toFixed(2),
            lastUpdated: new Date().toISOString(),
            supplier: supplier && supplier.name ? supplier.name : 'Unknown Supplier'
          })
          .where({ ID: existingItem.ID });

        console.log(`✅ Updated inventory: ${productName} (+${quantity} units)`);
        
        return {
          action: 'updated',
          productName: productName,
          previousQuantity: existingItem.quantity || 0,
          newQuantity: newQuantity,
          addedQuantity: quantity
        };

      } else {
        // Create new inventory item
        const unitPrice = 50.0; // Default unit price
        const totalValue = quantity * unitPrice;
        
        const newInventoryItem = {
          name: productName,
          category: category,
          quantity: quantity,
          unitPrice: unitPrice.toFixed(2),
          totalValue: totalValue.toFixed(2),
          supplier: supplier && supplier.name ? supplier.name : 'Unknown Supplier',
          location: supplier && supplier.location ? supplier.location : 'Unknown Location',
          lastUpdated: new Date().toISOString(),
          status: 'In Stock'
        };

        await INSERT.into('sap.procurement.Materials').entries(newInventoryItem);
        
        console.log(`✅ Added new inventory item: ${productName} (${quantity} units)`);
        
        return {
          action: 'created',
          productName: productName,
          quantity: quantity,
          unitPrice: unitPrice
        };
      }

    } catch (error) {
      console.error('❌ Error updating inventory:', error);
      throw error;
    }
  }

  /**
   * Calculate expected delivery date
   */
  calculateDeliveryDate(leadTime) {
    const today = new Date();
    let days = 7; // Default 1 week
    
    if (leadTime) {
      const leadTimeStr = leadTime.toLowerCase();
      if (leadTimeStr.includes('day')) {
        const match = leadTimeStr.match(/(\d+)/);
        if (match) {
          days = parseInt(match[1]);
        }
      } else if (leadTimeStr.includes('week')) {
        const match = leadTimeStr.match(/(\d+)/);
        if (match) {
          days = parseInt(match[1]) * 7;
        }
      } else if (leadTimeStr.includes('month')) {
        const match = leadTimeStr.match(/(\d+)/);
        if (match) {
          days = parseInt(match[1]) * 30;
        }
      }
    }
    
    const deliveryDate = new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));
    return deliveryDate.toISOString();
  }

  /**
   * Get category from material type
   */
  getCategoryFromMaterial(material) {
    if (!material) return 'General';
    
    const materialLower = material.toLowerCase();
    
    if (materialLower.includes('steel') || materialLower.includes('aluminum') || materialLower.includes('metal')) {
      return 'Metals';
    } else if (materialLower.includes('plastic') || materialLower.includes('polymer')) {
      return 'Plastics';
    } else if (materialLower.includes('electronic') || materialLower.includes('circuit') || materialLower.includes('usb')) {
      return 'Electronics';
    } else if (materialLower.includes('connector') || materialLower.includes('cable')) {
      return 'Components';
    } else {
      return 'General';
    }
  }

  /**
   * Format purchase order confirmation for chat
   */
  formatOrderConfirmationForChat(orderResponse) {
    if (!orderResponse.success) {
      return `❌ Purchase order failed: ${orderResponse.error}`;
    }

    const po = orderResponse.purchaseOrder;
    const inventory = orderResponse.inventoryUpdate;
    
    let chatMessage = `✅ **Purchase Order Created**\n\n`;
    
    chatMessage += `**Order Details**\n`;
    chatMessage += `Order Number: ${po.orderNumber}\n`;
    chatMessage += `Supplier: ${po.supplierName}\n`;
    chatMessage += `Product: ${po.product}\n`;
    chatMessage += `Quantity: ${po.quantity} units\n`;
    chatMessage += `Unit Price: $${po.unitPrice}\n`;
    chatMessage += `Total Amount: $${po.totalAmount}\n`;
    chatMessage += `Expected Delivery: ${new Date(po.expectedDelivery).toLocaleDateString()}\n\n`;
    
    chatMessage += `**Inventory Update**\n`;
    if (inventory.action === 'updated') {
      chatMessage += `📦 Updated existing stock: ${inventory.productName}\n`;
      chatMessage += `Previous Quantity: ${inventory.previousQuantity} units\n`;
      chatMessage += `New Quantity: ${inventory.newQuantity} units (+${inventory.addedQuantity})\n`;
    } else {
      chatMessage += `📦 Added new inventory item: ${inventory.productName}\n`;
      chatMessage += `Quantity: ${inventory.quantity} units\n`;
      chatMessage += `Unit Price: $${inventory.unitPrice}\n`;
    }
    
    chatMessage += `\n💡 **Status**: Order is now pending delivery. Check the Inventory Overview tile for updated stock levels.`;
    
    return chatMessage;
  }

  /**
   * Parse order request from chat message
   */
  parseOrderRequest(message, rfqContext) {
    try {
      // Handle confirmation responses (yes, ok, proceed, etc.)
      const confirmationPatterns = [
        /^yes$/i, /^ok$/i, /^okay$/i, /^proceed$/i, /^confirm$/i, /^place.*order$/i
      ];

      const isConfirmation = confirmationPatterns.some(pattern => pattern.test(message.trim()));

      if (isConfirmation && rfqContext && rfqContext.rfqResults && rfqContext.rfqResults.length > 0) {
        // Use the first supplier from RFQ context for confirmation
        const firstRFQ = rfqContext.rfqResults[0];
        console.log('✅ Order confirmation detected, using RFQ context:', firstRFQ.supplierInfo.companyName);

        return {
          supplierName: firstRFQ.supplierInfo.companyName,
          material: firstRFQ.supplierInfo.material,
          product: firstRFQ.supplierInfo.product,
          quantity: firstRFQ.supplierInfo.units,
          estimatedTotal: firstRFQ.estimatedPricing.breakdown.totalEstimate
        };
      }

      // Extract supplier name from message
      const orderPatterns = [
        /place order for (.+)/i,
        /place order (.+)/i,
        /order from (.+)/i,
        /buy from (.+)/i
      ];

      let supplierName = null;
      for (const pattern of orderPatterns) {
        const match = message.match(pattern);
        if (match) {
          supplierName = match[1].trim();
          // Clean up supplier name (remove brackets if present)
          supplierName = supplierName.replace(/^\[|\]$/g, '');
          break;
        }
      }

      if (!supplierName) {
        throw new Error('Could not extract supplier name from message');
      }
      
      // Use RFQ context if available
      if (rfqContext && rfqContext.rfqResults) {
        const matchingRFQ = rfqContext.rfqResults.find(rfq => 
          rfq.supplierInfo.companyName.toLowerCase().includes(supplierName.toLowerCase())
        );
        
        if (matchingRFQ) {
          return {
            supplierName: matchingRFQ.supplierInfo.companyName,
            material: matchingRFQ.supplierInfo.material,
            product: matchingRFQ.supplierInfo.product,
            quantity: matchingRFQ.supplierInfo.units,
            estimatedTotal: matchingRFQ.estimatedPricing.breakdown.totalEstimate
          };
        }
      }
      
      // Fallback to basic parsing
      return {
        supplierName: supplierName,
        material: null,
        product: null,
        quantity: 1,
        estimatedTotal: null
      };
      
    } catch (error) {
      console.error('❌ Error parsing order request:', error);
      throw error;
    }
  }
}

module.exports = PurchaseOrderProcessor;
