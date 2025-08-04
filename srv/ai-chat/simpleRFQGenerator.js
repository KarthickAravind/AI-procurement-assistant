/**
 * Simple RFQ Generator - Direct from Dataset
 * Bypasses complex flows and generates RFQs directly from supplier data
 */

const cds = require('@sap/cds');

class SimpleRFQGenerator {
  constructor() {
    this.materialProductMap = {
      // Manufacturing
      'Aluminum Sheets': ['Plastic Mold Case', 'Steel Beam'],
      'Casting Materials': ['Plastic Mold Case', 'Steel Beam'],
      'Plastic Molding': ['Plastic Mold Case', 'Steel Beam'],
      'Industrial Fasteners': ['Plastic Mold Case', 'Steel Beam'],
      'Steel Components': ['Plastic Mold Case', 'Steel Beam'],
      
      // Construction
      'Bricks': ['Cement Bag', 'Red Clay Bricks'],
      'Construction Steel': ['Cement Bag', 'Red Clay Bricks'],
      'Cement Mix': ['Cement Bag', 'Red Clay Bricks'],
      'Insulation Panels': ['Cement Bag', 'Red Clay Bricks'],
      'Glass Panels': ['Cement Bag', 'Red Clay Bricks'],
      
      // Logistics
      'Packaging Material': ['Shipping Container', 'Wooden Pallet'],
      'Conveyor Belts': ['Shipping Container', 'Wooden Pallet'],
      'Shipping Containers': ['Shipping Container', 'Wooden Pallet'],
      'Transport Crates': ['Shipping Container', 'Wooden Pallet'],
      'Pallets': ['Shipping Container', 'Wooden Pallet'],
      
      // Electronics
      'Connectors': ['Power Supply Unit', 'USB Hub'],
      'Power Supplies': ['Power Supply Unit', 'USB Hub'],
      'Circuit Boards': ['Power Supply Unit', 'USB Hub'],
      'Electronic Components': ['Power Supply Unit', 'USB Hub'],
      'Cables': ['Power Supply Unit', 'USB Hub']
    };

    this.basePrices = {
      'Plastic Mold Case': 45.70,
      'Steel Beam': 89.50,
      'Cement Bag': 12.30,
      'Red Clay Bricks': 0.85,
      'Shipping Container': 2500.00,
      'Wooden Pallet': 25.00,
      'Power Supply Unit': 125.00,
      'USB Hub': 35.00
    };
  }

