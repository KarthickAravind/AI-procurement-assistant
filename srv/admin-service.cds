using { sap.procurement as my } from '../db/schema';

service AdminService @(requires:'admin') {

  /** Admin access to all procurement entities */
  entity Suppliers as projection on my.Suppliers;
  entity Materials as projection on my.Materials;
  entity PurchaseOrders as projection on my.PurchaseOrders;
  entity PurchaseOrderItems as projection on my.PurchaseOrderItems;
  entity RFQs as projection on my.RFQs;
  entity RFQItems as projection on my.RFQItems;
  entity RFQResponses as projection on my.RFQResponses;

}
