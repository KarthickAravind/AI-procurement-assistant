using { Currency, managed, cuid } from '@sap/cds/common';
namespace sap.procurement;

/**
 * Suppliers Entity
 * Updated to match new JSON structure with products
 */
entity Suppliers : managed {
  key ID : Integer;
  @mandatory name : String(255);
  @mandatory category : String(100); // Manufacturing, Construction, Logistics, Electronics
  @mandatory material : String(255); // Primary material type
  @mandatory region : String(50); // Geographic region
  @mandatory leadTime : String(20); // e.g., "7-10 days"
  @mandatory rating : Decimal(2,1); // e.g., 4.5 out of 5.0
  @mandatory contact : String(255); // Contact information
  @mandatory location : String(255); // Detailed location
  isActive : Boolean default true;

  // Navigation to products they supply
  products : Composition of many SupplierProducts on products.supplier = $self;
  // Navigation to materials they can supply
  materials : Association to many Materials on materials.supplier = $self;
}

/**
 * Supplier Products Entity
 * Products offered by each supplier
 */
entity SupplierProducts : cuid, managed {
  @mandatory supplier : Association to Suppliers;
  @mandatory name : String(255);
  @mandatory description : String(500);
  @mandatory price : String(20); // Price as string to match JSON
}

/**
 * Materials/Warehouse Inventory Entity
 * Phase 3: Updated for warehouse management with new columns
 * Columns: Material ID, Name, Supplier, Quantity, Delivery Period
 */
entity Materials : managed {
  key ID : String(50); // Material ID - e.g., RFQ-123456-P1
  @mandatory name : String(255); // Material Name
  supplier : Association to Suppliers; // Supplier reference (optional for backward compatibility)
  supplierName : String(255); // Supplier name (for display)
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
  deliveryPeriod : String(50); // Lead time from supplier (e.g., "7-10 days")

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
