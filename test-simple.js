/**
 * Simple test without database dependencies
 */

console.log('🧪 Testing Simple RFQ Generation Logic...\n');

// Mock supplier data
const mockSuppliers = [
  {
    ID: 1,
    name: 'NextGenLogistics',
    email: 'nextgenlogistics@tradesupply.net',
    location: 'Oceania',
    region: 'Oceania',
    category: 'Electronics',
    material: 'Connectors',
    rating: 4.9
  },
  {
    ID: 2,
    name: 'DynamicLogistics',
    email: 'dynamiclogistics@supplyco.com',
    location: 'Oceania',
    region: 'Oceania',
    category: 'Electronics',
    material: 'Cables',
    rating: 3.9
  }
];

// Simple RFQ generation logic
function generateSimpleRFQ(productName, quantity, suppliers) {
  const basePrices = {
    'USB Hub': 35.00,
    'Steel Beam': 89.50,
    'Plastic Mold Case': 45.70
  };
  
  const basePrice = basePrices[productName] || 50.00;
  
  const rfqs = suppliers.map((supplier, index) => {
    const priceVariation = (Math.random() * 0.3 - 0.15); // ±15% variation
    const unitPrice = basePrice * (1 + priceVariation);
    const subtotal = unitPrice * quantity;
    const tax = subtotal * 0.10; // 10% tax
    const shipping = 40.00; // Base shipping
    const total = subtotal + tax + shipping;
    
    return {
      companyNumber: index + 1,
      companyName: supplier.name,
      contact: supplier.email,
      location: supplier.location,
      category: supplier.category,
      material: supplier.material,
      leadTime: '7-10 days',
      pricing: {
        productName,
        quantity,
        unitPrice: unitPrice.toFixed(2),
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        total: total.toFixed(2)
      }
    };
  });
  
  return {
    success: true,
    productName,
    quantity,
    supplierCount: rfqs.length,
    rfqs,
    rfqId: `RFQ-${Date.now()}-test`
  };
}

function formatRFQResponse(rfqData) {
  console.log('DEBUG: Starting format with data:', rfqData);
  let response = `📋 RFQ Generated (${rfqData.supplierCount} suppliers)\n\n`;

  rfqData.rfqs.forEach((rfq, index) => {
    console.log(`DEBUG: Processing RFQ ${index + 1}:`, rfq);

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

    console.log(`DEBUG: Current response length: ${response.length}`);

    if (index < rfqData.rfqs.length - 1) {
      response += `\n${'─'.repeat(50)}\n\n`;
    }
  });

  response += `\n\n💡 Next Steps: Choose a supplier to place your order.\n`;
  response += `🛒 Type "Place order with Company [1/2]" to proceed.`;

  console.log('DEBUG: Final response:', response);
  return response;
}

// Test the logic
console.log('📋 Generating RFQ for USB Hub (5 units)...\n');

const rfqData = generateSimpleRFQ('USB Hub', 5, mockSuppliers);
console.log('✅ RFQ Data Generated:');
console.log(JSON.stringify(rfqData, null, 2));

console.log('\n📝 Formatted Response:');
console.log(formatRFQResponse(rfqData));

console.log('\n🎉 Simple RFQ generation working correctly!');
