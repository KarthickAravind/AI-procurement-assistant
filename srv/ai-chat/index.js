/**
 * AI Chat Router - Main entry point for AI-powered procurement chat
 * Handles routing between different agents and RAG systems
 */

const { Agent } = require('./agent');
const { PineconeRetriever } = require('./retriever');
const { GeminiClient } = require('./geminiClient');
const { ProcurementActions } = require('./actions');
const { SimpleRFQGenerator } = require('./simpleRFQGenerator');
const RFQProcessor = require('../rfq-processor');
const PurchaseOrderProcessor = require('../purchase-order-processor');

class AIChatRouter {
  constructor() {
    this.agent = new Agent();
    this.retriever = new PineconeRetriever();
    this.geminiClient = new GeminiClient();
    this.actions = new ProcurementActions();
    this.simpleRFQGenerator = new SimpleRFQGenerator();
    this.rfqProcessor = new RFQProcessor();
    this.purchaseOrderProcessor = new PurchaseOrderProcessor();
    this.sessions = new Map(); // Store chat sessions with message history
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🤖 Initializing AI Chat Router...');
      
      // Initialize Pinecone connection
      await this.retriever.initialize();
      console.log('✅ Pinecone retriever initialized');
      
      // Initialize Gemini client
      await this.geminiClient.initialize();
      console.log('✅ Gemini client initialized');
      
      // Initialize procurement actions
      await this.actions.initialize();
      console.log('✅ Procurement actions initialized');
      
      this.initialized = true;
      console.log('🚀 AI Chat Router ready!');
      
    } catch (error) {
      console.error('❌ Failed to initialize AI Chat Router:', error);
      throw error;
    }
  }

  /**
   * Process user message through the agentic RAG system
   * @param {string} message - User's natural language message
   * @param {string} sessionId - Chat session ID
   * @returns {Object} - AI response with actions and context
   */
  async processMessage(message, sessionId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`🔄 Processing message: "${message}" for session: ${sessionId}`);

      // Initialize session if it doesn't exist
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          messages: [],
          context: {},
          lastActivity: new Date()
        });
        console.log(`📝 Created new session: ${sessionId}`);
      }

      // Get session data
      const session = this.sessions.get(sessionId);

      // Add user message to history
      session.messages.push({
        role: 'user',
        message: message,
        timestamp: new Date()
      });

      // Step 1: Intent Detection (with conversation history context)
      const intent = await this.agent.detectIntent(message, session.messages);
      console.log(`🎯 Detected intent: ${intent.type} (confidence: ${intent.confidence})`);
      
      // Step 2: Route to appropriate handler (with conversation history)
      let context = {
        conversationHistory: session.messages.slice(-10), // Last 10 messages for context
        sessionContext: session.context
      };
      let actions = [];

      switch (intent.type) {
        case 'SUPPLIER_SEARCH':
          const searchContext = await this.handleSupplierSearch(message, intent);
          context = { ...context, ...searchContext };
          break;

        case 'RFQ_GENERATION':
          console.log('🔄 Routing to RFQ generation handler...');
          const rfqContext = await this.handleRFQGeneration(message, intent, session);
          console.log('📋 RFQ Context returned:', rfqContext);
          context = { ...context, ...rfqContext };
          break;

        case 'ORDER_PLACEMENT':
          const orderContext = await this.handleOrderPlacement(message, intent, session);
          context = { ...context, ...orderContext };
          break;
          
        case 'INVENTORY_CHECK':
          context = await this.handleInventoryCheck(message, intent);
          break;
          
        case 'SEMANTIC_SEARCH':
          context = await this.handleSemanticSearch(message, intent);
          break;
          
        default:
          context = await this.handleGeneralChat(message, intent);
      }
      
      // Step 3: Generate final response - check for simplified responses first
      let response;

      console.log('🔍 Checking context type:', context.type);
      console.log('📋 Full context:', context);

      // Check if we have a simplified RFQ response
      if (context.type === 'simple_rfq_success') {
        console.log('✅ Using simplified RFQ response directly');
        response = {
          text: context.message,
          actions: []
        };
      } else if (context.type === 'simple_order_success') {
        console.log('✅ Using simplified order response directly');
        response = {
          text: context.message,
          actions: []
        };
      } else {
        console.log('⚠️ No simplified response found, using Gemini/fallback');
        // Use Gemini for other responses
        try {
          response = await this.geminiClient.generateResponse(
            message,
            context,
            intent,
            sessionId
          );
        } catch (error) {
          console.log('⚠️ Gemini API error, using fallback response generator');
          response = {
            text: this.generateFallbackResponse(intent.type, context),
            actions: []
          };
        }
      }

      // Add AI response to conversation history
      session.messages.push({
        role: 'assistant',
        message: response.text,
        intent: intent.type,
        timestamp: new Date()
      });

      // Update session context with any new information
      session.context = { ...session.context, ...context.sessionContext };
      session.lastActivity = new Date();

      // Store updated session
      this.sessions.set(sessionId, session);

      return {
        success: true,
        response: response.text,
        intent: intent.type,
        context: context,
        actions: response.actions || [],
        confidence: intent.confidence
      };
      
    } catch (error) {
      console.error('❌ Error processing message:', error);
      return {
        success: false,
        error: error.message,
        fallbackResponse: this.generateFallbackResponse(message)
      };
    }
  }

  /**
   * Handle supplier search queries
   */
  async handleSupplierSearch(message, intent) {
    console.log('🏭 Handling supplier search...');

    // Extract search parameters from intent
    const searchParams = intent.parameters;
    console.log('🔍 Search parameters:', searchParams);

    try {
      // Try structured search first
      if (searchParams.material || searchParams.region || searchParams.category) {
        console.log('📊 Attempting structured search...');
        const structuredResults = await this.actions.searchSuppliers(searchParams);

        if (structuredResults && structuredResults.length > 0) {
          console.log(`✅ Structured search found ${structuredResults.length} results`);
          return {
            type: 'structured_search',
            results: structuredResults,
            searchParams: searchParams
          };
        }
      }

      // Fall back to semantic search
      console.log('🔄 Falling back to semantic search...');
      const semanticResults = await this.retriever.searchSuppliers(message);

      if (semanticResults && semanticResults.length > 0) {
        console.log(`✅ Semantic search found ${semanticResults.length} results`);
        return {
          type: 'semantic_search',
          results: semanticResults,
          query: message
        };
      }

      // If both fail, try a simple fallback
      console.log('🔄 Trying simple fallback search...');
      const fallbackResults = await this.actions.searchSuppliers({ limit: 10, sortBy: 'rating' });

      return {
        type: 'structured_search',
        results: fallbackResults,
        searchParams: { ...searchParams, fallback: true }
      };

    } catch (error) {
      console.error('❌ Error in supplier search handler:', error);
      return {
        type: 'error',
        message: 'Search temporarily unavailable',
        searchParams: searchParams
      };
    }
  }

  /**
   * Handle RFQ generation requests - SIMPLIFIED VERSION
   */
  async handleRFQGeneration(message, intent, session) {
    console.log('📋 Handling RFQ generation (simplified)...');

    try {
      // Extract context from conversation history
      const conversationContext = this.extractContextFromHistory(session.messages);
      console.log('📝 Extracted context:', conversationContext);

      // Get parameters from intent and conversation
      let material = intent.parameters.material;
      let quantity = intent.parameters.quantity || (intent.parameters.quantities ? intent.parameters.quantities[0] : null);
      let suppliers = intent.parameters.suppliers || [];
      let supplierCount = 2; // Default to 2 suppliers

      console.log('📝 Intent parameters:', {
        material: intent.parameters.material,
        quantity: intent.parameters.quantity,
        suppliers: intent.parameters.suppliers
      });

      // Get material from conversation if not in intent
      if (!material && conversationContext.mentionedMaterials.length > 0) {
        material = conversationContext.mentionedMaterials[0]; // Most recent
        console.log('📝 Using material from conversation:', material);
      }

      // Get quantity from conversation if not in intent
      if (!quantity && conversationContext.quantities.length > 0) {
        quantity = parseInt(conversationContext.quantities[conversationContext.quantities.length - 1]);
        console.log('📝 Using quantity from conversation:', quantity);
      }

      // Determine supplier count based on user request
      if (suppliers && suppliers.length > 0) {
        supplierCount = Math.max(1, suppliers.length); // Use specified suppliers count
        console.log(`📝 User specified ${supplierCount} suppliers:`, suppliers);
      }

      // Determine product name from material or conversation
      let productName = material;
      if (!productName) {
        // Try to extract product from current message first
        const productKeywords = ['usb hub', 'steel beam', 'plastic mold case', 'cement bag', 'shipping container', 'power supply', 'cables', 'connectors'];
        for (const keyword of productKeywords) {
          if (message.toLowerCase().includes(keyword)) {
            productName = keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            console.log(`📝 Found product in current message: ${productName}`);
            break;
          }
        }

        // If not found in current message, check conversation history
        if (!productName) {
          for (const msg of session.messages.slice(-5)) {
            for (const keyword of productKeywords) {
              if (msg.message.toLowerCase().includes(keyword)) {
                productName = keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                console.log(`📝 Found product in conversation: ${productName}`);
                break;
              }
            }
            if (productName) break;
          }
        }
      }

      // Default values if still missing
      if (!productName) productName = 'USB Hub'; // Changed default to USB Hub
      if (!quantity) quantity = 1;

      console.log(`🎯 RFQ Parameters: Product=${productName}, Quantity=${quantity}, Suppliers=${supplierCount}`);

      // Generate RFQ using simple generator
      const rfqData = await this.simpleRFQGenerator.generateRFQ(productName, quantity, supplierCount);

      // Store RFQ in session for order processing
      session.context.lastRFQ = rfqData;
      session.context.lastRFQMessage = this.simpleRFQGenerator.formatRFQResponse(rfqData);

      return {
        type: 'simple_rfq_success',
        message: this.simpleRFQGenerator.formatRFQResponse(rfqData),
        rfqData: rfqData,
        parameters: intent.parameters
      };

    } catch (error) {
      console.error('❌ Error in simple RFQ generation:', error);
      return {
        type: 'rfq_error',
        message: `❌ RFQ generation failed: ${error.message}`,
        error: error.message,
        parameters: intent.parameters
      };
    }
  }

  /**
   * Handle order placement requests - SIMPLIFIED VERSION
   */
  async handleOrderPlacement(message, intent, session) {
    console.log('🛒 Handling order placement (simplified)...');

    try {
      // Check if we have RFQ context from previous conversation
      const lastRFQ = session.context.lastRFQ;

      if (!lastRFQ) {
        return {
          type: 'order_error',
          message: '❌ No recent RFQ found. Please generate an RFQ first before placing an order.',
          error: 'No RFQ context available'
        };
      }

      // Extract company number from message
      let companyNumber = 1; // Default to first company
      const companyMatch = message.match(/company\s+(\d+)/i);
      if (companyMatch) {
        companyNumber = parseInt(companyMatch[1]);
      }

      console.log(`🎯 Placing order with Company ${companyNumber}`);

      // Use simple RFQ generator to place order
      const orderResult = await this.simpleRFQGenerator.placeOrder(lastRFQ, companyNumber, message);

      if (orderResult.success) {
        // Clear RFQ context after successful order
        session.context.lastRFQ = null;

        return {
          type: 'simple_order_success',
          message: orderResult.message,
          orderData: orderResult.orderData,
          parameters: intent.parameters
        };
      } else {
        return {
          type: 'order_error',
          message: orderResult.message || '❌ Order placement failed',
          error: orderResult.error,
          parameters: intent.parameters
        };
      }

    } catch (error) {
      console.error('❌ Error in simple order placement:', error);
      return {
        type: 'order_error',
        message: `❌ Order processing failed: ${error.message}`,
        error: error.message,
        parameters: intent.parameters
      };
    }
  }

  /**
   * Handle inventory check requests
   */
  async handleInventoryCheck(message, intent) {
    console.log('📦 Handling inventory check...');
    
    const inventoryParams = intent.parameters;
    const inventory = await this.actions.getInventoryStatus(inventoryParams);
    
    return {
      type: 'inventory_status',
      inventory: inventory,
      parameters: inventoryParams
    };
  }

  /**
   * Handle semantic search queries
   */
  async handleSemanticSearch(message, intent) {
    console.log('🔍 Handling semantic search...');
    
    const semanticResults = await this.retriever.semanticSearch(message);
    
    return {
      type: 'semantic_results',
      results: semanticResults,
      query: message
    };
  }

  /**
   * Handle general chat queries
   */
  async handleGeneralChat(message, intent) {
    console.log('💬 Handling general chat...');
    
    // Get general procurement context
    const context = await this.actions.getProcurementContext();
    
    return {
      type: 'general_chat',
      context: context,
      query: message
    };
  }

  /**
   * Generate fallback response for errors
   */
  generateFallbackResponse(intentType, context) {
    // If called with just message (old signature), handle it
    if (typeof intentType === 'string' && !context) {
      const fallbacks = [
        "I apologize, but I'm having trouble processing your request right now. Could you please try rephrasing your question?",
        "I'm experiencing some technical difficulties. However, I can still help you with basic procurement tasks. What would you like to do?",
        "Sorry, I encountered an error. Please try asking about suppliers, materials, or inventory management.",
        "I'm having trouble understanding that request. Could you please be more specific about what you need help with?"
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // Generate specific responses based on intent type and context
    switch (intentType) {
      case 'SUPPLIER_SEARCH':
        if (context && context.results && context.results.length > 0) {
          return this.formatSupplierResults(context.results);
        }
        return "I couldn't find exact matches for that product, but let me search for similar suppliers. Try searching for the broader material category (e.g., 'Connectors' for USB hubs, 'Electronic Components' for circuit boards).";

      case 'RFQ_GENERATION':
        return "I can help you create an RFQ, but I need more information. Please specify the supplier name and materials you need.";

      case 'INVENTORY_CHECK':
        return "I can check your inventory status. Currently showing basic inventory information.";

      default:
        return "I'm here to help with procurement tasks. You can ask me to find suppliers, create RFQs, or check inventory.";
    }
  }

  /**
   * Format supplier results for fallback response
   */
  formatSupplierResults(suppliers) {
    if (!suppliers || suppliers.length === 0) {
      return "No suppliers found matching your criteria.";
    }

    let response = `I found ${suppliers.length} suppliers:\n\n`;

    suppliers.slice(0, 3).forEach((supplier, index) => {
      response += `[${supplier.name}]\n`;
      response += `Rating: ${supplier.rating}/5\n`;
      response += `Lead Time: ${supplier.leadTime}\n`;
      response += `Contact: ${supplier.contact}\n\n`;
    });

    response += "Would you like more details about any of these suppliers?";
    return response;
  }

  /**
   * Extract relevant context from conversation history
   */
  extractContextFromHistory(messages) {
    const context = {
      mentionedSuppliers: [],
      mentionedMaterials: [],
      quantities: [],
      lastSupplierSearch: null,
      recentSuppliers: [] // Track most recent suppliers in order
    };

    // Look through recent messages for context (reverse order to get most recent first)
    const recentMessages = messages.slice(-10).reverse(); // Last 10 messages, most recent first

    for (const msg of recentMessages) {
      if (msg.role === 'assistant' && msg.message) {
        // Extract supplier names from AI responses (look for [SupplierName] format)
        const supplierMatches = msg.message.match(/\[([^\]]+)\]/g);
        if (supplierMatches) {
          supplierMatches.forEach(match => {
            const supplierName = match.replace(/[\[\]]/g, '');
            // Add to recent suppliers (most recent first)
            if (!context.recentSuppliers.includes(supplierName)) {
              context.recentSuppliers.unshift(supplierName);
            }
            if (!context.mentionedSuppliers.includes(supplierName)) {
              context.mentionedSuppliers.push(supplierName);
            }
          });
        }

        // If this was a supplier search response, store it (most recent one)
        if (msg.intent === 'SUPPLIER_SEARCH' && !context.lastSupplierSearch) {
          context.lastSupplierSearch = {
            message: msg.message,
            timestamp: msg.timestamp,
            suppliers: supplierMatches ? supplierMatches.map(m => m.replace(/[\[\]]/g, '')) : []
          };
        }
      }

      if (msg.role === 'user' && msg.message) {
        // Extract materials/products mentioned by user (expanded list)
        const materialKeywords = [
          'connector', 'connectors', 'usb hub', 'usb hubs', 'cable', 'cables',
          'laptop', 'laptops', 'chair', 'chairs', 'steel', 'aluminum',
          'circuit board', 'circuit boards', 'plastic mold case', 'power supply',
          'cement bag', 'shipping container', 'wooden pallet',
          'steel beam', 'steel beams', 'beam', 'beams', 'steel components',
          'casting materials', 'fasteners', 'industrial fasteners'
        ];

        // Sort keywords by length (longer/more specific first)
        const sortedKeywords = materialKeywords.sort((a, b) => b.length - a.length);

        sortedKeywords.forEach(keyword => {
          if (msg.message.toLowerCase().includes(keyword) && !context.mentionedMaterials.includes(keyword)) {
            // Add to beginning for more recent/specific materials
            context.mentionedMaterials.unshift(keyword);
          }
        });

        // Extract quantities - more flexible patterns
        const quantityMatches = msg.message.match(/(\d+)\s*(unit|piece|item|qty|quantities|pcs|pieces)?/gi);
        if (quantityMatches) {
          quantityMatches.forEach(match => {
            const qty = match.match(/\d+/)[0];
            if (!context.quantities.includes(qty)) {
              context.quantities.push(qty);
            }
          });
        }

        // Also extract standalone numbers that might be quantities
        const standaloneNumbers = msg.message.match(/\b(\d+)\b/g);
        if (standaloneNumbers) {
          standaloneNumbers.forEach(num => {
            if (parseInt(num) > 0 && parseInt(num) < 10000 && !context.quantities.includes(num)) {
              context.quantities.push(num);
            }
          });
        }
      }
    }

    return context;
  }
}

module.exports = { AIChatRouter };
