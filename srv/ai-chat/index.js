/**
 * AI Chat Router - Main entry point for AI-powered procurement chat
 * Handles routing between different agents and RAG systems
 */

const { Agent } = require('./agent');
const { PineconeRetriever } = require('./retriever');
const { GeminiClient } = require('./geminiClient');
const { ProcurementActions } = require('./actions');
const RFQProcessor = require('../rfq-processor');
const PurchaseOrderProcessor = require('../purchase-order-processor');

class AIChatRouter {
  constructor() {
    this.agent = new Agent();
    this.retriever = new PineconeRetriever();
    this.geminiClient = new GeminiClient();
    this.actions = new ProcurementActions();
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
          const rfqContext = await this.handleRFQGeneration(message, intent, session);
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
      
      // Step 3: Generate final response using Gemini or fallback
      let response;
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
   * Handle RFQ generation requests with conversation context
   */
  async handleRFQGeneration(message, intent, session) {
    console.log('📋 Handling RFQ generation with conversation history...');

    const rfqParams = intent.parameters;

    // Extract context from conversation history
    const conversationContext = this.extractContextFromHistory(session.messages);
    console.log('📝 Extracted context from conversation:', conversationContext);

    // Use conversation context to fill in missing information
    let suppliers = [];
    let material = rfqParams.material;
    let quantity = rfqParams.quantities ? rfqParams.quantities[0] : null;

    // Get suppliers from conversation context if not specified
    if (rfqParams.suppliers && rfqParams.suppliers.length > 0) {
      const supplierName = rfqParams.suppliers[0];
      suppliers = await this.actions.searchSuppliers({
        searchText: supplierName,
        limit: 1
      });
    } else if (conversationContext.recentSuppliers.length > 0) {
      // Use most recent suppliers from conversation (prioritize order)
      console.log('📝 Using recent suppliers from conversation context:', conversationContext.recentSuppliers);
      for (const supplierName of conversationContext.recentSuppliers.slice(0, 3)) {
        const foundSuppliers = await this.actions.searchSuppliers({
          searchText: supplierName,
          limit: 1
        });
        if (foundSuppliers.length > 0) {
          suppliers.push(foundSuppliers[0]);
          console.log(`✅ Found supplier: ${supplierName}`);
        } else {
          console.log(`❌ Supplier not found: ${supplierName}`);
        }
      }
    } else if (conversationContext.mentionedSuppliers.length > 0) {
      // Fallback to any mentioned suppliers
      console.log('📝 Using any mentioned suppliers:', conversationContext.mentionedSuppliers);
      for (const supplierName of conversationContext.mentionedSuppliers.slice(0, 3)) {
        const foundSuppliers = await this.actions.searchSuppliers({
          searchText: supplierName,
          limit: 1
        });
        if (foundSuppliers.length > 0) {
          suppliers.push(foundSuppliers[0]);
        }
      }
    }

    // Get material from conversation context if not specified (prioritize most recent)
    if (!material && conversationContext.mentionedMaterials.length > 0) {
      // Use the most recently mentioned material
      material = conversationContext.mentionedMaterials[conversationContext.mentionedMaterials.length - 1];
      console.log('📝 Using material from conversation context:', material);
    }

    // Get quantity from conversation context if not specified (prioritize most recent)
    if (!quantity && conversationContext.quantities.length > 0) {
      // Use the most recently mentioned quantity
      quantity = parseInt(conversationContext.quantities[conversationContext.quantities.length - 1]);
      console.log('📝 Using quantity from conversation context:', quantity);
    }

    console.log('📋 RFQ Context Summary:');
    console.log('  - Suppliers found:', suppliers.length);
    console.log('  - Material:', material);
    console.log('  - Quantity:', quantity);
    console.log('  - From conversation:', {
      suppliers: conversationContext.mentionedSuppliers,
      materials: conversationContext.mentionedMaterials,
      quantities: conversationContext.quantities
    });

    // Always try to use backend RFQ service if we have material and quantity
    if (material && quantity) {
      // If no suppliers found, search for them based on material
      if (suppliers.length === 0) {
        console.log('🔍 No suppliers found in context, searching for suppliers...');
        const searchResults = await this.actions.searchSuppliers({
          material: material,
          limit: 5
        });
        if (searchResults && searchResults.length > 0) {
          suppliers = searchResults;
          console.log(`✅ Found ${suppliers.length} suppliers for material: ${material}`);
        }
      }

      if (suppliers.length > 0) {
        // Use unified RFQ service
        try {
          console.log('🔄 Calling unified RFQ service...');

          // Call the unified RFQ service
          const response = await fetch('http://localhost:4005/odata/v4/procurement/generateRFQ', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              suppliers: JSON.stringify(suppliers), // Convert suppliers array to string
              material: material,
              product: material, // Use material as product for now
              quantity: quantity
            })
          });

          if (response.ok) {
            const rfqData = await response.json();

            if (rfqData.success) {
              // Store RFQ context in session for order processing
              session.context.lastRFQ = rfqData;

              return {
                type: 'backend_rfq_success',
                message: rfqData.formattedMessage,
                rfqResponse: rfqData,
                parameters: rfqParams
              };
            } else {
              return {
                type: 'backend_rfq_error',
                message: `❌ RFQ generation failed`,
                error: 'RFQ service returned failure',
                parameters: rfqParams
              };
            }
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

        } catch (error) {
          console.error('❌ Error calling unified RFQ service:', error);
          return {
            type: 'backend_rfq_error',
            message: `❌ RFQ processing failed: ${error.message}`,
            error: error.message,
            parameters: rfqParams
          };
        }
      }

    } else if (suppliers.length > 0) {
      return {
        type: 'rfq_need_quantity',
        suppliers: suppliers,
        material: material,
        parameters: rfqParams
      };
    }

