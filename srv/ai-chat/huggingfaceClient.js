/**
 * Hugging Face Client - Llama-3.1-8B-Instruct Integration
 * Provides fallback when Gemini API hits quota limits
 */

const axios = require('axios');
require('dotenv').config();

class HuggingFaceClient {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.model = process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';
    this.baseUrl = 'https://api-inference.huggingface.co/models';
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🤗 Initializing Hugging Face client...');
      
      if (!this.apiKey) {
        throw new Error('HUGGINGFACE_API_KEY not found in environment variables');
      }
      
      // Test the connection
      await this.testConnection();
      
      this.initialized = true;
      console.log(`✅ Hugging Face client initialized with model: ${this.model}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Hugging Face client:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.model}`,
        {
          inputs: "Test connection",
          parameters: {
            max_new_tokens: 10,
            temperature: 0.1
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      console.log('🤗 Hugging Face connection test successful');
      return true;
    } catch (error) {
      if (error.response?.status === 503) {
        console.log('🤗 Model is loading, connection test passed');
        return true;
      }
      throw error;
    }
  }

  /**
   * Generate response using Llama-3.1-8B-Instruct
   */
  async generateResponse(prompt, context = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🤗 Generating response with Llama-3.1-8B-Instruct...');

      const systemPrompt = this.buildSystemPrompt(context);
      const fullPrompt = this.formatPrompt(systemPrompt, prompt);

      const response = await axios.post(
        `${this.baseUrl}/${this.model}`,
        {
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 1000,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data[0] && response.data[0].generated_text) {
        const generatedText = response.data[0].generated_text.trim();
        console.log('✅ Hugging Face response generated successfully');
        return generatedText;
      } else {
        throw new Error('Invalid response format from Hugging Face');
      }

    } catch (error) {
      console.error('❌ Error generating response with Hugging Face:', error);
      
      if (error.response?.status === 503) {
        throw new Error('Model is currently loading. Please try again in a few moments.');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded for Hugging Face API');
      } else {
        throw error;
      }
    }
  }

  /**
   * Detect intent using Llama-3.1-8B-Instruct
   */
  async detectIntent(message, conversationHistory = []) {
    try {
      const prompt = this.buildIntentDetectionPrompt(message, conversationHistory);
      const response = await this.generateResponse(prompt);
      
      // Parse JSON response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const intentData = JSON.parse(jsonMatch[0]);
          console.log('🎯 Intent detected by Llama:', intentData.intent);
          return intentData;
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('❌ Error parsing intent JSON:', parseError);
        // Fallback intent
        return {
          intent: 'GENERAL_CHAT',
          confidence: 0.5,
          parameters: {},
          reasoning: 'Failed to parse intent from Llama response'
        };
      }

    } catch (error) {
      console.error('❌ Error detecting intent with Llama:', error);
      throw error;
    }
  }

  buildSystemPrompt(context) {
    return `You are an AI procurement assistant. You help users with supplier management, material procurement, inventory tracking, creating purchase orders, and sending RFQs.

Available context:
- Suppliers: ${context.suppliers?.length || 0} found
- Materials: ${context.materials?.length || 0} available
- Search results: ${context.searchResults?.length || 0} items

Respond in a helpful, professional manner. Be concise but informative.`;
  }

  buildIntentDetectionPrompt(message, conversationHistory) {
    return `You are an AI agent that detects user intents for a procurement system. Analyze the user message and return a JSON response with the detected intent.

AVAILABLE INTENTS:
1. SUPPLIER_SEARCH - Finding/listing suppliers
2. RFQ_GENERATION - Creating quotes/RFQs
3. ORDER_PLACEMENT - Placing orders/purchasing
4. INVENTORY_CHECK - Checking stock/materials
5. SEMANTIC_SEARCH - Finding similar suppliers/products
6. GENERAL_CHAT - General questions/help

RESPONSE FORMAT (JSON only):
{
  "intent": "INTENT_NAME",
  "confidence": 0.95,
  "parameters": {
    "material": "extracted material",
    "region": "extracted region",
    "quantity": "extracted quantity",
    "suppliers": ["extracted suppliers"]
  },
  "reasoning": "Brief explanation"
}

EXAMPLES:
Input: "find suppliers for steel beam in asia"
Output: {
  "intent": "SUPPLIER_SEARCH",
  "confidence": 0.95,
  "parameters": {
    "material": "Steel Beam",
    "region": "Asia"
  },
  "reasoning": "User wants to search for suppliers with specific material and region"
}

Input: "needed 5 units"
Output: {
  "intent": "RFQ_GENERATION",
  "confidence": 0.9,
  "parameters": {
    "quantity": 5
  },
  "reasoning": "User specifies quantity, likely for RFQ or order"
}

Input: "send rfq"
Output: {
  "intent": "RFQ_GENERATION",
  "confidence": 0.95,
  "parameters": {},
  "reasoning": "User explicitly requests RFQ generation"
}

Conversation History:
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.message}`).join('\n')}

Current User Message: "${message}"

Respond with JSON only:`;
  }

  formatPrompt(systemPrompt, userPrompt) {
    return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>

${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`;
  }
}

module.exports = { HuggingFaceClient };
