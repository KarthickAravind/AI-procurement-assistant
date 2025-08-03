/**
 * Product-Material Mapping System
 * Maps specific products to their broader material categories
 */

class ProductMaterialMapper {
  constructor() {
    // Comprehensive mapping of products to material categories
    this.productToMaterialMap = {
      // Electronics & Connectors
      'usb hub': ['Connectors', 'Electronic Components'],
      'usb cable': ['Cables', 'Connectors'],
      'hdmi cable': ['Cables', 'Connectors'],
      'ethernet cable': ['Cables', 'Connectors'],
      'power cable': ['Cables', 'Electronic Components'],
      'connector': ['Connectors'],
      'adapter': ['Connectors', 'Electronic Components'],
      'charger': ['Electronic Components', 'Connectors'],
      'circuit board': ['Circuit Boards', 'Electronic Components'],
      'pcb': ['Circuit Boards', 'Electronic Components'],
      'resistor': ['Electronic Components'],
      'capacitor': ['Electronic Components'],
      'transistor': ['Electronic Components'],
      'led': ['Electronic Components'],
      'sensor': ['Electronic Components'],
      'microcontroller': ['Electronic Components', 'Circuit Boards'],
      
      // Construction Materials
      'brick': ['Bricks'],
      'cement': ['Cement Mix'],
      'concrete': ['Cement Mix'],
      'steel beam': ['Construction Steel'],
      'rebar': ['Construction Steel'],
      'steel rod': ['Construction Steel'],
      'steel pipe': ['Construction Steel', 'Pipes'],
      'aluminum sheet': ['Aluminum Sheets'],
      'aluminum plate': ['Aluminum Sheets'],
      'aluminum foil': ['Aluminum Sheets'],
      
      // Industrial Equipment
      'conveyor belt': ['Conveyor Belts'],
      'belt': ['Conveyor Belts'],
      'motor': ['Motors', 'Electronic Components'],
      'pump': ['Pumps', 'Motors'],
      'valve': ['Valves', 'Pipes'],
      'bearing': ['Bearings', 'Mechanical Parts'],
      'gear': ['Gears', 'Mechanical Parts'],
      
      // Fasteners & Hardware
      'screw': ['Industrial Fasteners', 'Fasteners'],
      'bolt': ['Industrial Fasteners', 'Fasteners'],
      'nut': ['Industrial Fasteners', 'Fasteners'],
      'washer': ['Industrial Fasteners', 'Fasteners'],
      'nail': ['Industrial Fasteners', 'Fasteners'],
      'rivet': ['Industrial Fasteners', 'Fasteners'],
      
      // Casting & Molding
      'cast iron': ['Casting Materials'],
      'molded part': ['Casting Materials', 'Plastic Molding'],
      'injection molding': ['Plastic Molding'],
      'plastic part': ['Plastic Molding'],
      'rubber part': ['Rubber Components', 'Plastic Molding'],
      
      // Textiles & Materials
      'fabric': ['Textiles', 'Raw Materials'],
      'thread': ['Textiles', 'Raw Materials'],
      'yarn': ['Textiles', 'Raw Materials'],
      'leather': ['Leather Goods', 'Raw Materials'],
      
      // Glass & Ceramics
      'glass': ['Glass Products'],
      'window': ['Glass Products'],
      'ceramic': ['Ceramics'],
      'tile': ['Ceramics', 'Construction Materials'],
      
      // Chemicals & Adhesives
      'adhesive': ['Adhesives', 'Chemicals'],
      'glue': ['Adhesives', 'Chemicals'],
      'paint': ['Paints', 'Chemicals'],
      'coating': ['Coatings', 'Chemicals'],
      'solvent': ['Solvents', 'Chemicals'],
      
      // Tools & Equipment
      'drill': ['Tools', 'Equipment'],
      'hammer': ['Tools', 'Equipment'],
      'wrench': ['Tools', 'Equipment'],
      'saw': ['Tools', 'Equipment'],
      'measuring tape': ['Tools', 'Equipment']
    };

    // Create reverse mapping for faster lookups
    this.materialToProductsMap = {};
    for (const [product, materials] of Object.entries(this.productToMaterialMap)) {
      for (const material of materials) {
        if (!this.materialToProductsMap[material]) {
          this.materialToProductsMap[material] = [];
        }
        this.materialToProductsMap[material].push(product);
      }
    }
  }

  /**
   * Find material categories for a given product search term
   * @param {string} searchTerm - Product or material to search for
   * @returns {Array} - Array of matching material categories
   */
  findMaterialsForProduct(searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    const matchingMaterials = new Set();

    // Direct product match
    if (this.productToMaterialMap[lowerSearchTerm]) {
      this.productToMaterialMap[lowerSearchTerm].forEach(material => 
        matchingMaterials.add(material)
      );
    }

    // Partial product match
    for (const [product, materials] of Object.entries(this.productToMaterialMap)) {
      if (product.includes(lowerSearchTerm) || lowerSearchTerm.includes(product)) {
        materials.forEach(material => matchingMaterials.add(material));
      }
    }

    // Check if search term is already a material category
    for (const material of Object.keys(this.materialToProductsMap)) {
      if (material.toLowerCase().includes(lowerSearchTerm) || 
          lowerSearchTerm.includes(material.toLowerCase())) {
        matchingMaterials.add(material);
      }
    }

    return Array.from(matchingMaterials);
  }

  /**
   * Find products for a given material category
   * @param {string} material - Material category
   * @returns {Array} - Array of products in this category
   */
  findProductsForMaterial(material) {
    return this.materialToProductsMap[material] || [];
  }

  /**
   * Get enhanced search terms for better matching
   * @param {string} searchTerm - Original search term
   * @returns {Object} - Enhanced search information
   */
  getEnhancedSearchTerms(searchTerm) {
    const materials = this.findMaterialsForProduct(searchTerm);
    const relatedProducts = new Set();

    // Find related products through shared materials
    materials.forEach(material => {
      const products = this.findProductsForMaterial(material);
      products.forEach(product => relatedProducts.add(product));
    });

    // Also add the search term itself as a potential product name
    // This allows direct product name searches like "USB Hub", "Plastic Mold Case"
    const productSearchTerms = [searchTerm];

    return {
      originalTerm: searchTerm,
      matchingMaterials: materials,
      productSearchTerms: productSearchTerms, // NEW: Direct product search terms
      relatedProducts: Array.from(relatedProducts),
      searchSuggestions: this.generateSearchSuggestions(searchTerm)
    };
  }

  /**
   * Generate search suggestions for better user experience
   * @param {string} searchTerm - Original search term
   * @returns {Array} - Array of suggested search terms
   */
  generateSearchSuggestions(searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const suggestions = new Set();

    // Find similar products
    for (const product of Object.keys(this.productToMaterialMap)) {
      if (product.includes(lowerSearchTerm) || 
          this.calculateSimilarity(product, lowerSearchTerm) > 0.6) {
        suggestions.add(product);
      }
    }

    return Array.from(suggestions).slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Calculate similarity between two strings (simple implementation)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

// Export singleton instance
module.exports = new ProductMaterialMapper();