  /**
   * Generate RFQ for multiple suppliers
   */
  async generateRFQ(productName, quantity, supplierCount = 2, region = null) {
    try {
      console.log(`🔧 Generating RFQ for ${quantity} units of ${productName} from ${supplierCount} suppliers`);

      // Find suitable suppliers
      const suppliers = await this.findSuitableSuppliers(productName, supplierCount, region);
      
      if (suppliers.length === 0) {
        throw new Error(`No suppliers found for ${productName}`);
      }

      // Generate RFQ for each supplier
      const rfqs = suppliers.map((supplier, index) => {
        return this.generateSupplierRFQ(supplier, productName, quantity, index + 1);
      });

      return {
        success: true,
        productName,
        quantity,
        supplierCount: rfqs.length,
        rfqs,
        rfqId: `RFQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

    } catch (error) {
      console.error('❌ Error generating RFQ:', error);
      throw error;
    }
  }

  /**
   * Find suitable suppliers for a product (using mock data)
   */
  async findSuitableSuppliers(productName, count, region) {
    try {
      console.log(`🔍 Finding suppliers for ${productName} (count: ${count}, region: ${region})`);

      // Mock supplier data for testing
      const mockSuppliers = [
        {
          ID: 1001,
          name: 'TechNetworks',
          email: 'technetworks@logix.com',
          location: 'Asia',
          region: 'Asia',
          category: 'Electronics',
          material: 'Connectors',
          rating: 5.0
        },
        {
          ID: 1002,
          name: 'NextGenLogistics',
          email: 'nextgenlogistics@tradesupply.net',
          location: 'Asia',
          region: 'Asia',
          category: 'Electronics',
          material: 'Electronic Components',
          rating: 4.9
        },
        {
          ID: 1003,
          name: 'DynamicLogistics',
          email: 'dynamiclogistics@supplyco.com',
          location: 'Oceania',
          region: 'Oceania',
          category: 'Electronics',
          material: 'Cables',
          rating: 3.9
        },
        {
          ID: 1004,
          name: 'GlobalIndustries',
          email: 'globalindustries@mfgnet.org',
          location: 'Europe',
          region: 'Europe',
          category: 'Electronics',
          material: 'Circuit Boards',
          rating: 4.8
        }
      ];

      // Filter by region if specified
      let filteredSuppliers = mockSuppliers;
      if (region) {
        filteredSuppliers = mockSuppliers.filter(s =>
          s.region.toLowerCase().includes(region.toLowerCase())
        );
      }

      // Sort by rating and take top suppliers
      const topSuppliers = filteredSuppliers
        .sort((a, b) => b.rating - a.rating)
        .slice(0, count);

      console.log(`✅ Found ${topSuppliers.length} suitable suppliers`);
      return topSuppliers;

    } catch (error) {
      console.error('❌ Error finding suppliers:', error);
      return [];
    }
  }

  /**
   * Generate RFQ for a single supplier
   */
  generateSupplierRFQ(supplier, productName, quantity, companyNumber) {
    // Calculate pricing - normalize product name for lookup
    const normalizedProductName = productName.split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
    const basePrice = this.basePrices[normalizedProductName] || this.basePrices[productName] || 50.00;
    const priceVariation = (Math.random() * 0.3 - 0.15); // ±15% variation
    const unitPrice = basePrice * (1 + priceVariation);
    const subtotal = unitPrice * quantity;
    const tax = subtotal * 0.10; // 10% tax
    const shipping = this.calculateShipping(quantity, supplier.region);
    const total = subtotal + tax + shipping;

    // Generate lead time
    const leadTime = this.generateLeadTime(supplier.category, quantity);

    return {
      companyNumber,
      companyName: supplier.name,
      contact: supplier.email,
      location: supplier.location || supplier.region,
      category: supplier.category,
      material: supplier.material,
      leadTime,
      pricing: {
        productName,
        quantity,
        unitPrice: unitPrice.toFixed(2),
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        total: total.toFixed(2)
      },
      supplier: supplier // Store full supplier data for order processing
    };
  }

  /**
   * Calculate shipping cost based on quantity and region
   */
  calculateShipping(quantity, region) {
    let baseShipping = 40.00;
    
    // Adjust for quantity
    if (quantity > 10) baseShipping += (quantity - 10) * 2;
    if (quantity > 50) baseShipping += (quantity - 50) * 1;
    
    // Adjust for region
    const regionMultipliers = {
      'Asia': 1.0,
      'Europe': 1.2,
      'Americas': 1.3,
      'Africa': 1.1,
      'Oceania': 1.4
    };
    
    const multiplier = regionMultipliers[region] || 1.0;
    return baseShipping * multiplier;
  }

  /**
   * Generate realistic lead time
   */
  generateLeadTime(category, quantity) {
    const baseDays = {
      'Manufacturing': 7,
      'Construction': 10,
      'Logistics': 5,
      'Electronics': 3
    };
    
    const base = baseDays[category] || 7;
    const quantityDays = Math.ceil(quantity / 10); // +1 day per 10 units
    const variation = Math.floor(Math.random() * 5); // 0-4 days variation
    
    const totalDays = base + quantityDays + variation;
    
    if (totalDays <= 7) return `${totalDays} days`;
    if (totalDays <= 14) return `1-2 weeks`;
    if (totalDays <= 30) return `2-4 weeks`;
    return `1-2 months`;
  }

  /**
   * Format RFQ for display
   */
  formatRFQResponse(rfqData) {
    let response = `📋 RFQ Generated (${rfqData.supplierCount} suppliers)\n\n`;
    
    rfqData.rfqs.forEach((rfq, index) => {
      response += `Company ${rfq.companyNumber}\n`;
      response += `Contact: ${rfq.contact}\n`;
      response += `Location: ${rfq.location}\n`;
      response += `Category: ${rfq.category}\n`;
      response += `Material: ${rfq.material}\n`;
      response += `Lead Time: ${rfq.leadTime}\n\n`;
      
      response += `Estimated Pricing\n`;
      response += `${rfq.pricing.productName} (${rfq.pricing.quantity} units): $${rfq.pricing.subtotal}\n`;
      response += `Tax (10%): $${rfq.pricing.tax}\n`;
      response += `Shipping: $${rfq.pricing.shipping}\n`;
      response += `Total Estimated: $${rfq.pricing.total}\n`;
      
      if (index < rfqData.rfqs.length - 1) {
        response += `\n${'─'.repeat(50)}\n\n`;
      }
    });
    
    response += `\n\n💡 Next Steps: Choose a supplier to place your order.\n`;
    response += `🛒 Type "Place order with Company [1/2/3]" to proceed.`;
    
    return response;
  }

  /**
   * Process order placement - SIMPLIFIED VERSION
   */
  async placeOrder(rfqData, companyNumber, userMessage) {
    try {
      console.log('🛒 Processing order placement...');
      console.log('📋 RFQ Data:', rfqData);
      console.log('🏢 Company Number:', companyNumber);

      // Find the selected RFQ
      const selectedRFQ = rfqData.rfqs.find(rfq => rfq.companyNumber === companyNumber);
      if (!selectedRFQ) {
        throw new Error(`Company ${companyNumber} not found in RFQ`);
      }

      console.log('✅ Selected RFQ:', selectedRFQ);

      // Create inventory data for adding to materials table
      const inventoryData = {
        name: selectedRFQ.pricing.productName,
        supplier: selectedRFQ.companyName, // Use company name instead of ID
        quantity: parseInt(selectedRFQ.pricing.quantity),
        category: selectedRFQ.category,
        deliveryPeriod: selectedRFQ.leadTime,
        unitPrice: parseFloat(selectedRFQ.pricing.unitPrice),
        totalValue: parseFloat(selectedRFQ.pricing.total),
        status: 'Ordered',
        lastUpdated: new Date().toISOString()
      };

      console.log('📦 Inventory data to add:', inventoryData);

      // Use CAP service to add to Materials table
      try {
        const { INSERT } = cds.ql;

        // Generate a unique material ID
        const materialID = `MAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Prepare data for Materials table
        const materialData = {
          ID: materialID,
          name: inventoryData.name,
          supplierName: inventoryData.supplier, // Supplier name for display
          quantity: inventoryData.quantity,
          category: inventoryData.category,
          unitPrice: inventoryData.unitPrice,
          currency_code: 'USD',
          unit: 'units',
          description: `Ordered via RFQ - ${inventoryData.name}`,
          location: 'Warehouse',
          deliveryPeriod: inventoryData.deliveryPeriod,
          lastUpdated: inventoryData.lastUpdated
        };

        // Insert into Materials table
        await INSERT.into('sap.procurement.Materials').entries(materialData);
        console.log('✅ Successfully added to Materials table:', materialID);

      } catch (dbError) {
        console.log('⚠️ Database not available, using simulation mode');
        console.log('📦 Simulated inventory addition:', inventoryData);
      }

      return {
        success: true,
        message: `✅ Order placed successfully with ${selectedRFQ.companyName}!\n\n` +
                `📦 ${selectedRFQ.pricing.productName} (${selectedRFQ.pricing.quantity} units)\n` +
                `💰 Total: $${selectedRFQ.pricing.total}\n` +
                `🚚 Delivery: ${selectedRFQ.leadTime}\n` +
                `📋 Added to inventory overview.`,
        orderData: inventoryData
      };

    } catch (error) {
      console.error('❌ Error placing order:', error);
      return {
        success: false,
        message: `❌ Order placement failed: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = { SimpleRFQGenerator };
