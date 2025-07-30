using { sap.procurement as my } from '../db/schema';

service ProcurementService {

  /** Suppliers - for finding and managing suppliers */
  entity Suppliers as projection on my.Suppliers;

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

  // Events for procurement processes
  event PurchaseOrderCreated : { orderNumber: String; supplier: String; totalAmount: Decimal };
  event RFQSent : { rfqNumber: String; title: String; supplierCount: Integer };
}
