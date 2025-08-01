sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/MessageStrip",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, MessageToast, MessageBox, MessageStrip, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("procurement.assistant.controller.SimpleModern", {

        onInit: function () {
            console.log("Simple Modern Controller initialized");
            this._initializeModels();
            this._initializeChatSession();
            this._loadInitialData();
        },

        _initializeModels: function () {
            // Main data model
            var oModel = new JSONModel({
                materials: [],
                materialsCount: 0,
                suppliersCount: 0,
                aiInsightsCount: 3,
                chatMessages: [],
                loading: false
            });
            this.getView().setModel(oModel);

            // Chat session model
            var oChatModel = new JSONModel({
                sessionId: null,
                isConnected: false,
                isTyping: false
            });
            this.getView().setModel(oChatModel, "chat");
        },

        _initializeChatSession: function () {
            console.log("Initializing AI chat session...");
            
            fetch('/odata/v4/procurement/initChatSession', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                console.log("Chat session initialized:", data);
                var oChatModel = this.getView().getModel("chat");
                oChatModel.setProperty("/sessionId", data.sessionId);
                oChatModel.setProperty("/isConnected", true);
                
                if (data.welcomeMessage) {
                    this._addChatMessage(data.welcomeMessage, "assistant");
                }
            })
            .catch(error => {
                console.error("Error initializing chat session:", error);
                this._addChatMessage("Welcome! I'm your AI procurement assistant. How can I help you today?", "assistant");
            });
        },

        _loadInitialData: function () {
            this._loadMaterials();
            this._loadSuppliers();
        },

        _loadMaterials: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/loading", true);

            fetch('/odata/v4/procurement/Materials')
                .then(response => response.json())
                .then(data => {
                    console.log("Materials loaded:", data);
                    var materials = data.value || [];
                    
                    oModel.setProperty("/materials", materials);
                    oModel.setProperty("/materialsCount", materials.length);
                    oModel.setProperty("/loading", false);
                    
                    // Update count text
                    var oCountText = this.byId("simpleMaterialsCountText");
                    if (oCountText) {
                        oCountText.setText("Total: " + materials.length + " items");
                    }
                    
                    MessageToast.show("Materials loaded successfully!");
                })
                .catch(error => {
                    console.error("Error loading materials:", error);
                    oModel.setProperty("/loading", false);
                    MessageToast.show("Error loading materials from backend");
                });
        },

        _loadSuppliers: function () {
            fetch('/odata/v4/procurement/Suppliers')
                .then(response => response.json())
                .then(data => {
                    var suppliers = data.value || [];
                    var oModel = this.getView().getModel();
                    oModel.setProperty("/suppliersCount", suppliers.length);
                })
                .catch(error => {
                    console.error("Error loading suppliers:", error);
                });
        },

        // Navigation handlers
        onOpenSettings: function () {
            MessageToast.show("Settings dialog will open");
        },

        onOpenHelp: function () {
            MessageToast.show("Help documentation will open");
        },

        // Tile press handlers
        onMaterialsTilePress: function () {
            MessageToast.show("Materials overview");
        },

        onSuppliersTilePress: function () {
            MessageToast.show("Suppliers overview");
        },

        onAITilePress: function () {
            MessageToast.show("AI insights overview");
        },

        // Quick Action handlers
        onQuickActionCreatePO: function () {
            this._addChatMessage("I'll help you create a Purchase Order. What materials do you need?", "assistant");
            MessageToast.show("PO creation workflow started!");
        },

        onQuickActionSendRFQ: function () {
            this._addChatMessage("I'll help you send a Request for Quotation. Which suppliers should I contact?", "assistant");
            MessageToast.show("RFQ workflow started!");
        },

        onQuickActionFindSuppliers: function () {
            this._addChatMessage("I'll help you find the best suppliers. What type of materials are you looking for?", "assistant");
        },

        onQuickActionCheckInventory: function () {
            this._addChatMessage("Here's your current inventory status. Which materials would you like to check?", "assistant");
        },

        // Chat functionality
        onSendChatMessage: function () {
            var oInput = this.byId("simpleChatInput");
            var sMessage = oInput.getValue().trim();
            
            if (!sMessage) {
                MessageToast.show("Please enter a message");
                return;
            }

            // Add user message
            this._addChatMessage(sMessage, "user");
            
            // Clear input
            oInput.setValue("");
            
            // Show typing indicator
            var oTypingMessage = this._addChatMessage("🤖 Assistant is typing...", "typing");
            
            // Send to AI
            this._sendMessageToAI(sMessage, oTypingMessage);
        },

        _sendMessageToAI: function (sMessage, oTypingMessage) {
            var oChatModel = this.getView().getModel("chat");
            var sSessionId = oChatModel.getProperty("/sessionId");
            
            if (!sSessionId) {
                console.warn("No chat session, initializing...");
                this._initializeChatSession();
                setTimeout(() => this._sendMessageToAI(sMessage, oTypingMessage), 1000);
                return;
            }

            fetch('/odata/v4/procurement/sendChatMessage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: sSessionId,
                    message: sMessage
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log("AI response received:", data);
                
                // Remove typing indicator
                if (oTypingMessage) {
                    var oContainer = this.byId("simpleChatMessagesContainer");
                    oContainer.removeItem(oTypingMessage);
                }
                
                if (data.success && data.response) {
                    this._addChatMessage(data.response, "assistant");
                } else if (data.fallbackResponse) {
                    this._addChatMessage(data.fallbackResponse, "assistant");
                } else {
                    this._addChatMessage("I apologize, but I'm having trouble right now. Please try again.", "assistant");
                }
            })
            .catch(error => {
                console.error("Error sending message to AI:", error);
                
                // Remove typing indicator
                if (oTypingMessage) {
                    var oContainer = this.byId("simpleChatMessagesContainer");
                    oContainer.removeItem(oTypingMessage);
                }
                
                // Fallback response
                var response = this._generateSmartResponse(sMessage);
                this._addChatMessage(response, "assistant");
            });
        },

        _addChatMessage: function (sMessage, sType) {
            var oContainer = this.byId("simpleChatMessagesContainer");
            var sMessageType, sMessageIcon;

            if (sType === "user") {
                sMessageType = "Success";
                sMessageIcon = "👤 You: ";
            } else if (sType === "typing") {
                sMessageType = "None";
                sMessageIcon = "";
            } else {
                sMessageType = "Information";
                sMessageIcon = "🤖 Assistant: ";
            }

            var oMessage = new MessageStrip({
                text: sMessageIcon + sMessage,
                type: sMessageType,
                class: "sapUiMediumMarginBottom"
            });

            oContainer.addItem(oMessage);

            // Scroll to bottom
            setTimeout(() => {
                var oScrollContainer = this.byId("simpleChatScrollContainer");
                if (oScrollContainer) {
                    oScrollContainer.scrollToElement(oMessage);
                }
            }, 100);

            return oMessage;
        },

        _generateSmartResponse: function (sUserMessage) {
            var sMessage = sUserMessage.toLowerCase();

            if (sMessage.includes("laptop") || sMessage.includes("computer")) {
                return "I found 3 suppliers for laptops:\n• TechCorp India - ₹42,000/unit, 7 days delivery\n• Digital Solutions - ₹48,500/unit, 5 days delivery\n• CompuWorld - ₹45,200/unit, 10 days delivery\n\nWould you like me to create a PO or send RFQ?";
            } else if (sMessage.includes("chair") || sMessage.includes("furniture")) {
                return "For office chairs, I recommend:\n• Furniture Plus - ₹8,200/unit, 12 days delivery\n• Office Comfort - ₹7,800/unit, 15 days delivery\n• Ergo Solutions - ₹9,500/unit, 8 days delivery\n\nShall I draft a purchase order?";
            } else if (sMessage.includes("supplier") || sMessage.includes("vendor")) {
                return "Here are our top-rated suppliers:\n🏆 TechCorp India (4.8/5) - Electronics\n🏆 Furniture Plus (4.6/5) - Office Furniture\n🏆 Stationery World (4.7/5) - Office Supplies\n\nWhich category interests you?";
            } else {
                return "I understand you're asking about: '" + sUserMessage + "'. I can help with:\n• Finding suppliers and pricing\n• Creating purchase orders\n• Sending RFQs\n• Checking inventory\n• Compliance verification\n\nTry using the quick action buttons above or ask me something specific!";
            }
        },

        // Search and Filter handlers
        onSearchMaterials: function (oEvent) {
            var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue");
            this._applyFilters();
        },

        onFilterChange: function () {
            this._applyFilters();
        },

        _applyFilters: function () {
            var oTable = this.byId("simpleMaterialsTable");
            var oBinding = oTable.getBinding("items");
            var aFilters = [];

            // Search filter
            var sSearch = this.byId("simpleMaterialSearchField").getValue();
            if (sSearch) {
                var oSearchFilter = new Filter([
                    new Filter("name", FilterOperator.Contains, sSearch),
                    new Filter("ID", FilterOperator.Contains, sSearch),
                    new Filter("supplier_ID", FilterOperator.Contains, sSearch)
                ], false);
                aFilters.push(oSearchFilter);
            }

            // Category filter
            var sCategory = this.byId("simpleCategoryFilter").getSelectedKey();
            if (sCategory) {
                aFilters.push(new Filter("category", FilterOperator.EQ, sCategory));
            }

            // Status filter
            var sStatus = this.byId("simpleStatusFilter").getSelectedKey();
            if (sStatus) {
                aFilters.push(new Filter("stockStatus", FilterOperator.EQ, sStatus));
            }

            oBinding.filter(aFilters);
        },

        // Material CRUD operations
        onAddMaterial: function () {
            MessageToast.show("Add Material dialog will open");
        },

        onEditMaterial: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oMaterial = oContext.getObject();
            MessageToast.show("Edit Material: " + oMaterial.name);
        },

        onDeleteMaterial: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oMaterial = oContext.getObject();
            
            MessageBox.confirm("Are you sure you want to delete '" + oMaterial.name + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._deleteMaterial(oMaterial.ID);
                    }
                }.bind(this)
            });
        },

        _deleteMaterial: function (sMaterialId) {
            fetch('/odata/v4/procurement/Materials(\'' + sMaterialId + '\')', {
                method: 'DELETE'
            })
            .then(() => {
                MessageToast.show("Material deleted successfully");
                this._loadMaterials();
            })
            .catch(error => {
                console.error("Error deleting material:", error);
                MessageToast.show("Error deleting material");
            });
        },

        onImportCSV: function () {
            MessageToast.show("CSV Import dialog will open");
        },

        onExportMaterials: function () {
            fetch('/odata/v4/procurement/exportMaterialsToCSV', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.csvData) {
                    var element = document.createElement('a');
                    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(data.csvData));
                    element.setAttribute('download', 'materials_export.csv');
                    element.style.display = 'none';
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                    MessageToast.show("Materials exported successfully!");
                }
            })
            .catch(error => {
                console.error("Error exporting materials:", error);
                MessageToast.show("Error exporting materials");
            });
        },

        onRefreshMaterials: function () {
            this._loadMaterials();
        },

        onMaterialSelect: function (oEvent) {
            var oSelectedItem = oEvent.getSource();
            var oContext = oSelectedItem.getBindingContext();
            var oMaterial = oContext.getObject();
            MessageToast.show("Selected: " + oMaterial.name);
        },

        // Formatters
        formatStockStatus: function (sStatus) {
            switch (sStatus) {
                case "Low Stock":
                    return "Error";
                case "Overstock":
                    return "Warning";
                case "Normal":
                    return "Success";
                default:
                    return "None";
            }
        }

    });
});
