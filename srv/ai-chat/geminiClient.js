/**
 * Gemini Client - Response generation with context and function calling
 * Handles final response generation using retrieved context
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const apiKeyManager = require('./apiKeyManager');
const { HuggingFaceClient } = require('./huggingfaceClient');
require('dotenv').config();

class GeminiClient {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.chatSessions = new Map();
    this.apiKeyManager = apiKeyManager;
    this.huggingFaceClient = new HuggingFaceClient();
    this.initializeWithCurrentKey();
  }

  /**
   * Initialize Gemini with current API key
   */
  initializeWithCurrentKey() {
    try {
      const currentKey = this.apiKeyManager.getCurrentKey();
      this.genAI = new GoogleGenerativeAI(currentKey);
      console.log('🔑 Gemini client initialized with current API key');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  async initialize() {
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });
  }

  /**
   * Generate response using context from RAG or structured queries
   * @param {string} userMessage - Original user message
   * @param {Object} context - Retrieved context from RAG/APIs
   * @param {Object} intent - Detected intent and parameters
   * @param {string} sessionId - Chat session ID
   * @returns {Object} - Generated response with actions
   */
  async generateResponse(userMessage, context, intent, sessionId) {
    let retryCount = 0;
    const maxRetries = this.apiKeyManager.getStatus().totalKeys;

    while (retryCount < maxRetries) {
      try {
        if (!this.model) {
          await this.initialize();
        }

        const prompt = this.buildContextualPrompt(userMessage, context, intent);

        // Get or create chat session
        let chat = this.chatSessions.get(sessionId);
        if (!chat) {
          chat = this.model.startChat({
            history: this.getInitialHistory()
          });
          this.chatSessions.set(sessionId, chat);
        }

        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse response for actions
        const parsedResponse = this.parseResponseForActions(text);

        return {
          text: parsedResponse.text,
          actions: parsedResponse.actions,
          context: context
        };

      } catch (error) {
        console.error(`❌ Error generating response (attempt ${retryCount + 1}):`, error);

        // Check if it's a quota/rate limit error
        if (this.apiKeyManager.isQuotaError(error)) {
          console.log('🔄 Attempting to rotate API key...');
          const rotated = this.apiKeyManager.markCurrentKeyAsFailed(error);

          if (rotated) {
            // Reinitialize with new key
            this.initializeWithCurrentKey();
            await this.initialize();
            // Clear chat sessions to start fresh with new key
            this.chatSessions.clear();
            retryCount++;
            continue; // Retry with new key
          }
        }

        // If not a quota error or no more keys available, try Hugging Face
        break;
      }
    }

    // Try Hugging Face as fallback
    try {
      console.log('🤗 Falling back to Hugging Face for response generation...');
      const prompt = this.buildContextualPrompt(userMessage, context, intent);
      const hfResponse = await this.huggingFaceClient.generateResponse(prompt, context);

      const parsedResponse = this.parseResponseForActions(hfResponse);

      return {
        text: parsedResponse.text,
        actions: parsedResponse.actions,
        context: context
      };
    } catch (hfError) {
      console.error('❌ Hugging Face response generation failed:', hfError);
    }

    // Final fallback - error response
    return {
      text: this.generateErrorResponse(userMessage, intent),
      actions: [],
      context: context
    };
  }

  /**
   * Build contextual prompt based on intent and retrieved data
   */
  buildContextualPrompt(userMessage, context, intent) {
    let prompt = `
You are an AI-powered procurement assistant. Respond to the user's query using the provided context and conversation history.

USER QUERY: "${userMessage}"
DETECTED INTENT: ${intent.type}
CONFIDENCE: ${intent.confidence}

`;

    // Add conversation history if available
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      prompt += `
CONVERSATION HISTORY (last ${context.conversationHistory.length} messages):
`;
      context.conversationHistory.forEach((msg, index) => {
        const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
        prompt += `${index + 1}. ${role}: ${msg.message}\n`;
      });
      prompt += `\n`;
    }

    // Add context based on intent type
    switch (intent.type) {
      case 'SUPPLIER_SEARCH':
        prompt += this.buildSupplierSearchPrompt(context);
        break;
      case 'RFQ_GENERATION':
        prompt += this.buildRFQPrompt(context);
        break;
      case 'ORDER_PLACEMENT':
        prompt += this.buildOrderPrompt(context);
        break;
      case 'INVENTORY_CHECK':
        prompt += this.buildInventoryPrompt(context);
        break;
      case 'SEMANTIC_SEARCH':
        prompt += this.buildSemanticPrompt(context);
        break;
      default:
        prompt += this.buildGeneralPrompt(context);
    }

    prompt += `

RESPONSE FORMATTING REQUIREMENTS:
1. Use clean, professional structure with proper line breaks
2. Start with a brief, direct answer to the user's question
3. Use square brackets [Name] for supplier/item names
4. NO asterisks (*), NO bullet points (•), NO bold formatting (**)
5. Each line should be separate with line breaks
6. Use minimal emojis (maximum 1 per response)
7. Keep each line short and readable
8. End with clear next steps

RESPONSE STRUCTURE TEMPLATE:
[Brief direct answer]
[Line break]
[Main content with proper line breaks]
[Line break]
[Next steps]

FORMATTING RULES:
- Use [SupplierName] instead of **SupplierName**
- Use line breaks instead of bullet points
- No asterisks or bold formatting
- Each piece of information on a new line
- Clean, simple structure

AVAILABLE ACTIONS:
- [ACTION:open_supplier_details:supplier_id] - Open supplier details dialog
- [ACTION:create_rfq:supplier_ids] - Create RFQ for suppliers
- [ACTION:place_order:rfq_id] - Place order from RFQ
- [ACTION:check_inventory:filters] - Check inventory with filters
- [ACTION:export_data:type] - Export data (suppliers/materials)

EXAMPLE GOOD FORMATTING:
"Here are the top 3 rated aluminum suppliers in Asia:

[DynamicLogistics] Rating: 4.9/5
Lead Time: 2-3 weeks
Contact: dynamiclogistics@bizconnect.io

[NovaInc] Rating: 4.9/5
Lead Time: 1 month
Contact: novainc@logix.com

[BlueCorporation] Rating: 4.7/5
Lead Time: 2-3 weeks
Contact: bluecorporation@logix.com

Next Steps: Would you like to:
View more details on any of these suppliers?
Proceed with creating a Request for Quotation (RFQ)?
Refine your search parameters?

Please let me know your preference."

Respond naturally and helpfully:`;

    return prompt;
  }

  /**
   * Build supplier search specific prompt
   */
  buildSupplierSearchPrompt(context) {
    if (context.type === 'structured_search' && context.results) {
      return `
SUPPLIER SEARCH RESULTS:
Found ${context.results.length} suppliers matching your criteria.

SUPPLIER LIST:
${context.results.map((supplier, index) => `
[${supplier.name}] Rating: ${supplier.rating}/5
Lead Time: ${supplier.leadTime}
Contact: ${supplier.contact}
Region: ${supplier.region}
Category: ${supplier.category}
Material: ${supplier.material}
`).join('')}

SEARCH PARAMETERS: ${JSON.stringify(context.searchParams)}

FORMAT YOUR RESPONSE AS:
- Use [SupplierName] format for names
- Each piece of info on separate line
- No asterisks or bullet points
- Clean line breaks between sections
- Minimal emojis (maximum 1)
- End with clear next steps
`;
    } else if (context.type === 'semantic_search' && context.results) {
      return `
SEMANTIC SEARCH RESULTS:
Found ${context.results.length} relevant suppliers based on similarity.

SUPPLIER LIST:
${context.results.map((result, index) => `
${index + 1}. ${result.supplier.name}
   Similarity Score: ${(result.score * 100).toFixed(1)}%
   Region: ${result.supplier.region}
   Category: ${result.supplier.category}
   Material: ${result.supplier.material}
   Rating: ${result.supplier.rating}/5
`).join('')}

FORMAT YOUR RESPONSE AS:
- Clean, professional structure
- Proper spacing between sections
- Clear headings
- Bullet points for lists
- Minimal emojis (only 1-2 per response)
- Suggest next actions at the end
`;
    }
    return 'No supplier results found.';
  }

  /**
   * Build RFQ generation specific prompt
   */
  buildRFQPrompt(context) {
    if (context.type === 'rfq_generation') {
      return `
RFQ GENERATION CONTEXT:
Suppliers: ${context.suppliers.map(s => s.name).join(', ')}
Available Products: ${context.products.length} products found

SUPPLIER DETAILS:
${context.suppliers.map(supplier => `
[${supplier.name}]
Category: ${supplier.category}
Region: ${supplier.region}
Rating: ${supplier.rating}/5
Lead Time: ${supplier.leadTime}
Contact: ${supplier.contact}
Material: ${supplier.material}
`).join('')}

PRODUCTS AVAILABLE:
${context.products.slice(0, 5).map(product => `
${product.name}: ${product.price} ${product.currency}/${product.unit}
`).join('')}

CONTEXT AWARENESS RULES:
- REMEMBER CONVERSATION HISTORY: Use suppliers and materials mentioned in previous messages
- If user previously mentioned a material (connectors, aluminum, steel, plastic, etc.), don't ask for it again
- If user previously mentioned quantities (5 units, 10 pieces, etc.), use those quantities
- If suppliers were mentioned in previous messages, use those suppliers for RFQ
- Only ask for missing information that wasn't mentioned before
- Generate pricing estimate immediately if you have material, supplier, and quantity info
- Use this pricing format:
  Material Name (X units): $XX.XX
  Tax (18%): $XX.XX
  Shipping: $40.00
  Total Estimated: $XXX.XX

CONVERSATION CONTEXT USAGE:
- ALWAYS check conversation history for previously mentioned suppliers, materials, and quantities
- If user says "create RFQ" or "generate RFQ" without specifying details, use information from previous messages
- If user mentions quantities like "5 quantities" or "5 units", apply to the most recently discussed material/product
- Reference previous supplier search results when generating RFQ
- Don't ask for information that was already provided in the conversation
- If user asks for RFQ for "both" suppliers, use the suppliers from the previous search
- NEVER ask for material again if it was mentioned in recent conversation

CRITICAL RFQ RULES:
- When user says "create RFQ for both" → Use suppliers from previous search
- When user says "5 quantities" → Apply to the most recent material/product discussed
- When user mentions a product (USB Hub, Circuit Board) → Remember it for subsequent RFQ requests
- Generate RFQ immediately if you have: suppliers + material + quantity from conversation
`;
    } else if (context.type === 'backend_rfq_success') {
      return `
BACKEND RFQ PROCESSING COMPLETED:
The RFQ has been processed by the backend system with detailed pricing.

FORMATTED RFQ MESSAGE:
${context.message}

QUICK ACTION MENU:
After displaying the RFQ, add these action buttons:
- [ACTION:create_po:${context.rfqResponse.rfqId}] Create Purchase Order
- [ACTION:modify_rfq:${context.rfqResponse.rfqId}] Modify RFQ
- [ACTION:export_rfq:${context.rfqResponse.rfqId}] Export RFQ

INSTRUCTIONS:
- Display the formatted RFQ message exactly as provided
- Add the quick action menu buttons after the RFQ
- The message contains all supplier information and pricing details
- Do not modify the formatting or content of the RFQ itself
- The backend has already calculated all pricing and details
`;
    } else if (context.type === 'backend_rfq_error') {
      return `
BACKEND RFQ PROCESSING FAILED:
Error: ${context.error}

INSTRUCTIONS:
- Inform the user that RFQ processing failed
- Display the error message: ${context.message}
- Suggest they try again or provide more specific information
`;
    } else if (context.type === 'rfq_with_pricing') {
      return `
RFQ WITH PRICING ESTIMATE:
Supplier: [${context.supplier.name}]
Material: ${context.material}
Quantity: ${context.quantity}

PRICING BREAKDOWN:
${context.material} (${context.quantity} units): $${context.estimate.subtotal.toFixed(2)}
Tax (18%): $${context.estimate.tax.toFixed(2)}
Shipping: $${context.estimate.shipping.toFixed(2)}
Total Estimated: $${context.estimate.total.toFixed(2)}

SUPPLIER DETAILS:
Rating: ${context.supplier.rating}/5
Lead Time: ${context.supplier.leadTime}
Contact: ${context.supplier.contact}

FORMAT RESPONSE AS:
Show the pricing breakdown exactly as provided above.
Ask if user wants to place the order.
Use clean line breaks and [SupplierName] format.
`;
    } else if (context.type === 'rfq_need_quantity') {
      return `
RFQ QUANTITY REQUEST:
Supplier: [${context.supplier.name}]
Material: ${context.material}

SUPPLIER DETAILS:
Rating: ${context.supplier.rating}/5
Lead Time: ${context.supplier.leadTime}
Contact: ${context.supplier.contact}

FORMAT RESPONSE AS:
Ask only for quantity (how many units).
Don't ask for material since it's already known.
Use clean formatting with line breaks.
`;
    } else if (context.type === 'rfq_with_multiple_pricing') {
      return `
MULTIPLE RFQs WITH PRICING:
Material: ${context.material}
Quantity: ${context.quantity}

RFQ DETAILS:
${context.rfqResults.map(rfq => `
[${rfq.supplier.name}]
Region: ${rfq.supplier.region}
Rating: ${rfq.supplier.rating}/5
Lead Time: ${rfq.supplier.leadTime}
Contact: ${rfq.supplier.contact}
${rfq.estimate ? `
PRICING ESTIMATE:
${rfq.estimate.productName} (${rfq.quantity} units): $${rfq.estimate.materialCost}
Tax (18%): $${rfq.estimate.taxAmount}
Shipping: $${rfq.estimate.shippingCost}
Total Estimated: $${rfq.estimate.totalEstimate}
Unit Price: $${rfq.estimate.unitPrice}
` : `
PRICING: Contact supplier for quote
`}
`).join('\n')}

FORMAT RESPONSE AS:
Show all RFQ details with pricing estimates clearly formatted.
Use [SupplierName] format for supplier names.
Include next steps like "Would you like to place an order with any of these suppliers?"
Use clean line breaks and professional formatting.
`;
    } else if (context.type === 'rfq_suggestion') {
      return `
RFQ SUGGESTIONS:
Based on your materials, here are suggested suppliers:

${context.suggestedSuppliers.map(supplier => `
[${supplier.name}]
Category: ${supplier.category}
Material: ${supplier.material}
Rating: ${supplier.rating}/5
`).join('')}

REQUESTED MATERIALS: ${context.materials.join(', ')}

CONTEXT AWARENESS RULES:
- User already specified materials: ${context.materials.join(', ')}
- Only ask for quantities, not materials again
- Generate pricing estimate if possible
`;
    }
    return 'RFQ generation context not available.';
  }

  /**
   * Build order placement specific prompt
   */
  buildOrderPrompt(context) {
    if (context.type === 'backend_order_success') {
      return `
BACKEND ORDER PROCESSING COMPLETED:
The purchase order has been successfully processed by the backend system.

FORMATTED ORDER CONFIRMATION:
${context.message}

INSTRUCTIONS:
- Display the formatted order confirmation exactly as provided
- The message contains all order details and inventory updates
- Do not modify the formatting or content
- Simply present the information to the user
- The backend has already created the purchase order and updated inventory
`;
    } else if (context.type === 'backend_order_error') {
      return `
BACKEND ORDER PROCESSING FAILED:
Error: ${context.error}

INSTRUCTIONS:
- Inform the user that order processing failed
- Display the error message: ${context.message}
- Suggest they try generating an RFQ first or provide more specific information
`;
    } else if (context.type === 'order_error') {
      return `
ORDER PROCESSING ERROR:
${context.message}

INSTRUCTIONS:
- Display the error message to the user
- Suggest they generate an RFQ first before placing an order
`;
    } else if (context.type === 'order_from_rfq') {
      return `
ORDER PLACEMENT CONTEXT:
RFQ Details: ${JSON.stringify(context.rfqDetails, null, 2)}

Ready to place order based on the RFQ.
`;
    } else if (context.type === 'direct_order') {
      return `
DIRECT ORDER ESTIMATE:
${JSON.stringify(context.estimate, null, 2)}

Order estimate calculated for direct placement.
`;
    }
    return 'Order placement context not available.';
  }

  /**
   * Build inventory check specific prompt
   */
  buildInventoryPrompt(context) {
    if (context.inventory) {
      return `
INVENTORY STATUS:
Total Materials: ${context.inventory.totalMaterials}
Low Stock Items: ${context.inventory.lowStockCount}
Categories: ${context.inventory.categories.join(', ')}

RECENT MATERIALS:
${context.inventory.recentMaterials.map(material => `
- ${material.name}: ${material.quantity} units (${material.stockStatus})
  Supplier: ${material.supplierName}
`).join('')}
`;
    }
    return 'Inventory information not available.';
  }

  /**
   * Build semantic search specific prompt
   */
  buildSemanticPrompt(context) {
    if (context.results) {
      return `
SEMANTIC SEARCH RESULTS:
Found ${context.results.length} relevant items:

${context.results.map((result, index) => `
${index + 1}. **${result.data.name}** (${result.type})
   Similarity: ${(result.score * 100).toFixed(1)}%
   ${result.type === 'supplier' ? `Region: ${result.data.region}, Rating: ${result.data.rating}/5` : ''}
`).join('')}
`;
    }
    return 'No semantic search results found.';
  }

  /**
   * Build general chat prompt
   */
  buildGeneralPrompt(context) {
    return `
PROCUREMENT SYSTEM CONTEXT:
Total Materials: ${context.materialsCount || 0}
Total Suppliers: ${context.suppliersCount || 0}
System Status: Active

AVAILABLE FEATURES:
Supplier search and management
RFQ generation and processing
Order placement and tracking
Inventory management

FORMAT YOUR RESPONSE AS:
- Professional and helpful tone
- Clean structure with line breaks
- No bullet points or asterisks
- Minimal emojis (maximum 1)
- Each option on separate line
- Suggest specific next actions
`;
  }

  /**
   * Parse response for embedded actions
   */
  parseResponseForActions(text) {
    const actionRegex = /\[ACTION:([^:]+):([^\]]+)\]/g;
    const actions = [];
    let cleanText = text;

    let match;
    while ((match = actionRegex.exec(text)) !== null) {
      actions.push({
        type: match[1],
        parameters: match[2]
      });
      cleanText = cleanText.replace(match[0], '');
    }

    return {
      text: cleanText.trim(),
      actions: actions
    };
  }

  /**
   * Generate error response
   */
  generateErrorResponse(userMessage, intent) {
    const errorResponses = {
      'SUPPLIER_SEARCH': "I'm having trouble searching for suppliers right now. Could you try being more specific about the type of supplier or region you're looking for?",
      'RFQ_GENERATION': "I encountered an issue generating the RFQ. Please specify the supplier name and materials you need quotes for.",
      'ORDER_PLACEMENT': "I'm unable to process the order at the moment. Please check if you have a valid RFQ ID or supplier information.",
      'INVENTORY_CHECK': "I can't access the inventory system right now. Please try again in a moment.",
      'SEMANTIC_SEARCH': "The similarity search is temporarily unavailable. Try using specific search terms instead.",
      'GENERAL_CHAT': "I'm experiencing some technical difficulties. However, I can still help you with basic procurement tasks."
    };

    return errorResponses[intent.type] || "I apologize, but I'm having trouble processing your request. Please try rephrasing your question.";
  }

  /**
   * Get initial chat history for new sessions
   */
  getInitialHistory() {
    return [
      {
        role: 'user',
        parts: [{ text: 'You are an AI-powered procurement assistant helping customers find suppliers and procure materials. Your role is to:\n\n1. FIND EXISTING SUPPLIERS - Never ask to add new suppliers to the system\n2. HELP CUSTOMERS PROCURE - Focus on helping customers buy materials from existing suppliers\n3. PROVIDE SUPPLIER OPTIONS - Always try to find suppliers that match or are similar to what customers need\n4. CREATE RFQs AND ORDERS - Help customers place orders with existing suppliers\n5. MAINTAIN CONTEXT - Remember previous conversation details\n\nNEVER ask customers to:\n- Add new suppliers to the system\n- Provide supplier details to add to database\n- Broaden search criteria\n- Add more information to the system\n\nALWAYS:\n- Focus on existing suppliers in the database\n- Suggest similar materials/suppliers if exact match not found\n- Help create RFQs and orders\n- Remember context from previous messages\n\nUse clean formatting with proper line breaks and [SupplierName] format.' }]
      },
      {
        role: 'model',
        parts: [{ text: 'Hello! I\'m your AI-powered procurement assistant.\nI can help you find suppliers and procure materials from our existing supplier network.\nHow can I assist you today?' }]
      }
    ];
  }

  /**
   * Clear chat session
   */
  clearSession(sessionId) {
    this.chatSessions.delete(sessionId);
  }

  /**
   * Get session count
   */
  getSessionCount() {
    return this.chatSessions.size;
  }
}

module.exports = { GeminiClient };
