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

            // Phase 3: Initialize empty materials model - will be loaded from backend
            var oMaterialsModel = new JSONModel({
                materials: [],
                materialsCount: 0,
                chatMessage: "",
                loading: false
            });
            this.getView().setModel(oMaterialsModel);

            // Load materials from backend
            this._loadMaterials();
        },

        // Phase 3: Load materials from backend service
        _loadMaterials: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/loading", true);

            // Call backend service
            jQuery.ajax({
                url: "/odata/v4/procurement/Materials",
                method: "GET",
                success: function (data) {
                    var materials = data.value || [];

                    // Transform data for UI
                    var transformedMaterials = materials.map(function (material) {
                        return {
                            materialId: material.ID,
                            name: material.name,
                            supplier: material.supplier_ID,
                            quantity: material.quantity,
                            category: material.category,
                            unit: material.unit,
                            price: material.unitPrice,
                            stockStatus: material.stockStatus,
                            location: material.location
                        };
                    });

                    oModel.setProperty("/materials", transformedMaterials);
                    oModel.setProperty("/materialsCount", transformedMaterials.length);
                    oModel.setProperty("/loading", false);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error("Error loading materials:", error);
                    oModel.setProperty("/loading", false);
                    sap.m.MessageToast.show("Error loading materials from backend");
                }.bind(this)
            });
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

        // Phase 3: Warehouse Management CRUD Operations
        onAddMaterial: function () {
            // Open dialog for adding new material
            if (!this._addMaterialDialog) {
                this._addMaterialDialog = sap.ui.xmlfragment("procurement.assistant.view.AddMaterialDialog", this);
                this.getView().addDependent(this._addMaterialDialog);
            }
            this._addMaterialDialog.open();
        },

        onSaveNewMaterial: function () {
            var oDialog = this._addMaterialDialog;
            var sId = sap.ui.core.Fragment.byId(oDialog.getId(), "materialIdInput").getValue();
            var sName = sap.ui.core.Fragment.byId(oDialog.getId(), "materialNameInput").getValue();
            var sSupplier = sap.ui.core.Fragment.byId(oDialog.getId(), "supplierInput").getValue();
            var iQuantity = parseInt(sap.ui.core.Fragment.byId(oDialog.getId(), "quantityInput").getValue());

            if (!sId || !sName || !sSupplier || !iQuantity) {
                MessageToast.show("Please fill all required fields");
                return;
            }

            // Call backend service
            jQuery.ajax({
                url: "/odata/v4/procurement/addMaterial",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    ID: sId,
                    name: sName,
                    supplier: sSupplier,
                    quantity: iQuantity,
                    category: sap.ui.core.Fragment.byId(oDialog.getId(), "categoryInput").getValue() || "General",
                    unitPrice: parseFloat(sap.ui.core.Fragment.byId(oDialog.getId(), "priceInput").getValue()) || 0,
                    currency: "USD",
                    unit: sap.ui.core.Fragment.byId(oDialog.getId(), "unitInput").getValue() || "pcs",
                    description: sap.ui.core.Fragment.byId(oDialog.getId(), "descriptionInput").getValue() || "",
                    location: "Warehouse A"
                }),
                success: function (data) {
                    if (data.success) {
                        MessageToast.show(data.message);
                        this._loadMaterials(); // Refresh the list
                        oDialog.close();
                    } else {
                        MessageToast.show("Error: " + data.message);
                    }
                }.bind(this),
                error: function () {
                    MessageToast.show("Error adding material");
                }
            });
        },

        onCancelAddMaterial: function () {
            this._addMaterialDialog.close();
        },

        onEditMaterial: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oMaterial = oContext.getObject();

            // Store current material for editing
            this._currentMaterial = oMaterial;

            // Open edit dialog (similar to add dialog but pre-filled)
            MessageToast.show("Edit functionality: " + oMaterial.name);
        },

        onDeleteMaterial: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oMaterial = oContext.getObject();

            sap.m.MessageBox.confirm("Are you sure you want to delete " + oMaterial.name + "?", {
                onClose: function (sAction) {
                    if (sAction === sap.m.MessageBox.Action.OK) {
                        // Call backend delete service
                        jQuery.ajax({
                            url: "/odata/v4/procurement/Materials('" + oMaterial.materialId + "')",
                            method: "DELETE",
                            success: function () {
                                MessageToast.show("Material deleted successfully");
                                this._loadMaterials(); // Refresh the list
                            }.bind(this),
                            error: function () {
                                MessageToast.show("Error deleting material");
                            }
                        });
                    }
                }.bind(this)
            });
        },

        onSearchMaterials: function (oEvent) {
            var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue");
            var oTable = this.byId("materialsTable");
            var oBinding = oTable.getBinding("items");

            if (sQuery && sQuery.length > 0) {
                var oFilter = new sap.ui.model.Filter([
                    new sap.ui.model.Filter("name", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("materialId", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("category", sap.ui.model.FilterOperator.Contains, sQuery)
                ], false);
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onFilterMaterials: function () {
            MessageToast.show("Filter dialog will be implemented");
        },

        onRefreshMaterials: function () {
            this._loadMaterials();
            MessageToast.show("Materials refreshed!");
        },

        onImportCSV: function () {
            MessageToast.show("CSV Import functionality will be implemented");
        },

        onExportData: function () {
            // Call backend export service
            jQuery.ajax({
                url: "/odata/v4/procurement/exportMaterialsToCSV",
                method: "POST",
                success: function (data) {
                    if (data.csvData) {
                        // Create download link
                        var element = document.createElement('a');
                        element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(data.csvData));
                        element.setAttribute('download', 'materials_export.csv');
                        element.style.display = 'none';
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        MessageToast.show("Materials exported successfully");
                    }
                },
                error: function () {
                    MessageToast.show("Error exporting materials");
                }
            });
        },

        onMaterialSelect: function (oEvent) {
            var oSelectedItem = oEvent.getSource();
            var oContext = oSelectedItem.getBindingContext();
            var oMaterial = oContext.getObject();

            MessageToast.show("Selected: " + oMaterial.name);
        },

        // Phase 3: Formatter for stock status
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
