const cds = require('@sap/cds');

class RFQProcessor {
  constructor() {
    this.taxRate = 0.10; // 10% tax rate
    this.shippingCost = 40.00; // Fixed shipping cost
  }

  /**
   * Process RFQ request and generate detailed pricing
   */
  async processRFQ(rfqRequest) {
    try {
      console.log('📋 Processing RFQ request:', rfqRequest);
      
      const { suppliers, material, product, quantity } = rfqRequest;
      const rfqResults = [];

      for (const supplierInfo of suppliers) {
        try {
          // Use provided supplier information directly (for AI chat and manual order)
          let supplier = supplierInfo;

          // If supplierInfo is just a string, try to get from database
          if (typeof supplierInfo === 'string') {
            supplier = await this.getSupplierDetails(supplierInfo);
            if (!supplier) {
              console.log(`❌ Supplier not found: ${supplierInfo}`);
              continue;
            }
          } else {
            // Use provided supplier object directly
            console.log(`✅ Using provided supplier data: ${supplier.name}`);
          }

          // Get product pricing
          const productPricing = await this.getProductPricing(supplier, material, product);
          
          // Calculate detailed estimate
          const estimate = this.calculateDetailedEstimate(productPricing, quantity);
          
          // Format supplier information
          const rfqResult = {
            supplierInfo: {
              companyName: supplier.name,
              contact: supplier.contact,
              location: supplier.location,
              material: supplier.material,
              product: productPricing.productName,
              leadTime: supplier.leadTime,
              units: quantity
            },
            estimatedPricing: {
              productLine: `${productPricing.productName} (${quantity} units): $${estimate.materialCost}`,
              taxLine: `Tax (${(this.taxRate * 100).toFixed(0)}%): $${estimate.taxAmount}`,
              shippingLine: `Shipping: $${estimate.shippingCost}`,
              totalLine: `Total Estimated: $${estimate.totalEstimate}`,
              unitPrice: productPricing.unitPrice,
              breakdown: estimate
            }
          };

          rfqResults.push(rfqResult);
          console.log(`✅ RFQ processed for ${supplier.name}`);

        } catch (error) {
          console.error(`❌ Error processing RFQ for supplier:`, error);
          // Add error entry
          rfqResults.push({
            supplierInfo: {
              companyName: supplierInfo.name || supplierInfo,
              error: `Failed to process: ${error.message}`
            }
          });
        }
      }

      return {
        success: true,
        rfqResults: rfqResults,
        totalSuppliers: rfqResults.length,
        requestId: this.generateRFQId(),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ RFQ processing failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get detailed supplier information
   */
  async getSupplierDetails(supplierInfo) {
    try {
      const { SELECT } = cds.ql;
      
      // Handle both string names and objects
      const supplierName = typeof supplierInfo === 'string' ? supplierInfo : supplierInfo.name;
      
      const supplier = await SELECT.one.from('sap.procurement.Suppliers')
        .where({ name: supplierName });

      return supplier;
    } catch (error) {
      console.error('❌ Error getting supplier details:', error);
      return null;
    }
  }

  /**
   * Get product pricing from supplier
   */
  async getProductPricing(supplier, material, product) {
    try {
      const { SELECT } = cds.ql;
      
      // Get supplier's products
      const supplierProducts = await SELECT.from('sap.procurement.SupplierProducts')
        .where({ supplier_ID: supplier.ID });

      let matchingProduct = null;
      let productName = product || material;

      if (supplierProducts && supplierProducts.length > 0) {
        // Try to find exact product match
        if (product) {
          matchingProduct = supplierProducts.find(p => 
            p.name && p.name.toLowerCase().includes(product.toLowerCase())
          );
        }
        
        // Try to find material match
        if (!matchingProduct && material) {
          matchingProduct = supplierProducts.find(p => 
            p.name && (
              p.name.toLowerCase().includes(material.toLowerCase()) ||
              supplier.material.toLowerCase().includes(material.toLowerCase())
            )
          );
        }
        
        // Use first product as fallback
        if (!matchingProduct) {
          matchingProduct = supplierProducts[0];
        }

        if (matchingProduct) {
          productName = matchingProduct.name;
        }
      }

      // Calculate unit price
      const unitPrice = matchingProduct ? parseFloat(matchingProduct.price) : this.getDefaultPrice(material, product);

      return {
        productName: productName,
        unitPrice: unitPrice.toFixed(2),
        matchingProduct: matchingProduct
      };

    } catch (error) {
      console.error('❌ Error getting product pricing:', error);
      return {
        productName: product || material || 'Unknown Product',
        unitPrice: this.getDefaultPrice(material, product).toFixed(2),
        matchingProduct: null
      };
    }
  }

  /**
   * Calculate detailed pricing estimate
   */
  calculateDetailedEstimate(productPricing, quantity) {
    const unitPrice = parseFloat(productPricing.unitPrice);
    const materialCost = unitPrice * quantity;
    const taxAmount = materialCost * this.taxRate;
    const totalEstimate = materialCost + taxAmount + this.shippingCost;

    return {
      materialCost: materialCost.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      shippingCost: this.shippingCost.toFixed(2),
      totalEstimate: totalEstimate.toFixed(2),
      unitPrice: unitPrice.toFixed(2)
    };
  }

  /**
   * Get default price for unknown products
   */
  getDefaultPrice(material, product) {
    const priceMap = {
      'steel': 90.0,
      'aluminum': 75.0,
      'plastic': 45.0,
      'circuit': 120.0,
      'usb': 25.0,
      'connector': 15.0,
      'cable': 20.0
    };

    const searchTerm = (product || material || '').toLowerCase();
    
    for (const [key, price] of Object.entries(priceMap)) {
      if (searchTerm.includes(key)) {
        return price;
      }
    }
    
    return 50.0; // Default fallback price
  }

  /**
   * Generate unique RFQ ID
   */
  generateRFQId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `RFQ-${timestamp}-${random}`;
  }

  /**
   * Format RFQ response for chat display
   */
  formatRFQForChat(rfqResponse) {
    if (!rfqResponse.success) {
      return `❌ RFQ processing failed: ${rfqResponse.error}`;
    }

    let chatMessage = `📋 **RFQ Generated** (${rfqResponse.totalSuppliers} suppliers)\n\n`;

    rfqResponse.rfqResults.forEach((rfq, index) => {
      if (rfq.supplierInfo.error) {
        chatMessage += `❌ **${rfq.supplierInfo.companyName}**: ${rfq.supplierInfo.error}\n\n`;
        return;
      }

      chatMessage += `**Supplier Information**\n`;
      chatMessage += `Company Name: ${rfq.supplierInfo.companyName}\n`;
      chatMessage += `Contact: ${rfq.supplierInfo.contact}\n`;
      chatMessage += `Location: ${rfq.supplierInfo.location}\n`;
      chatMessage += `Material: ${rfq.supplierInfo.material}\n`;
      chatMessage += `Product: ${rfq.supplierInfo.product}\n`;
      chatMessage += `Lead Time: ${rfq.supplierInfo.leadTime}\n`;
      chatMessage += `Units: ${rfq.supplierInfo.units}\n\n`;
      
      chatMessage += `**Estimated Pricing**\n`;
      chatMessage += `${rfq.estimatedPricing.productLine}\n`;
      chatMessage += `${rfq.estimatedPricing.taxLine}\n`;
      chatMessage += `${rfq.estimatedPricing.shippingLine}\n`;
      chatMessage += `${rfq.estimatedPricing.totalLine}\n`;
      
      if (index < rfqResponse.rfqResults.length - 1) {
        chatMessage += `\n${'─'.repeat(50)}\n\n`;
      }
    });

    chatMessage += `\n💡 **Next Steps**: Type "place order for [company name]" to proceed with purchase.`;
    
    return chatMessage;
  }
}

module.exports = RFQProcessor;
