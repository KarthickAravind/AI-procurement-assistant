/**
 * Test script for intent detection
 */

const { Agent } = require('./srv/ai-chat/agent');

async function testIntentDetection() {
  console.log('🧪 Testing Intent Detection...\n');
  
  const agent = new Agent();
  
  const testMessages = [
    "find top supplier of usb hub in asia",
    "needed 5 units. so send RFQ to NextGenLogistics and DynamicLogistics",
    "needed 5 units",
    "send RFQ",
    "Place order with Company 1"
  ];
  
  for (const message of testMessages) {
    console.log(`📝 Testing: "${message}"`);
    try {
      const intent = await agent.detectIntent(message);
      console.log(`🎯 Intent: ${intent.type} (confidence: ${intent.confidence})`);
      console.log(`📋 Parameters:`, intent.parameters);
      console.log(`💭 Reasoning: ${intent.reasoning}\n`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
}

testIntentDetection().catch(console.error);
