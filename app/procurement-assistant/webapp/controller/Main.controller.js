sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageStrip"
], function (Controller, JSONModel, MessageToast, MessageStrip) {
    "use strict";

    return Controller.extend("procurement.assistant.controller.Main", {
        
        onInit: function () {
            // Initialize data models
            this._initializeModels();
        },

        _initializeModels: function () {
            // Chat model
            var oChatModel = new JSONModel({
                chatMessage: "",
                messages: []
            });
            this.getView().setModel(oChatModel, "chat");

            // Materials model with sample data
            var oMaterialsModel = new JSONModel({
                materials: [
                    {
                        materialId: "MAT001",
                        name: "Office Laptop",
                        category: "Electronics",
                        quantity: 25,
                        unit: "pcs",
                        price: 45000
                    },
                    {
                        materialId: "MAT002", 
                        name: "Office Chair",
                        category: "Furniture",
                        quantity: 50,
                        unit: "pcs",
                        price: 8500
                    },
                    {
                        materialId: "MAT003",
                        name: "Printer Paper",
                        category: "Stationery",
                        quantity: 200,
                        unit: "reams",
                        price: 350
                    }
                ],
                materialsCount: 3,
                chatMessage: ""
            });
            this.getView().setModel(oMaterialsModel);
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteWelcome");
        },

        // Chat functionality
        onSendMessage: function () {
            var oModel = this.getView().getModel();
            var sMessage = oModel.getProperty("/chatMessage");
            
            if (!sMessage.trim()) {
                MessageToast.show("Please enter a message");
                return;
            }

            // Add user message to chat
            this._addMessageToChat(sMessage, "user");
            
            // Clear input
            oModel.setProperty("/chatMessage", "");
            
            // Simulate AI response (placeholder for Phase 5)
            setTimeout(() => {
                this._addMessageToChat(this._generateMockResponse(sMessage), "assistant");
            }, 1000);
        },

        _addMessageToChat: function (sMessage, sType) {
            var oChatContainer = this.byId("chatMessages");
            
            var oMessageStrip = new MessageStrip({
                text: sMessage,
                type: sType === "user" ? "Success" : "Information",
                class: "sapUiMediumMarginBottom"
            });
            
            oChatContainer.addItem(oMessageStrip);
            
            // Scroll to bottom
            var oScrollContainer = oChatContainer.getParent();
            setTimeout(() => {
                oScrollContainer.scrollToElement(oMessageStrip);
            }, 100);
        },

        _generateMockResponse: function (sUserMessage) {
            // Simple mock responses for Phase 1
            var aResponses = [
                "I understand you're asking about: '" + sUserMessage + "'. In Phase 5, I'll be able to provide intelligent responses using AI!",
                "That's an interesting question about procurement. Once AI integration is complete, I'll help you with detailed supplier information.",
                "I see you're interested in: '" + sUserMessage + "'. Soon I'll be able to analyze your requirements and suggest the best suppliers!"
            ];
            return aResponses[Math.floor(Math.random() * aResponses.length)];
        },

        onClearChat: function () {
            var oChatContainer = this.byId("chatMessages");
            oChatContainer.removeAllItems();
            
            // Add welcome message back
            this._addMessageToChat("Hello! I'm your AI procurement assistant. Ask me anything about suppliers, materials, or procurement processes.", "assistant");
        },

        // Warehouse Management functionality
        onAddMaterial: function () {
            MessageToast.show("Add Material functionality will be implemented in Phase 3");
        },

        onEditMaterial: function (oEvent) {
            MessageToast.show("Edit Material functionality will be implemented in Phase 3");
        },

        onDeleteMaterial: function (oEvent) {
            MessageToast.show("Delete Material functionality will be implemented in Phase 3");
        },

        onSearchMaterials: function (oEvent) {
            MessageToast.show("Search functionality will be implemented in Phase 3");
        },

        onFilterMaterials: function () {
            MessageToast.show("Filter functionality will be implemented in Phase 3");
        },

        onRefreshMaterials: function () {
            MessageToast.show("Materials refreshed!");
        },

        onMaterialSelect: function (oEvent) {
            var oSelectedItem = oEvent.getSource();
            var oContext = oSelectedItem.getBindingContext();
            var oMaterial = oContext.getObject();
            
            MessageToast.show("Selected: " + oMaterial.name);
        }
    });
});
