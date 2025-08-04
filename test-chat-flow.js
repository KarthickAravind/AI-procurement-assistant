/**
 * Test the complete chat flow with simplified RFQ
 */

const { AIChatRouter } = require('./srv/ai-chat/index');

async function testChatFlow() {
  console.log('🧪 Testing Complete Chat Flow...\n');
  
  try {
    const chatRouter = new AIChatRouter();
    await chatRouter.initialize();
    
    // Session will be created automatically
    const sessionId = 'test-session-' + Date.now();

    console.log('✅ Chat router initialized\n');
    
    // Test 1: Supplier search
    console.log('📝 Test 1: Supplier Search');
    console.log('Message: "need top 3 supplier for usb hub in asia"');
    
    const searchResult = await chatRouter.processMessage(
      'need top 3 supplier for usb hub in asia',
      sessionId
    );
    
    console.log('🎯 Search Result:');
    console.log('Success:', searchResult.success);
    console.log('Response:', searchResult.response.substring(0, 200) + '...');
    console.log('Intent:', searchResult.intent);
    console.log('');
    
    // Test 2: RFQ Generation
    console.log('📝 Test 2: RFQ Generation');
    console.log('Message: "need 2 unit. send RFQ TechNetworks"');
    
    const rfqResult = await chatRouter.processMessage(
      'need 2 unit. send RFQ TechNetworks',
      sessionId
    );
    
    console.log('🎯 RFQ Result:');
    console.log('Success:', rfqResult.success);
    console.log('Response:', rfqResult.response.substring(0, 500) + '...');
    console.log('Intent:', rfqResult.intent);
    console.log('');
    
    // Test 3: Order Placement
    console.log('📝 Test 3: Order Placement');
    console.log('Message: "Place order with Company 1"');
    
    const orderResult = await chatRouter.processMessage(
      'Place order with Company 1',
      sessionId
    );
    
    console.log('🎯 Order Result:');
    console.log('Success:', orderResult.success);
    console.log('Response:', orderResult.response.substring(0, 300) + '...');
    console.log('Intent:', orderResult.intent);
    
    console.log('\n🎉 Chat flow test completed!');
    
  } catch (error) {
    console.error('❌ Error in chat flow test:', error);
  }
}

testChatFlow().catch(console.error);
