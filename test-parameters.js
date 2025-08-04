/**
 * Test parameter extraction specifically
 */

const { AIChatRouter } = require('./srv/ai-chat/index');

async function testParameterExtraction() {
  console.log('🧪 Testing Parameter Extraction...\n');
  
  try {
    const chatRouter = new AIChatRouter();
    await chatRouter.initialize();
    
    const sessionId = 'test-params-' + Date.now();
    
    console.log('✅ Chat router initialized\n');
    
    // First establish context with supplier search
    console.log('📝 Step 1: Establish context with supplier search');
    console.log('Message: "need top 2 supplier for usb hub in asia"');
    
    const searchResult = await chatRouter.processMessage(
      'need top 2 supplier for usb hub in asia',
      sessionId
    );
    
    console.log('🎯 Search completed\n');
    
    // Test specific parameter extraction
    console.log('📝 Step 2: Test specific parameter extraction');
    console.log('Message: "needed 5 units. send RFQ to TechNetworks"');
    
    const rfqResult = await chatRouter.processMessage(
      'needed 5 units. send RFQ to TechNetworks',
      sessionId
    );
    
    console.log('🎯 RFQ Result:');
    console.log('Success:', rfqResult.success);
    console.log('Intent:', rfqResult.intent);
    
    // Extract key information from response
    const response = rfqResult.response;
    console.log('\n📊 Checking extracted parameters:');
    
    // Check quantity
    if (response.includes('5 units')) {
      console.log('✅ Quantity: Correctly extracted 5 units');
    } else if (response.includes('2 units')) {
      console.log('❌ Quantity: Used 2 units instead of 5');
    } else {
      console.log('❓ Quantity: Could not determine from response');
    }
    
    // Check product name
    if (response.includes('USB Hub') || response.includes('Usb Hub')) {
      console.log('✅ Product: Correctly identified as USB Hub');
    } else if (response.includes('uint')) {
      console.log('❌ Product: Incorrectly identified as "uint"');
    } else {
      console.log('❓ Product: Could not determine from response');
    }
    
    // Check supplier count
    const supplierMatches = response.match(/Company \d+/g);
    const supplierCount = supplierMatches ? supplierMatches.length : 0;
    if (supplierCount === 1) {
      console.log('✅ Suppliers: Correctly generated 1 supplier as requested');
    } else {
      console.log(`❌ Suppliers: Generated ${supplierCount} suppliers instead of 1`);
    }
    
    console.log('\n📋 Full Response:');
    console.log(response.substring(0, 500) + '...');
    
    console.log('\n🎉 Parameter extraction test completed!');
    
  } catch (error) {
    console.error('❌ Error in parameter extraction test:', error);
  }
}

testParameterExtraction().catch(console.error);