    // If no specific suppliers, suggest based on materials
    if (rfqParams.materials && rfqParams.materials.length > 0) {
      const suggestedSuppliers = await this.actions.findSuppliersForMaterials(rfqParams.materials);
      return {
        type: 'rfq_suggestion',
        suggestedSuppliers: suggestedSuppliers,
        materials: rfqParams.materials
      };
    }

    return {
      type: 'rfq_help',
      message: 'I need more information to generate an RFQ. Please specify suppliers or materials.'
    };
  }

  /**
   * Handle order placement requests
   */
  async handleOrderPlacement(message, intent, session) {
    console.log('🛒 Handling order placement...');

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

      // Parse order request from message
      const orderRequest = this.purchaseOrderProcessor.parseOrderRequest(message, lastRFQ);

      try {
        console.log('🔄 Calling unified purchase order service...');

        // Call the unified purchase order service
        const response = await fetch('http://localhost:4005/odata/v4/procurement/createUnifiedPurchaseOrder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            supplierName: orderRequest.supplierName,
            material: orderRequest.material,
            product: orderRequest.product,
            quantity: orderRequest.quantity,
            estimatedTotal: orderRequest.estimatedTotal
          })
        });

        if (response.ok) {
          const orderData = await response.json();

          if (orderData.success) {
            // Clear RFQ context after successful order
            session.context.lastRFQ = null;

            return {
              type: 'backend_order_success',
              message: orderData.formattedMessage,
              orderResponse: orderData,
              parameters: intent.parameters
            };
          } else {
            return {
              type: 'backend_order_error',
              message: `❌ Order processing failed`,
              error: 'Order service returned failure',
              parameters: intent.parameters
            };
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        console.error('❌ Error calling unified purchase order service:', error);
        return {
          type: 'backend_order_error',
          message: `❌ Order processing failed: ${error.message}`,
          error: error.message,
          parameters: intent.parameters
        };
      }

    } catch (error) {
      console.error('❌ Error in order placement:', error);
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
