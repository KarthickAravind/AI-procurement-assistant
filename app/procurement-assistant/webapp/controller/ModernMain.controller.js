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

        onQuickActionManualOrder: function () {
            this._openManualOrderDialog();
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

            // Parse action buttons from message
            var aActionButtons = this._parseActionButtons(sMessage);
            var sCleanMessage = this._removeActionButtons(sMessage);

            var oMessage = new MessageStrip({
                text: sMessageIcon + sCleanMessage,
                type: sMessageType,
                class: "sapUiMediumMarginBottom"
            });

            oContainer.addItem(oMessage);

            // Add action buttons if any
            if (aActionButtons.length > 0) {
                var oButtonContainer = this._createActionButtonContainer(aActionButtons);
                oContainer.addItem(oButtonContainer);
            }

            // Scroll to bottom
            setTimeout(() => {
                var oScrollContainer = this.byId("chatScrollContainer");
                if (oScrollContainer) {
                    oScrollContainer.scrollToElement(oMessage);
                }
            }, 100);

            return oMessage;
        },

        _parseActionButtons: function (sMessage) {
            var aButtons = [];
            var regex = /\[ACTION:([^:]+):([^\]]+)\]\s*([^[\n]*)/g;
            var match;

            while ((match = regex.exec(sMessage)) !== null) {
                aButtons.push({
                    action: match[1],
                    parameter: match[2],
                    text: match[3].trim()
                });
            }

            return aButtons;
        },

        _removeActionButtons: function (sMessage) {
            return sMessage.replace(/\[ACTION:[^\]]+\][^[\n]*/g, '').trim();
        },

        _createActionButtonContainer: function (aActionButtons) {
            var oHBox = new sap.m.HBox({
                class: "sapUiMediumMarginTop sapUiMediumMarginBottom",
                items: aActionButtons.map(oButtonData => {
                    return new sap.m.Button({
                        text: oButtonData.text,
                        type: "Emphasized",
                        class: "sapUiTinyMarginEnd",
                        press: () => {
                            this._handleActionButton(oButtonData.action, oButtonData.parameter);
                        }
                    });
                })
            });

            return oHBox;
        },

        _handleActionButton: function (sAction, sParameter) {
            console.log('🔘 Action button clicked:', sAction, sParameter);

            switch (sAction) {
                case 'create_po':
                    this._createPOFromRFQ(sParameter);
                    break;
                case 'modify_rfq':
                    this._modifyRFQ(sParameter);
                    break;
                case 'export_rfq':
                    this._exportRFQ(sParameter);
                    break;
                default:
                    MessageToast.show(`Action ${sAction} not implemented yet`);
            }
        },

        _createPOFromRFQ: function (sRfqId) {
            // Extract supplier name from the last RFQ message
            var sSupplierName = this._extractSupplierFromLastRFQ();

            if (!sSupplierName) {
                MessageToast.show("Could not determine supplier for order");
                return;
            }

            jQuery.ajax({
                url: "/odata/v4/procurement/createPOFromRFQ",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    rfqId: sRfqId,
                    supplierName: sSupplierName
                }),
                success: (data) => {
                    if (data.success) {
                        this._addChatMessage(`✅ Order ${data.orderNumber} created successfully! The order has been added to your inventory.`, "assistant");
                        this._refreshInventoryTile();
                    } else {
                        this._addChatMessage("❌ Failed to create purchase order. Please try again.", "assistant");
                    }
                },
                error: (xhr, status, error) => {
                    console.error("PO creation failed:", error);
                    this._addChatMessage("❌ Order creation failed. Please try again.", "assistant");
                }
            });
        },

        _extractSupplierFromLastRFQ: function () {
            // Look for supplier name in recent chat messages
            var oContainer = this.byId("chatMessagesContainer");
            var aItems = oContainer.getItems();

            for (var i = aItems.length - 1; i >= 0; i--) {
                var oItem = aItems[i];
                if (oItem.getText && oItem.getText().includes("Company Name:")) {
                    var sText = oItem.getText();
                    var match = sText.match(/Company Name:\s*([^\n]+)/);
                    if (match) {
                        return match[1].trim();
                    }
                }
            }

            return null;
        },

        _modifyRFQ: function (sRfqId) {
            this._addChatMessage("RFQ modification feature will be available soon.", "assistant");
        },

        _exportRFQ: function (sRfqId) {
            this._addChatMessage("RFQ export feature will be available soon.", "assistant");
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
        },

        // Manual Order Dialog Methods
        _openManualOrderDialog: function () {
            if (!this._manualOrderDialog) {
                this._manualOrderDialog = sap.ui.xmlfragment(
                    "procurement.assistant.view.fragments.ManualOrderDialog",
                    this
                );
                this.getView().addDependent(this._manualOrderDialog);
            }

            // Initialize empty model
            this._manualOrderDialog.setModel(new sap.ui.model.json.JSONModel({
                suppliers: [],
                searchTerm: "",
                totalFound: 0
            }));

            this._manualOrderDialog.open();
        },

        onSearchProducts: function () {
            const oDialog = this._manualOrderDialog;
            const sSearchTerm = sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "productSearchField"
            ).getValue();

            if (!sSearchTerm.trim()) {
                MessageToast.show("Please enter a product name or material to search");
                return;
            }

            // Get filter values
            const sRegion = sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "regionFilter"
            ).getSelectedKey();

            const sCategory = sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "categoryFilter"
            ).getSelectedKey();

            const sMinRating = sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "minRatingInput"
            ).getValue();

            // Update status
            sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "searchStatusText"
            ).setText(`Searching for "${sSearchTerm}"...`);

            // Call enhanced search API
            const oData = {
                searchTerm: sSearchTerm,
                region: sRegion || undefined,
                category: sCategory || undefined,
                minRating: sMinRating ? parseFloat(sMinRating) : undefined,
                limit: 50
            };

            jQuery.ajax({
                url: "/odata/v4/procurement/enhancedSupplierSearch",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(oData),
                success: (data) => {
                    const oModel = oDialog.getModel();
                    oModel.setData({
                        suppliers: data.suppliers || [],
                        searchTerm: sSearchTerm,
                        totalFound: data.totalFound || 0
                    });

                    const sStatusText = data.totalFound > 0
                        ? `Found ${data.totalFound} suppliers for "${sSearchTerm}"`
                        : `No suppliers found for "${sSearchTerm}"`;

                    sap.ui.core.Fragment.byId(
                        "procurement.assistant.view.fragments.ManualOrderDialog",
                        "searchStatusText"
                    ).setText(sStatusText);
                },
                error: (xhr, status, error) => {
                    MessageToast.show("Search failed: " + error);
                    sap.ui.core.Fragment.byId(
                        "procurement.assistant.view.fragments.ManualOrderDialog",
                        "searchStatusText"
                    ).setText("Search failed");
                }
            });
        },

        onClearSearch: function () {
            sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "productSearchField"
            ).setValue("");

            sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "regionFilter"
            ).setSelectedKey("");

            sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "categoryFilter"
            ).setSelectedKey("");

            sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "minRatingInput"
            ).setValue("");

            this._manualOrderDialog.getModel().setData({
                suppliers: [],
                searchTerm: "",
                totalFound: 0
            });

            sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "searchStatusText"
            ).setText("Enter a product name or material to search for suppliers");
        },

        onCloseManualOrderDialog: function () {
            this._manualOrderDialog.close();
        },

        onViewSupplierDetails: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            const oSupplier = oContext.getObject();

            MessageBox.information(
                `Supplier: ${oSupplier.name}\n` +
                `Material: ${oSupplier.material}\n` +
                `Region: ${oSupplier.region}\n` +
                `Rating: ${oSupplier.rating}/5\n` +
                `Lead Time: ${oSupplier.leadTime}\n` +
                `Contact: ${oSupplier.contact}\n` +
                `Location: ${oSupplier.location}`,
                { title: "Supplier Details" }
            );
        },

        onCreateRFQ: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            const oSupplier = oContext.getObject();

            // Get search term and quantity from dialog
            const sSearchTerm = sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "productSearchField"
            ).getValue();

            if (!sSearchTerm) {
                MessageToast.show("Please enter a product name first");
                return;
            }

            // Prompt for quantity
            const sQuantity = prompt("Enter quantity needed:", "1");
            if (!sQuantity || isNaN(sQuantity) || parseInt(sQuantity) <= 0) {
                MessageToast.show("Please enter a valid quantity");
                return;
            }

            this._createRFQForSupplier(oSupplier, sSearchTerm, parseInt(sQuantity));
        },

        onCreateRFQForSelected: function () {
            const oTable = sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "suppliersTable"
            );

            const aSelectedIndices = oTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageToast.show("Please select at least one supplier");
                return;
            }

            // Get selected suppliers
            const aSelectedSuppliers = [];
            const oModel = oTable.getModel();

            aSelectedIndices.forEach(iIndex => {
                const oContext = oTable.getContextByIndex(iIndex);
                if (oContext) {
                    aSelectedSuppliers.push(oContext.getObject());
                }
            });

            if (aSelectedSuppliers.length === 0) {
                MessageToast.show("No suppliers selected");
                return;
            }

            // Get search term
            const sSearchTerm = sap.ui.core.Fragment.byId(
                "procurement.assistant.view.fragments.ManualOrderDialog",
                "productSearchField"
            ).getValue();

            if (!sSearchTerm) {
                MessageToast.show("Please enter a product name first");
                return;
            }

            // Prompt for quantity
            const sQuantity = prompt("Enter quantity needed:", "1");
            if (!sQuantity || isNaN(sQuantity) || parseInt(sQuantity) <= 0) {
                MessageToast.show("Please enter a valid quantity");
                return;
            }

            this._createBulkRFQ(aSelectedSuppliers, sSearchTerm, parseInt(sQuantity));
        },

        _createBulkRFQ: function (aSuppliers, sProduct, iQuantity) {
            const oData = {
                suppliers: JSON.stringify(aSuppliers),
                material: aSuppliers[0].material, // Use first supplier's material
                product: sProduct,
                quantity: iQuantity
            };

            jQuery.ajax({
                url: "/odata/v4/procurement/generateRFQ",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(oData),
                success: (data) => {
                    if (data.success) {
                        this._showRFQDialog(data);
                    } else {
                        MessageBox.error("Failed to generate RFQ");
                    }
                },
                error: (xhr, status, error) => {
                    MessageBox.error("RFQ generation failed: " + error);
                }
            });
        },

        formatRatingState: function (fRating) {
            if (fRating >= 4.5) return "Success";
            if (fRating >= 4.0) return "Success";
            if (fRating >= 3.5) return "Warning";
            if (fRating >= 3.0) return "Warning";
            return "Error";
        },

        // RFQ Creation Methods
        _createRFQForSupplier: function (oSupplier, sProduct, iQuantity) {
            const oData = {
                suppliers: JSON.stringify([oSupplier]),
                material: oSupplier.material,
                product: sProduct,
                quantity: iQuantity
            };

            jQuery.ajax({
                url: "/odata/v4/procurement/generateRFQ",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(oData),
                success: (data) => {
                    if (data.success) {
                        this._showRFQDialog(data);
                    } else {
                        MessageBox.error("Failed to generate RFQ");
                    }
                },
                error: (xhr, status, error) => {
                    MessageBox.error("RFQ generation failed: " + error);
                }
            });
        },

        _showRFQDialog: function (rfqData) {
            if (!this._rfqDialog) {
                this._rfqDialog = new sap.m.Dialog({
                    title: "Request for Quotation",
                    contentWidth: "600px",
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.FormattedText({
                            htmlText: ""
                        })
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: "Place Order",
                            type: "Emphasized",
                            press: () => {
                                this._placeOrderFromRFQ(rfqData);
                            }
                        }),
                        new sap.m.Button({
                            text: "Close",
                            press: () => {
                                this._rfqDialog.close();
                            }
                        })
                    ]
                });
                this.getView().addDependent(this._rfqDialog);
            }

            // Format the RFQ message for display
            const sFormattedMessage = rfqData.formattedMessage.replace(/\n/g, "<br/>");
            this._rfqDialog.getContent()[0].setHtmlText(sFormattedMessage);

            // Store RFQ data for order placement
            this._currentRFQ = rfqData;

            this._rfqDialog.open();
        },

        _placeOrderFromRFQ: function (rfqData) {
            // Prompt user to select supplier
            const aSuppliers = rfqData.rfqResults || [];
            if (aSuppliers.length === 0) {
                MessageBox.error("No suppliers available for order");
                return;
            }

            let sSupplierName;
            if (aSuppliers.length === 1) {
                sSupplierName = aSuppliers[0].supplierInfo.companyName;
            } else {
                // For multiple suppliers, use the first one for now
                // TODO: Add supplier selection dialog
                sSupplierName = aSuppliers[0].supplierInfo.companyName;
            }

            const oOrderData = {
                supplierName: sSupplierName,
                material: aSuppliers[0].supplierInfo.material,
                product: aSuppliers[0].supplierInfo.product,
                quantity: aSuppliers[0].supplierInfo.units,
                estimatedTotal: parseFloat(aSuppliers[0].estimatedPricing.breakdown.totalEstimate)
            };

            jQuery.ajax({
                url: "/odata/v4/procurement/createUnifiedPurchaseOrder",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(oOrderData),
                success: (data) => {
                    if (data.success) {
                        MessageBox.success(`Order ${data.orderNumber} created successfully!\n\nInventory has been updated.`);
                        this._rfqDialog.close();
                        this._refreshInventoryTile();
                    } else {
                        MessageBox.error("Failed to create purchase order");
                    }
                },
                error: (xhr, status, error) => {
                    MessageBox.error("Order creation failed: " + error);
                }
            });
        },

        _refreshInventoryTile: function () {
            // Refresh the inventory overview tile
            const oInventoryTile = this.byId("inventoryTile");
            if (oInventoryTile && oInventoryTile.getModel()) {
                oInventoryTile.getModel().refresh();
            }

            // Also refresh the materials model if it exists
            const oModel = this.getView().getModel();
            if (oModel) {
                oModel.refresh();
            }
        }

    });
});
