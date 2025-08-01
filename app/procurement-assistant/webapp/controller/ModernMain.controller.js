sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/MessageStrip",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/LayoutType"
], function (Controller, JSONModel, MessageToast, MessageBox, MessageStrip, Fragment, Filter, FilterOperator, LayoutType) {
    "use strict";

    return Controller.extend("procurement.assistant.controller.ModernMain", {

        onInit: function () {
            console.log("Modern Main Controller initialized");
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
                loading: false,
                filters: {
                    search: "",
                    category: "",
                    status: ""
                }
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
                    var oCountText = this.byId("materialsCountText");
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
        onNavToHome: function () {
            MessageToast.show("Navigate to Home");
        },

        onOpenSettings: function () {
            MessageToast.show("Settings dialog will open");
        },

        onOpenHelp: function () {
            MessageToast.show("Help documentation will open");
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
        onSendChatMessage: function (oEvent) {
            var oInput = this.byId("chatInput");
            var sMessage = "";
            
            if (oEvent.getParameter) {
                // Called from FeedInput post event
                sMessage = oEvent.getParameter("value");
            } else {
                // Called from button press
                sMessage = oInput.getValue();
            }
            
            if (!sMessage || !sMessage.trim()) {
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
                    var oContainer = this.byId("chatMessagesContainer");
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
                    var oContainer = this.byId("chatMessagesContainer");
                    oContainer.removeItem(oTypingMessage);
                }
                
                // Fallback response
                var response = this._generateSmartResponse(sMessage);
                this._addChatMessage(response, "assistant");
            });
        },

        _addChatMessage: function (sMessage, sType) {
            var oContainer = this.byId("chatMessagesContainer");
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
                var oScrollContainer = this.byId("chatScrollContainer");
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
            var oTable = this.byId("materialsTable");
            var oBinding = oTable.getBinding("rows");
            var aFilters = [];

            // Search filter
            var sSearch = this.byId("materialSearchField").getValue();
            if (sSearch) {
                var oSearchFilter = new Filter([
                    new Filter("name", FilterOperator.Contains, sSearch),
                    new Filter("ID", FilterOperator.Contains, sSearch),
                    new Filter("supplier_ID", FilterOperator.Contains, sSearch)
                ], false);
                aFilters.push(oSearchFilter);
            }

            // Category filter
            var sCategory = this.byId("categoryFilter").getSelectedKey();
            if (sCategory) {
                aFilters.push(new Filter("category", FilterOperator.EQ, sCategory));
            }

            // Status filter
            var sStatus = this.byId("statusFilter").getSelectedKey();
            if (sStatus) {
                aFilters.push(new Filter("stockStatus", FilterOperator.EQ, sStatus));
            }

            oBinding.filter(aFilters);
        },

        // Material CRUD operations
        onAddMaterial: function () {
            if (!this._addMaterialDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "procurement.assistant.view.fragments.ModernAddMaterialDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._addMaterialDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._addMaterialDialog.open();
            }
        },

        onSaveNewMaterial: function () {
            var oDialog = this._addMaterialDialog;
            var sId = this.byId("modernMaterialId").getValue();
            var sName = this.byId("modernMaterialName").getValue();
            var sSupplier = this.byId("modernMaterialSupplier").getValue();
            var iQuantity = parseInt(this.byId("modernMaterialQuantity").getValue());
            var sUnit = this.byId("modernMaterialUnit").getSelectedKey();
            var sCategory = this.byId("modernMaterialCategory").getSelectedKey();
            var fPrice = parseFloat(this.byId("modernMaterialPrice").getValue()) || 0;
            var sDescription = this.byId("modernMaterialDescription").getValue();
            var sLocation = this.byId("modernMaterialLocation").getSelectedKey();

            if (!sId || !sName || !sSupplier || !iQuantity) {
                MessageToast.show("Please fill all required fields");
                return;
            }

            // Call backend service
            fetch('/odata/v4/procurement/addMaterial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ID: sId,
                    name: sName,
                    supplier: sSupplier,
                    quantity: iQuantity,
                    category: sCategory || "General",
                    unitPrice: fPrice,
                    currency: "USD",
                    unit: sUnit || "pcs",
                    description: sDescription || "",
                    location: sLocation || "Warehouse A"
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    MessageToast.show(data.message);
                    this._loadMaterials();
                    oDialog.close();
                    this._clearAddMaterialForm();
                } else {
                    MessageToast.show("Error: " + data.message);
                }
            })
            .catch(error => {
                console.error("Error adding material:", error);
                MessageToast.show("Error adding material");
            });
        },

        onCancelAddMaterial: function () {
            this._addMaterialDialog.close();
            this._clearAddMaterialForm();
        },

        _clearAddMaterialForm: function () {
            this.byId("modernMaterialId").setValue("");
            this.byId("modernMaterialName").setValue("");
            this.byId("modernMaterialSupplier").setValue("");
            this.byId("modernMaterialQuantity").setValue("");
            this.byId("modernMaterialUnit").setSelectedKey("pcs");
            this.byId("modernMaterialCategory").setSelectedKey("General");
            this.byId("modernMaterialPrice").setValue("");
            this.byId("modernMaterialDescription").setValue("");
            this.byId("modernMaterialLocation").setSelectedKey("Warehouse A");
        },

        onEditMaterial: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oMaterial = oContext.getObject();

            this._currentMaterial = oMaterial;

            if (!this._editMaterialDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "procurement.assistant.view.fragments.ModernEditMaterialDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._editMaterialDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    this._populateEditForm(oMaterial);
                    oDialog.open();
                }.bind(this));
            } else {
                this._populateEditForm(oMaterial);
                this._editMaterialDialog.open();
            }
        },

        _populateEditForm: function (oMaterial) {
            this.byId("modernEditMaterialId").setValue(oMaterial.ID);
            this.byId("modernEditMaterialName").setValue(oMaterial.name);
            this.byId("modernEditMaterialSupplier").setValue(oMaterial.supplier_ID || "");
            this.byId("modernEditMaterialQuantity").setValue(oMaterial.quantity);
            this.byId("modernEditMaterialUnit").setSelectedKey(oMaterial.unit || "pcs");
            this.byId("modernEditMaterialCategory").setSelectedKey(oMaterial.category || "General");
            this.byId("modernEditMaterialPrice").setValue(oMaterial.unitPrice || "");
            this.byId("modernEditMaterialDescription").setValue(oMaterial.description || "");
            this.byId("modernEditMaterialLocation").setSelectedKey(oMaterial.location || "Warehouse A");
            this.byId("modernEditStockStatus").setText(oMaterial.stockStatus || "Normal");
        },

        onSaveEditMaterial: function () {
            var oMaterial = this._currentMaterial;
            var sName = this.byId("modernEditMaterialName").getValue();
            var sSupplier = this.byId("modernEditMaterialSupplier").getValue();
            var iQuantity = parseInt(this.byId("modernEditMaterialQuantity").getValue());
            var sUnit = this.byId("modernEditMaterialUnit").getSelectedKey();
            var sCategory = this.byId("modernEditMaterialCategory").getSelectedKey();
            var fPrice = parseFloat(this.byId("modernEditMaterialPrice").getValue()) || 0;
            var sDescription = this.byId("modernEditMaterialDescription").getValue();
            var sLocation = this.byId("modernEditMaterialLocation").getSelectedKey();

            if (!sName || !sSupplier || !iQuantity) {
                MessageToast.show("Please fill all required fields");
                return;
            }

            // Call backend service
            fetch('/odata/v4/procurement/Materials(\'' + oMaterial.ID + '\')', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: sName,
                    supplier_ID: sSupplier,
                    quantity: iQuantity,
                    category: sCategory,
                    unitPrice: fPrice,
                    unit: sUnit,
                    description: sDescription,
                    location: sLocation
                })
            })
            .then(() => {
                MessageToast.show("Material updated successfully");
                this._loadMaterials();
                this._editMaterialDialog.close();
            })
            .catch(error => {
                console.error("Error updating material:", error);
                MessageToast.show("Error updating material");
            });
        },

        onDeleteMaterialFromEdit: function () {
            var oMaterial = this._currentMaterial;

            MessageBox.confirm("Are you sure you want to delete '" + oMaterial.name + "'?", {
                title: "Confirm Deletion",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._deleteMaterial(oMaterial.ID);
                        this._editMaterialDialog.close();
                    }
                }.bind(this)
            });
        },

        onCancelEditMaterial: function () {
            this._editMaterialDialog.close();
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
            // TODO: Implement modern CSV import dialog
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
