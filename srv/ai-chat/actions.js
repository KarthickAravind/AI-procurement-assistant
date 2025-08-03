/**
 * Procurement Actions - Interface to CAP OData services
 * Handles structured queries and database operations
 */

const cds = require('@sap/cds');
const fetch = require('node-fetch');
const productMapper = require('./productMaterialMapper');

class ProcurementActions {
  constructor() {
    this.service = null;
  }

  async initialize() {
    // Connect to database directly
    this.db = await cds.connect.to('db');
    this.service = this.db; // Use database connection directly
  }

  /**
   * Search suppliers with structured filters
   * @param {Object} params - Search parameters
   * @returns {Array} - Array of matching suppliers
   */
  async searchSuppliers(params) {
    try {
      console.log('🔍 Searching suppliers with params:', JSON.stringify(params, null, 2));

      // Use enhanced search if material is specified
      if (params.material) {
        console.log('🔍 Using enhanced search for material:', params.material);

        const enhancedSearchParams = {
          searchTerm: params.material,
          region: params.region,
          category: params.category,
          minRating: params.minRating,
          limit: params.limit || 10
        };

        const response = await fetch('http://localhost:4005/odata/v4/procurement/enhancedSupplierSearch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enhancedSearchParams)
        });

        const result = await response.json();
        console.log('✅ Enhanced search result:', result.suppliers?.length || 0, 'suppliers found');

        return result.suppliers || [];
      }

      // Fallback to basic search
      console.log('🔍 Using basic search (no material specified)');

      // Build OData query URL
      let url = 'http://localhost:4005/odata/v4/procurement/Suppliers';
      const filters = [];

      // Enhanced material search using product mapping
      if (params.material) {
        console.log('🔍 Original material search:', params.material);

        // Get enhanced search terms using product mapping
        const enhancedSearch = productMapper.getEnhancedSearchTerms(params.material);
        console.log('🔍 Enhanced search terms:', enhancedSearch);

        const materialFilters = [];

        // Add original material search (case-insensitive)
        materialFilters.push(`contains(tolower(material), '${params.material.toLowerCase()}')`);

        // Add searches for mapped material categories
        enhancedSearch.matchingMaterials.forEach(material => {
          materialFilters.push(`contains(material, '${material}')`);
        });

        // Remove duplicates and combine with OR logic
        const uniqueFilters = [...new Set(materialFilters)];
        if (uniqueFilters.length > 1) {
          filters.push(`(${uniqueFilters.join(' or ')})`);
        } else {
          filters.push(uniqueFilters[0]);
        }

        console.log('📝 Added enhanced material filter:', filters[filters.length - 1]);
      }

      if (params.region) {
        filters.push(`region eq '${params.region}'`);
      }

      if (params.category) {
        filters.push(`category eq '${params.category}'`);
      }

      if (params.minRating) {
        filters.push(`rating ge ${params.minRating}`);
      }

      // Add query parameters
      const queryParams = [];

      if (filters.length > 0) {
        queryParams.push(`$filter=${filters.join(' and ')}`);
      }

      // Add ordering
      if (params.sortBy === 'rating') {
        queryParams.push('$orderby=rating desc');
      } else {
        queryParams.push('$orderby=name');
      }

      // Add limit
      if (params.limit) {
        queryParams.push(`$top=${params.limit}`);
      }

      if (queryParams.length > 0) {
        // Properly encode the URL
        const encodedParams = queryParams.map(param => {
          if (param.startsWith('$filter=')) {
            const filterValue = param.substring(8);
            return '$filter=' + encodeURIComponent(filterValue);
          }
          return param;
        });
        url += '?' + encodedParams.join('&');
      }

      console.log('🌐 Fetching from URL:', url);

      const response = await fetch(url);
      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status, response.statusText);
        // Fall back to simple search without filters
        const fallbackUrl = 'http://localhost:4005/odata/v4/procurement/Suppliers?$top=10&$orderby=rating desc';
        const fallbackResponse = await fetch(fallbackUrl);
        const fallbackData = await fallbackResponse.json();
        return fallbackData.value || [];
      }

      const data = await response.json();
      const results = data.value || [];

      console.log(`✅ Found ${results.length} suppliers with structured search`);

      return results;

    } catch (error) {
      console.error('❌ Error in structured supplier search:', error);

      // Fallback: try to get any suppliers
      try {
        console.log('🔄 Attempting fallback search...');
        const fallbackResponse = await fetch('http://localhost:4005/odata/v4/procurement/Suppliers?$top=10&$orderby=rating desc');
        const fallbackData = await fallbackResponse.json();
        return fallbackData.value || [];
      } catch (fallbackError) {
        console.error('❌ Fallback search also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get suppliers by IDs
   * @param {Array} supplierIds - Array of supplier IDs
   * @returns {Array} - Array of supplier objects
   */
  async getSuppliersByIds(supplierIds) {
    try {
      const results = await SELECT.from('sap.procurement.Suppliers').where({
        ID: { in: supplierIds }
      });

      return results;

    } catch (error) {
      console.error('❌ Error getting suppliers by IDs:', error);
      return [];
    }
  }

  /**
   * Get supplier products
   * @param {Array} supplierIds - Array of supplier IDs
   * @returns {Array} - Array of products
   */
  async getSupplierProducts(supplierIds) {
    try {
      const results = await SELECT.from('sap.procurement.SupplierProducts').where({
        supplier_ID: { in: supplierIds }
      });

      return results;

    } catch (error) {
      console.error('❌ Error getting supplier products:', error);
      return [];
    }
  }

  /**
   * Find suppliers for specific materials
   * @param {Array} materials - Array of material names
   * @returns {Array} - Array of suggested suppliers
   */
  async findSuppliersForMaterials(materials) {
    try {
      const materialFilters = materials.map(material => ({
        material: { like: `%${material}%` }
      }));

      const results = await SELECT.from('sap.procurement.Suppliers')
        .where(materialFilters)
        .orderBy('rating desc')
        .limit(10);

      return results;

    } catch (error) {
      console.error('❌ Error finding suppliers for materials:', error);
      return [];
    }
  }

  /**
   * Get RFQ details
   * @param {string} rfqId - RFQ ID
   * @returns {Object} - RFQ details
   */
  async getRFQDetails(rfqId) {
    try {
      // For now, return mock RFQ details
      // In a real implementation, this would query an RFQ entity
      return {
        id: rfqId,
        status: 'Draft',
        createdDate: new Date().toISOString(),
        items: [],
        totalEstimate: 0
      };
      
    } catch (error) {
      console.error('❌ Error getting RFQ details:', error);
      return null;
    }
  }

  /**
   * Calculate order estimate
   * @param {Object} orderParams - Order parameters
   * @returns {Object} - Order estimate
   */
  async calculateOrderEstimate(orderParams) {
    try {
      console.log('💰 Calculating order estimate for:', orderParams);

      // Base pricing by material type
      const materialPricing = {
        'Aluminum Sheets': 45.70,
        'Steel Components': 65.50,
        'Plastic Molding': 35.20,
        'Casting Materials': 55.80,
        'Industrial Fasteners': 25.40
      };

      const material = orderParams.material || 'Aluminum Sheets';
      const quantity = orderParams.quantity || 1;
      const basePrice = materialPricing[material] || 45.70;

      const subtotal = basePrice * quantity;
      const tax = subtotal * 0.18; // 18% tax
      const shipping = 40; // Default shipping
      const total = subtotal + tax + shipping;

      return {
        material: material,
        quantity: quantity,
        unitPrice: basePrice,
        subtotal: subtotal,
        tax: tax,
        shipping: shipping,
        total: total,
        currency: 'USD',
        supplier: orderParams.supplier || 'Unknown',
        estimatedDelivery: orderParams.leadTime || '7-10 business days'
      };

    } catch (error) {
      console.error('❌ Error calculating order estimate:', error);
      return null;
    }
  }

  /**
   * Get inventory status
   * @param {Object} params - Filter parameters
   * @returns {Object} - Inventory status
   */
  async getInventoryStatus(params) {
    try {
      console.log('📦 Getting inventory status with params:', params);

      // Build URL with filters
      let url = 'http://localhost:4005/odata/v4/procurement/Materials';
      const filters = [];

      if (params.stockStatus) {
        filters.push(`stockStatus eq '${params.stockStatus}'`);
      }

      if (params.category) {
        filters.push(`category eq '${params.category}'`);
      }

      if (filters.length > 0) {
        url += `?$filter=${filters.join(' and ')}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      const materials = data.value || [];
      
      // Calculate statistics
      const totalMaterials = materials.length;
      const lowStockCount = materials.filter(m => m.stockStatus === 'Low Stock').length;
      const categories = [...new Set(materials.map(m => m.category))];
      
      return {
        totalMaterials: totalMaterials,
        lowStockCount: lowStockCount,
        categories: categories,
        recentMaterials: materials.slice(0, 5),
        materials: materials
      };
      
    } catch (error) {
      console.error('❌ Error getting inventory status:', error);
      return {
        totalMaterials: 0,
        lowStockCount: 0,
        categories: [],
        recentMaterials: [],
        materials: []
      };
    }
  }

  /**
   * Get general procurement context
   * @returns {Object} - General context information
   */
  async getProcurementContext() {
    try {
      console.log('📊 Getting procurement context...');

      // Get suppliers count and data
      const suppliersResponse = await fetch('http://localhost:4005/odata/v4/procurement/Suppliers?$top=5&$orderby=rating desc');
      const suppliersData = await suppliersResponse.json();
      const topSuppliers = suppliersData.value || [];

      // Get all suppliers count
      const allSuppliersResponse = await fetch('http://localhost:4005/odata/v4/procurement/Suppliers?$top=1&$count=true');
      const allSuppliersData = await allSuppliersResponse.json();
      const suppliersCount = allSuppliersData['@odata.count'] || topSuppliers.length;

      // Get materials
      const materialsResponse = await fetch('http://localhost:4005/odata/v4/procurement/Materials?$top=5');
      const materialsData = await materialsResponse.json();
      const recentMaterials = materialsData.value || [];

      // Get materials count
      const allMaterialsResponse = await fetch('http://localhost:4005/odata/v4/procurement/Materials?$top=1&$count=true');
      const allMaterialsData = await allMaterialsResponse.json();
      const materialsCount = allMaterialsData['@odata.count'] || recentMaterials.length;
      
      return {
        materialsCount: materialsCount.count || 0,
        suppliersCount: suppliersCount.count || 0,
        recentMaterials: recentMaterials,
        topSuppliers: topSuppliers,
        systemStatus: 'Active'
      };
      
    } catch (error) {
      console.error('❌ Error getting procurement context:', error);
      return {
        materialsCount: 0,
        suppliersCount: 0,
        recentMaterials: [],
        topSuppliers: [],
        systemStatus: 'Error'
      };
    }
  }

  /**
   * Add material to inventory
   * @param {Object} materialData - Material data
   * @returns {Object} - Result of operation
   */
  async addMaterial(materialData) {
    try {
      // Use HTTP request to add material
      const response = await fetch('http://localhost:4005/odata/v4/procurement/addMaterial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materialData)
      });

      const result = await response.json();

      return {
        success: true,
        message: `Material ${materialData.name} added successfully`,
        data: result
      };

    } catch (error) {
      console.error('❌ Error adding material:', error);
      return {
        success: false,
        message: `Failed to add material: ${error.message}`
      };
    }
  }

  /**
   * Place order from RFQ estimate
   * @param {Object} orderData - Order data with estimate
   * @returns {Object} - Order result
   */
  async placeOrderFromEstimate(orderData) {
    try {
      console.log('🛒 Placing order from estimate:', orderData);

      // Generate RFQ-style material ID
      const materialId = `RFQ-${Date.now()}-P1`;

      // Prepare material data for inventory
      const materialData = {
        ID: materialId,
        name: orderData.material,
        supplierName: orderData.supplier,
        quantity: orderData.quantity,
        category: this.getCategoryFromMaterial(orderData.material),
        unitPrice: orderData.unitPrice,
        currency: 'USD',
        unit: 'pcs',
        description: `${orderData.material} from ${orderData.supplier}`,
        location: 'Warehouse A',
        deliveryPeriod: orderData.leadTime || '7-10 days',
        stockStatus: 'Normal',
        isActive: true,
        lastUpdated: new Date().toISOString()
      };

      // Add to inventory
      const addResult = await this.addMaterial(materialData);

      if (addResult.success) {
        return {
          success: true,
          orderNumber: `PO-${Date.now()}`,
          materialId: materialId,
          message: `Order placed successfully. Material added to inventory.`,
          materialData: materialData
        };
      } else {
        return {
          success: false,
          message: `Failed to place order: ${addResult.message}`
        };
      }

    } catch (error) {
      console.error('❌ Error placing order:', error);
      return {
        success: false,
        message: `Failed to place order: ${error.message}`
      };
    }
  }

  /**
   * Get category from material name
   */
  getCategoryFromMaterial(material) {
    if (material.includes('Aluminum') || material.includes('Steel')) return 'Manufacturing';
    if (material.includes('Plastic')) return 'Manufacturing';
    if (material.includes('Casting')) return 'Manufacturing';
    if (material.includes('Fastener')) return 'Construction';
    return 'General';
  }

  /**
   * Create RFQ
   * @param {Object} rfqData - RFQ data
   * @returns {Object} - Created RFQ
   */
  async createRFQ(rfqData) {
    try {
      // Generate RFQ number
      const rfqNumber = `RFQ-${Date.now()}`;
      
      // In a real implementation, this would create an RFQ entity
      const rfq = {
        id: rfqNumber,
        ...rfqData,
        status: 'Draft',
        createdDate: new Date().toISOString()
      };
      
      return {
        success: true,
        rfq: rfq,
        message: `RFQ ${rfqNumber} created successfully`
      };
      
    } catch (error) {
      console.error('❌ Error creating RFQ:', error);
      return {
        success: false,
        message: `Failed to create RFQ: ${error.message}`
      };
    }
  }

  /**
   * Place order
   * @param {Object} orderData - Order data
   * @returns {Object} - Order result
   */
  async placeOrder(orderData) {
    try {
      // Generate order number
      const orderNumber = `PO-${Date.now()}`;
      
      // In a real implementation, this would:
      // 1. Create purchase order
      // 2. Update inventory
      // 3. Send notifications
      
      return {
        success: true,
        orderNumber: orderNumber,
        message: `Order ${orderNumber} placed successfully`
      };
      
    } catch (error) {
      console.error('❌ Error placing order:', error);
      return {
        success: false,
        message: `Failed to place order: ${error.message}`
      };
    }
  }

  /**
   * Get all suppliers for data upload to Pinecone
   * @returns {Array} - All suppliers
   */
  async getAllSuppliers() {
    try {
      // Use HTTP request to get suppliers from the service
      const response = await fetch('http://localhost:4005/odata/v4/procurement/Suppliers');
      const data = await response.json();
      return data.value || [];

    } catch (error) {
      console.error('❌ Error getting all suppliers:', error);
      return [];
    }
  }

  /**
   * Get all materials for data upload to Pinecone
   * @returns {Array} - All materials
   */
  async getAllMaterials() {
    try {
      const materials = await this.db.run(SELECT.from('sap_procurement_Materials'));
      return materials;

    } catch (error) {
      console.error('❌ Error getting all materials:', error);
      return [];
    }
  }
}

module.exports = { ProcurementActions };
