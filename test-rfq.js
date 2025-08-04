/**
 * Test script for Simple RFQ Generator
 */

const { SimpleRFQGenerator } = require('./srv/ai-chat/simpleRFQGenerator');

async function testRFQGenerator() {
  console.log('🧪 Testing Simple RFQ Generator...\n');
  
  const generator = new SimpleRFQGenerator();
  
  try {
    // Test USB Hub RFQ generation
    console.log('📋 Generating RFQ for USB Hub...');
    const rfqData = await generator.generateRFQ('USB Hub', 5, 2, 'Asia');
    
    console.log('✅ RFQ Generated Successfully!');
    console.log('📊 RFQ Data:', JSON.stringify(rfqData, null, 2));
    
    console.log('\n📝 Formatted Response:');
    console.log(generator.formatRFQResponse(rfqData));
    
    // Test order placement
    console.log('\n🛒 Testing Order Placement...');
    const orderResult = await generator.placeOrder(rfqData, 1, 'Place order with Company 1');
    
    console.log('✅ Order Result:', JSON.stringify(orderResult, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testRFQGenerator().catch(console.error);
