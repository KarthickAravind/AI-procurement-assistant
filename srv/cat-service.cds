using { sap.procurement as my } from '../db/schema';

service ProcurementService {

  /** Suppliers - for finding and managing suppliers */
  @readonly
  @Capabilities.TopSupported: true
  @Capabilities.SkipSupported: true
  entity Suppliers as projection on my.Suppliers;

  /** Supplier Products - products offered by suppliers */
  @readonly
  entity SupplierProducts as projection on my.SupplierProducts;

  /** Materials - for warehouse inventory management */
  entity Materials as projection on my.Materials;

  /** Purchase Orders - for managing procurement orders */
  entity PurchaseOrders as projection on my.PurchaseOrders;

  /** Purchase Order Items - for order line items */
  entity PurchaseOrderItems as projection on my.PurchaseOrderItems;

  /** RFQs - for managing request for quotations */
  entity RFQs as projection on my.RFQs;

  /** RFQ Items - for RFQ line items */
  entity RFQItems as projection on my.RFQItems;

  /** RFQ Responses - for supplier responses */
  entity RFQResponses as projection on my.RFQResponses;

  // Actions for procurement workflows
  @requires: 'authenticated-user'
  action createPurchaseOrder (
    supplier: Suppliers:ID @mandatory,
    items: array of {
      material: Materials:ID;
      quantity: Integer;
      unitPrice: Decimal;
    }
  ) returns { orderNumber: String };

  @requires: 'authenticated-user'
  action sendRFQ (
    title: String @mandatory,
    description: String,
    items: array of {
      material: Materials:ID;
      quantity: Integer;
      specifications: String;
    },
    suppliers: array of Suppliers:ID
  ) returns { rfqNumber: String };

  // Phase 3: Warehouse Management Actions
  @requires: 'authenticated-user'
  action addMaterial (
    ID: String @mandatory,
    name: String @mandatory,
    supplier: Suppliers:ID @mandatory,
    quantity: Integer @mandatory,
    category: String,
    unitPrice: Decimal,
    currency: String,
    unit: String,
    description: String,
    location: String
  ) returns { success: Boolean; message: String };

  @requires: 'authenticated-user'
  action updateMaterialQuantity (
    materialID: Materials:ID @mandatory,
    newQuantity: Integer @mandatory
  ) returns { success: Boolean; message: String };

  @requires: 'authenticated-user'
  action importMaterialsFromCSV (
    csvData: String @mandatory
  ) returns { success: Boolean; imported: Integer; errors: array of String };

  action exportMaterialsToCSV () returns { csvData: String };

  // Phase 4: Chat Interface Actions
  action initChatSession () returns { sessionId: String; welcomeMessage: String };

  action sendChatMessage (
    sessionId: String @mandatory,
    message: String @mandatory
  ) returns { success: Boolean; response: String; error: String; fallbackResponse: String; sessionId: String };

  action getChatHistory (
    sessionId: String @mandatory
  ) returns { success: Boolean; history: array of { role: String; message: String; timestamp: DateTime } };

  action clearChatSession (
    sessionId: String @mandatory
  ) returns { success: Boolean };

  // Data Management Actions
  action loadSuppliersData () returns { success: Boolean; loaded: Integer; errors: Integer; message: String };

  action initializeMaterialsData () returns { success: Boolean; message: String };

  // Events for procurement processes
  event PurchaseOrderCreated : { orderNumber: String; supplier: String; totalAmount: Decimal };
  event RFQSent : { rfqNumber: String; title: String; supplierCount: Integer };
}
