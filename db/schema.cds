using { Currency, managed, cuid } from '@sap/cds/common';
namespace sap.procurement;

/**
 * Suppliers Entity
 * Contains supplier information with pricing, lead times, and ratings
 */
entity Suppliers : managed {
  key ID : Integer;
  @mandatory name : String(255);
  region : String(50);
  @mandatory material : String(255);
  pricePerUnit : Decimal(10,2);
  currency : Currency;
  leadTime : Integer; // in days
  rating : Decimal(2,1); // e.g., 4.5 out of 5.0
  category : String(100); // construction, logistics, manufacturing
  contactEmail : String(255);
  contactPhone : String(50);
  address : String(500);
  isActive : Boolean default true;

  // Navigation to materials they can supply
  materials : Association to many Materials on materials.supplier = $self;
}

/**
 * Materials/Warehouse Inventory Entity
 * Phase 3: Updated for warehouse management with new columns
 * Columns: Material ID, Name, Supplier, Quantity
 */
entity Materials : managed {
  key ID : String(20); // Material ID - e.g., MAT001
  @mandatory name : String(255); // Material Name
  @mandatory supplier : Association to Suppliers; // Supplier reference
  @mandatory quantity : Integer default 0; // Current stock quantity

  // Additional warehouse management fields
  category : String(100); // Construction, Manufacturing, Logistics
  unitPrice : Decimal(10,2);
  currency : Currency;
  minStockLevel : Integer default 10;
  maxStockLevel : Integer default 1000;
  unit : String(20); // pcs, kg, liters, etc.
  description : String(1000);
  location : String(100); // warehouse location
  lastUpdated : DateTime;

  // Warehouse management status
  stockStatus : String(20); // Low Stock, Normal, Overstock
  isActive : Boolean default true;
}

/**
 * Purchase Orders Entity
 * For tracking purchase orders
 */
entity PurchaseOrders : cuid, managed {
  @mandatory orderNumber : String(50);
  @mandatory supplier : Association to Suppliers;
  orderDate : Date;
  expectedDelivery : Date;
  status : String(20) enum { Draft; Sent; Confirmed; Delivered; Cancelled };
  totalAmount : Decimal(12,2);
  currency : Currency;
  notes : String(1000);

  // Navigation to order items
  items : Composition of many PurchaseOrderItems on items.order = $self;
}

/**
 * Purchase Order Items Entity
 * Individual items within a purchase order
 */
entity PurchaseOrderItems : cuid, managed {
  @mandatory order : Association to PurchaseOrders;
  @mandatory material : Association to Materials;
  quantity : Integer;
  unitPrice : Decimal(10,2);
  totalPrice : Decimal(12,2);
  currency : Currency;
}

/**
 * RFQ (Request for Quotation) Entity
 * For managing RFQ processes
 */
entity RFQs : cuid, managed {
  @mandatory rfqNumber : String(50);
  title : String(255);
  description : String(2000);
  issueDate : Date;
  responseDeadline : Date;
  status : String(20) enum { Draft; Sent; UnderReview; Closed };

  // Navigation to RFQ items and responses
  items : Composition of many RFQItems on items.rfq = $self;
  responses : Composition of many RFQResponses on responses.rfq = $self;
}

/**
 * RFQ Items Entity
 * Individual items within an RFQ
 */
entity RFQItems : cuid, managed {
  @mandatory rfq : Association to RFQs;
  @mandatory material : Association to Materials;
  quantity : Integer;
  specifications : String(1000);
  estimatedPrice : Decimal(10,2);
  currency : Currency;
}

/**
 * RFQ Responses Entity
 * Supplier responses to RFQs
 */
entity RFQResponses : cuid, managed {
  @mandatory rfq : Association to RFQs;
  @mandatory supplier : Association to Suppliers;
  responseDate : Date;
  quotedPrice : Decimal(10,2);
  currency : Currency;
  leadTime : Integer; // in days
  validUntil : Date;
  notes : String(1000);
  status : String(20) enum { Submitted; UnderReview; Accepted; Rejected };
}
