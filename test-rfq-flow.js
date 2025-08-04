/**
 * Test the RFQ flow specifically
 */

const { AIChatRouter } = require('./srv/ai-chat/index');

async function testRFQFlow() {
  console.log('🧪 Testing RFQ Flow...\n');
  
  try {
    const chatRouter = new AIChatRouter();
    await chatRouter.initialize();
    
    const sessionId = 'test-rfq-' + Date.now();
    
    console.log('✅ Chat router initialized\n');
    
    // Test RFQ Generation
    console.log('📝 Testing RFQ Generation');
    console.log('Message: "need 3 unit. send RFQ to DynamicNetworks"');
    
    const rfqResult = await chatRouter.processMessage(
      'need 3 unit. send RFQ to DynamicNetworks',
      sessionId
    );
    
    console.log('🎯 RFQ Result:');
    console.log('Success:', rfqResult.success);
    console.log('Intent:', rfqResult.intent);
    console.log('Response:');
    console.log(rfqResult.response);
    console.log('');
    
    // Test Order Placement
    console.log('📝 Testing Order Placement');
    console.log('Message: "Place order with Company 1"');
    
    const orderResult = await chatRouter.processMessage(
      'Place order with Company 1',
      sessionId
    );
    
    console.log('🎯 Order Result:');
    console.log('Success:', orderResult.success);
    console.log('Intent:', orderResult.intent);
    console.log('Response:');
    console.log(orderResult.response);
    
    console.log('\n🎉 RFQ flow test completed!');
    
  } catch (error) {
    console.error('❌ Error in RFQ flow test:', error);
  }
}

testRFQFlow().catch(console.error);
