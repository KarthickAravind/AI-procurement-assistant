/**
 * Agent System - Intent Detection and Parameter Extraction
 * Uses Gemini for intelligent routing of procurement queries
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const apiKeyManager = require('./apiKeyManager');
const { HuggingFaceClient } = require('./huggingfaceClient');
require('dotenv').config();

class Agent {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.apiKeyManager = apiKeyManager;
    this.huggingFaceClient = new HuggingFaceClient();
    this.initializeWithCurrentKey();
  }

  /**
   * Initialize with current API key
   */
  initializeWithCurrentKey() {
    try {
      const currentKey = this.apiKeyManager.getCurrentKey();
      this.genAI = new GoogleGenerativeAI(currentKey);
      console.log('🔑 Agent initialized with current API key');
    } catch (error) {
      console.error('❌ Failed to initialize Agent:', error);
      throw error;
    }
  }

  async initialize() {
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent intent detection
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      }
    });
  }

  /**
   * Detect intent and extract parameters from user message
   * @param {string} message - User's natural language message
   * @returns {Object} - Intent type, confidence, and extracted parameters
   */
  async detectIntent(message) {
    let retryCount = 0;
    const maxRetries = this.apiKeyManager.getStatus().totalKeys;

    while (retryCount < maxRetries) {
      try {
        if (!this.model) {
          await this.initialize();
        }

        const prompt = this.buildIntentDetectionPrompt(message);
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log('🤖 Raw Gemini response:', text);

        // Clean the response - remove markdown formatting
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/```\s*/, '').replace(/```\s*$/, '');
        }

        // Parse the JSON response
        const intentData = JSON.parse(cleanText);

        return {
          type: intentData.intent,
          confidence: intentData.confidence,
          parameters: intentData.parameters || {},
          reasoning: intentData.reasoning || ''
        };

      } catch (error) {
        console.error(`❌ Intent detection error (attempt ${retryCount + 1}):`, error);

        // Check if it's a quota/rate limit error
        if (this.apiKeyManager.isQuotaError(error)) {
          console.log('🔄 Attempting to rotate API key for intent detection...');
          const rotated = this.apiKeyManager.markCurrentKeyAsFailed(error);

          if (rotated) {
            // Reinitialize with new key
            this.initializeWithCurrentKey();
            await this.initialize();
            retryCount++;
            continue; // Retry with new key
          }
        }

        // If not a quota error or no more keys available, try Hugging Face
        break;
      }
    }

    // Try Hugging Face as fallback before rule-based detection
    try {
      console.log('🤗 Falling back to Hugging Face for intent detection...');
      const huggingFaceResult = await this.huggingFaceClient.detectIntent(message);
      return {
        type: huggingFaceResult.intent,
        confidence: huggingFaceResult.confidence,
        parameters: huggingFaceResult.parameters || {},
        reasoning: huggingFaceResult.reasoning || 'Detected by Hugging Face Llama'
      };
    } catch (hfError) {
      console.error('❌ Hugging Face intent detection failed:', hfError);
    }

    // Final fallback to rule-based intent detection
    console.log('🔄 Using rule-based intent detection as final fallback...');
    return this.fallbackIntentDetection(message);
  }

  /**
   * Build prompt for intent detection
   */
  buildIntentDetectionPrompt(message) {
    return `
You are an AI agent that detects user intents for a procurement system. Analyze the user message and return a JSON response with the detected intent.

AVAILABLE INTENTS:
1. SUPPLIER_SEARCH - Finding/listing suppliers
2. RFQ_GENERATION - Creating quotes/RFQs
3. ORDER_PLACEMENT - Placing orders/purchasing
4. INVENTORY_CHECK - Checking stock/materials
5. SEMANTIC_SEARCH - Finding similar suppliers/products
6. GENERAL_CHAT - General questions/help

PARAMETER EXTRACTION RULES:
- Extract materials, regions, categories, quantities, suppliers, ratings
- Convert natural language to structured parameters
- Handle variations like "USB cables" → "USB Cable", "Asia" → "Asia"

USER MESSAGE: "${message}"

RESPONSE FORMAT (JSON only):
{
  "intent": "INTENT_TYPE",
  "confidence": 0.95,
  "parameters": {
    "material": "extracted_material",
    "region": "extracted_region",
    "category": "extracted_category",
    "minRating": 4.0,
    "quantity": 10,
    "suppliers": ["supplier_names"],
    "rfqId": "rfq_id_if_mentioned"
  },
  "reasoning": "Brief explanation of why this intent was chosen"
}

EXAMPLES:

Input: "Find top 3 USB cable suppliers in Asia"
Output: {
  "intent": "SUPPLIER_SEARCH",
  "confidence": 0.95,
  "parameters": {
    "material": "USB Cable",
    "region": "Asia",
    "limit": 3,
    "sortBy": "rating"
  },
  "reasoning": "User wants to search for suppliers with specific material and region"
}

Input: "Create RFQ for TechCorp for 100 laptops"
Output: {
  "intent": "RFQ_GENERATION",
  "confidence": 0.90,
  "parameters": {
    "suppliers": ["TechCorp"],
    "materials": ["Laptop"],
    "quantities": [100]
  },
  "reasoning": "User wants to generate an RFQ for specific supplier and material"
}

Input: "Place order for RFQ-123456"
Output: {
  "intent": "ORDER_PLACEMENT",
  "confidence": 0.95,
  "parameters": {
    "rfqId": "RFQ-123456"
  },
  "reasoning": "User wants to place an order based on existing RFQ"
}

Input: "Check inventory status"
Output: {
  "intent": "INVENTORY_CHECK",
  "confidence": 0.90,
  "parameters": {},
  "reasoning": "User wants to check current inventory status"
}

Input: "Find suppliers similar to TechCorp"
Output: {
  "intent": "SEMANTIC_SEARCH",
  "confidence": 0.85,
  "parameters": {
    "similarTo": "TechCorp"
  },
  "reasoning": "User wants semantic similarity search for suppliers"
}

Now analyze the user message and respond with JSON only:`;
  }

  /**
   * Fallback rule-based intent detection
   */
  fallbackIntentDetection(message) {
    const lowerMessage = message.toLowerCase();
    
    // Supplier search patterns
    if (this.matchesPatterns(lowerMessage, [
      'find supplier', 'list supplier', 'show supplier', 'search supplier',
      'top supplier', 'best supplier', 'supplier in', 'supplier for',
      'suppliers in', 'suppliers for', 'aluminum supplier', 'steel supplier',
      'plastic supplier', 'manufacturing supplier', 'construction supplier',
      'logistics supplier', 'find top', 'show top', 'list top'
    ])) {
      return {
        type: 'SUPPLIER_SEARCH',
        confidence: 0.8,
        parameters: this.extractSupplierSearchParams(message),
        reasoning: 'Rule-based detection: supplier search keywords found'
      };
    }

    // High priority RFQ patterns (check first)
    if (this.matchesPatterns(lowerMessage, [
      'send rfq', 'create rfq', 'generate rfq', 'rfq for',
      'send quote', 'get quote', 'request quote'
    ]) || lowerMessage.includes('rfq')) {
      return {
        type: 'RFQ_GENERATION',
        confidence: 0.95,
        parameters: this.extractRFQParams(message),
        reasoning: 'Rule-based detection: Explicit RFQ request found'
      };
    }

    // Quantity + RFQ patterns (high priority)
    if ((this.matchesPatterns(lowerMessage, ['needed', 'need']) &&
         /\d+\s*(units?|pcs?|pieces?)/.test(lowerMessage)) ||
        (lowerMessage.includes('units') &&
         this.matchesPatterns(lowerMessage, ['send', 'create', 'generate', 'rfq', 'quote']))) {
      return {
        type: 'RFQ_GENERATION',
        confidence: 0.9,
        parameters: this.extractRFQParams(message),
        reasoning: 'Rule-based detection: Quantity + RFQ action detected'
      };
    }

    // General RFQ patterns
    if (this.matchesPatterns(lowerMessage, [
      'quote for', 'quotation', 'price quote', 'needed', 'need', 'units'
    ])) {
      return {
        type: 'RFQ_GENERATION',
        confidence: 0.7,
        parameters: this.extractRFQParams(message),
        reasoning: 'Rule-based detection: RFQ keywords found'
      };
    }

    // Order placement patterns
    if (this.matchesPatterns(lowerMessage, [
      'place order', 'buy', 'purchase', 'order', 'place po'
    ])) {
      return {
        type: 'ORDER_PLACEMENT',
        confidence: 0.7,
        parameters: this.extractOrderParams(message),
        reasoning: 'Rule-based detection: order keywords found'
      };
    }

    // Order confirmation patterns (yes, ok, proceed after RFQ)
    if (this.matchesPatterns(lowerMessage, [
      'yes', 'ok', 'okay', 'proceed', 'confirm', 'place it'
    ])) {
      return {
        type: 'ORDER_PLACEMENT',
        confidence: 0.8,
        parameters: { confirmation: true },
        reasoning: 'Rule-based detection: order confirmation keywords found'
      };
    }

    // Inventory check patterns
    if (this.matchesPatterns(lowerMessage, [
      'check inventory', 'inventory status', 'stock level', 'materials',
      'what do we have', 'current stock'
    ])) {
      return {
        type: 'INVENTORY_CHECK',
        confidence: 0.7,
        parameters: this.extractInventoryParams(message),
        reasoning: 'Rule-based detection: inventory keywords found'
      };
    }

    // Semantic search patterns
    if (this.matchesPatterns(lowerMessage, [
      'similar to', 'like', 'comparable', 'equivalent'
    ])) {
      return {
        type: 'SEMANTIC_SEARCH',
        confidence: 0.6,
        parameters: this.extractSemanticParams(message),
        reasoning: 'Rule-based detection: similarity keywords found'
      };
    }

    // Default to general chat
    return {
      type: 'GENERAL_CHAT',
      confidence: 0.5,
      parameters: {},
      reasoning: 'No specific intent detected, defaulting to general chat'
    };
  }

  /**
   * Check if message matches any of the patterns
   */
  matchesPatterns(message, patterns) {
    return patterns.some(pattern => message.includes(pattern));
  }

  /**
   * Extract parameters for supplier search
   */
  extractSupplierSearchParams(message) {
    const params = {};
    const lowerMessage = message.toLowerCase();

    // Extract regions
    const regions = ['asia', 'europe', 'africa', 'americas', 'oceania'];
    for (const region of regions) {
      if (lowerMessage.includes(region)) {
        params.region = region.charAt(0).toUpperCase() + region.slice(1);
        break;
      }
    }

    // Extract categories
    const categories = ['manufacturing', 'construction', 'logistics'];
    for (const category of categories) {
      if (lowerMessage.includes(category)) {
        params.category = category.charAt(0).toUpperCase() + category.slice(1);
        break;
      }
    }

    // Extract numbers (for limits)
    const topMatch = message.match(/top\s+(\d+)/i);
    const numberMatch = message.match(/\b(\d+)\b/);
    if (topMatch) {
      params.limit = parseInt(topMatch[1]);
    } else if (numberMatch) {
      params.limit = parseInt(numberMatch[1]);
    }

    // Extract materials (expanded list based on actual data)
    const materials = [
      'aluminum', 'steel', 'plastic', 'casting', 'fastener', 'fasteners',
      'usb', 'cable', 'laptop', 'electronics', 'molding', 'sheets'
    ];
    for (const material of materials) {
      if (lowerMessage.includes(material)) {
        // Map to actual material names in database
        if (material === 'aluminum') params.material = 'Aluminum';
        else if (material === 'steel') params.material = 'Steel';
        else if (material === 'plastic') params.material = 'Plastic';
        else if (material === 'casting') params.material = 'Casting';
        else if (material === 'fastener' || material === 'fasteners') params.material = 'Fasteners';
        else params.material = material.charAt(0).toUpperCase() + material.slice(1);
        break;
      }
    }

    // Extract rating requirements
    if (lowerMessage.includes('high rating') || lowerMessage.includes('top rated')) {
      params.minRating = 4.0;
    }

    // Set default sorting
    params.sortBy = 'rating';

    return params;
  }

  /**
   * Extract parameters for RFQ generation
   */
  extractRFQParams(message) {
    const params = {};

    // Extract supplier names (multiple patterns)
    let supplierMatch = message.match(/rfq for (.+?)(?:\s|$)/i);
    if (!supplierMatch) {
      supplierMatch = message.match(/send rfq to (.+?)(?:\s|$)/i);
    }
    if (!supplierMatch) {
      supplierMatch = message.match(/quote from (.+?)(?:\s|$)/i);
    }
    if (!supplierMatch) {
      // Handle "to SupplierA and SupplierB" pattern
      supplierMatch = message.match(/to (.+?)(?:\s|$)/i);
    }

    if (supplierMatch) {
      const supplierText = supplierMatch[1].trim();
      // Handle multiple suppliers separated by "and"
      if (supplierText.includes(' and ')) {
        params.suppliers = supplierText.split(' and ').map(s => s.trim());
      } else {
        params.suppliers = [supplierText];
      }
    }

    // Extract quantities (multiple patterns)
    let quantityMatch = message.match(/(\d+)\s*(units?|pieces?|pcs?|uint)/i); // Added 'uint' for typos
    if (!quantityMatch) {
      quantityMatch = message.match(/needed?\s+(\d+)/i);
    }
    if (!quantityMatch) {
      quantityMatch = message.match(/(\d+)\s+needed?/i);
    }
    if (!quantityMatch) {
      quantityMatch = message.match(/(\d+)\s+(units?|uint)/i); // Handle "5 uint"
    }
    if (!quantityMatch) {
      // Handle standalone numbers like "5 units"
      quantityMatch = message.match(/^(\d+)(?:\s+units?)?$/i);
    }
    if (quantityMatch) {
      params.quantity = parseInt(quantityMatch[1]); // Use singular 'quantity'
      params.quantities = [parseInt(quantityMatch[1])]; // Keep for backward compatibility
    }

    // Extract materials from common patterns
    const materials = [
      'aluminum', 'steel', 'plastic', 'casting', 'fastener', 'fasteners',
      'usb hub', 'usb', 'cable', 'laptop', 'electronics', 'molding', 'sheets', 'beam'
    ];
    for (const material of materials) {
      if (message.toLowerCase().includes(material)) {
        if (material === 'aluminum') params.material = 'Aluminum Sheets';
        else if (material === 'steel' || material === 'beam') params.material = 'Steel Components';
        else if (material === 'plastic') params.material = 'Plastic Molding';
        else if (material === 'casting') params.material = 'Casting Materials';
        else if (material === 'fastener' || material === 'fasteners') params.material = 'Industrial Fasteners';
        else if (material === 'usb hub') params.material = 'Electronic Components';
        else if (material === 'usb') params.material = 'Cables';
        else params.material = material.charAt(0).toUpperCase() + material.slice(1);
        break;
      }
    }

    return params;
  }

  /**
   * Extract parameters for order placement
   */
  extractOrderParams(message) {
    const params = {};
    
    // Extract RFQ ID
    const rfqMatch = message.match(/rfq[_-]?(\d+)/i);
    if (rfqMatch) {
      params.rfqId = `RFQ-${rfqMatch[1]}`;
    }
    
    return params;
  }

  /**
   * Extract parameters for inventory check
   */
  extractInventoryParams(message) {
    const params = {};
    
    // Extract specific materials or categories
    if (message.toLowerCase().includes('low stock')) {
      params.stockStatus = 'Low Stock';
    }
    
    return params;
  }

  /**
   * Extract parameters for semantic search
   */
  extractSemanticParams(message) {
    const params = {};
    
    // Extract company names (simple pattern)
    const companyMatch = message.match(/similar to (\w+)/i);
    if (companyMatch) {
      params.similarTo = companyMatch[1];
    }
    
    return params;
  }
}

module.exports = { Agent };
