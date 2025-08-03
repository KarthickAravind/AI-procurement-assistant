/**
 * Pinecone Retriever - Vector search for semantic supplier/product matching
 * Uses Pinecone with llama-text-embed-v2 for similarity search
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
require('dotenv').config();

class PineconeRetriever {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔌 Initializing Pinecone connection...');
      
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      this.index = this.pinecone.index(process.env.PINECONE_INDEX_NAME);
      
      // Test connection
      const stats = await this.index.describeIndexStats();
      console.log('📊 Pinecone index stats:', stats);
      
      this.initialized = true;
      console.log('✅ Pinecone retriever initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Pinecone:', error);
      throw error;
    }
  }

  /**
   * Generate simple vector for text (placeholder until we implement proper embeddings)
   * @param {string} text - Text to vectorize
   * @returns {Array} - 1024-dimensional vector
   */
  generateSimpleVector(text) {
    // Create a simple hash-based vector (1024 dimensions)
    const vector = new Array(1024).fill(0);

    // Simple hash function to distribute text features
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * (i + 1)) % 1024;
      vector[index] += charCode / 1000; // Normalize
    }

    // Normalize the vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = vector[i] / magnitude;
      }
    }

    return vector;
  }

  /**
   * Search for suppliers using semantic similarity
   * @param {string} query - Natural language query
   * @param {number} topK - Number of results to return
   * @returns {Array} - Array of matching suppliers with scores
   */
  async searchSuppliers(query, topK = 5) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`🔍 Searching suppliers for: "${query}"`);

      // Generate vector for the query
      const queryVector = this.generateSimpleVector(query);

      // Query Pinecone index
      const queryResponse = await this.index.query({
        vector: queryVector,
        topK: topK,
        includeMetadata: true,
        includeValues: false,
        filter: {
          type: { $eq: 'supplier' }
        }
      });

      const results = queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
        supplier: match.metadata
      }));

      console.log(`✅ Found ${results.length} supplier matches`);
      return results;

    } catch (error) {
      console.error('❌ Error searching suppliers:', error);
      return [];
    }
  }

  /**
   * Search for products using semantic similarity
   * @param {string} query - Natural language query
   * @param {number} topK - Number of results to return
   * @returns {Array} - Array of matching products with scores
   */
  async searchProducts(query, topK = 5) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`🔍 Searching products for: "${query}"`);

      // Generate vector for the query
      const queryVector = this.generateSimpleVector(query);

      const queryResponse = await this.index.query({
        vector: queryVector,
        topK: topK,
        includeMetadata: true,
        includeValues: false,
        filter: {
          type: { $eq: 'product' }
        }
      });

      const results = queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
        product: match.metadata
      }));

      console.log(`✅ Found ${results.length} product matches`);
      return results;

    } catch (error) {
      console.error('❌ Error searching products:', error);
      return [];
    }
  }

  /**
   * General semantic search across all types
   * @param {string} query - Natural language query
   * @param {number} topK - Number of results to return
   * @returns {Array} - Array of matching items with scores
   */
  async semanticSearch(query, topK = 10) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`🔍 Performing semantic search for: "${query}"`);

      // Generate vector for the query
      const queryVector = this.generateSimpleVector(query);

      // Search without type filter to get all relevant results
      const queryResponse = await this.index.query({
        vector: queryVector,
        topK: topK,
        includeMetadata: true,
        includeValues: false
      });

      const results = queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
        type: match.metadata.type,
        data: match.metadata
      }));

      console.log(`✅ Found ${results.length} semantic matches`);
      return results;

    } catch (error) {
      console.error('❌ Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Find suppliers similar to a given supplier
   * @param {string} supplierName - Name of the reference supplier
   * @param {number} topK - Number of similar suppliers to return
   * @returns {Array} - Array of similar suppliers
   */
  async findSimilarSuppliers(supplierName, topK = 5) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`🔍 Finding suppliers similar to: "${supplierName}"`);

      // First, find the reference supplier
      const referenceQuery = await this.index.query({
        topK: 1,
        includeMetadata: true,
        includeValues: true,
        filter: {
          type: { $eq: 'supplier' },
          name: { $eq: supplierName }
        }
      });

      if (referenceQuery.matches.length === 0) {
        console.log(`❌ Reference supplier "${supplierName}" not found`);
        return [];
      }

      const referenceVector = referenceQuery.matches[0].values;

      // Find similar suppliers using the reference vector
      const similarQuery = await this.index.query({
        vector: referenceVector,
        topK: topK + 1, // +1 to exclude the reference supplier itself
        includeMetadata: true,
        includeValues: false,
        filter: {
          type: { $eq: 'supplier' }
        }
      });

      // Filter out the reference supplier and return results
      const results = similarQuery.matches
        .filter(match => match.metadata.name !== supplierName)
        .slice(0, topK)
        .map(match => ({
          id: match.id,
          score: match.score,
          supplier: match.metadata
        }));

      console.log(`✅ Found ${results.length} similar suppliers`);
      return results;

    } catch (error) {
      console.error('❌ Error finding similar suppliers:', error);
      return [];
    }
  }

  /**
   * Upsert supplier data to Pinecone index
   * @param {Array} suppliers - Array of supplier objects
   */
  async upsertSuppliers(suppliers) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`📤 Upserting ${suppliers.length} suppliers to Pinecone...`);

      const vectors = suppliers.map(supplier => {
        // Create a text representation for embedding
        const text = `Supplier: ${supplier.name}, Category: ${supplier.category}, Region: ${supplier.region}, Material: ${supplier.material}, Rating: ${supplier.rating}/5, Lead time: ${supplier.leadTime}, Location: ${supplier.location}, Contact: ${supplier.contact}`;

        // For now, create a simple vector (we'll use Pinecone's inference API later)
        // Generate a simple hash-based vector as placeholder
        const vector = this.generateSimpleVector(text);

        return {
          id: `supplier-${supplier.ID}`,
          values: vector,
          metadata: {
            type: 'supplier',
            id: supplier.ID,
            name: supplier.name,
            category: supplier.category,
            region: supplier.region,
            material: supplier.material,
            rating: supplier.rating,
            leadTime: supplier.leadTime,
            contact: supplier.contact,
            location: supplier.location,
            text: text // Store text in metadata for reference
          }
        };
      });

      // Upsert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
        console.log(`✅ Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
      }

      console.log(`✅ Successfully upserted ${suppliers.length} suppliers`);

    } catch (error) {
      console.error('❌ Error upserting suppliers:', error);
      throw error;
    }
  }

  /**
   * Upsert product data to Pinecone index
   * @param {Array} products - Array of product objects
   */
  async upsertProducts(products) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`📤 Upserting ${products.length} products to Pinecone...`);

      const vectors = products.map(product => {
        const text = `Product: ${product.name}, Description: ${product.description}, Category: ${product.category}, Price: ${product.price} ${product.currency}, Unit: ${product.unit}, Availability: ${product.availability}`;
        const vector = this.generateSimpleVector(text);

        return {
          id: `product-${product.ID}`,
          values: vector,
          metadata: {
            type: 'product',
            id: product.ID,
            name: product.name,
            description: product.description,
            category: product.category,
            price: product.price,
            currency: product.currency,
            unit: product.unit,
            availability: product.availability,
            supplierId: product.supplier_ID,
            text: text
          }
        };
      });

      // Upsert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
        console.log(`✅ Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
      }

      console.log(`✅ Successfully upserted ${products.length} products`);

    } catch (error) {
      console.error('❌ Error upserting products:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const stats = await this.index.describeIndexStats();
      return stats;

    } catch (error) {
      console.error('❌ Error getting index stats:', error);
      return null;
    }
  }

  /**
   * Delete all vectors from index (use with caution)
   */
  async clearIndex() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🗑️ Clearing Pinecone index...');
      await this.index.deleteAll();
      console.log('✅ Index cleared successfully');

    } catch (error) {
      console.error('❌ Error clearing index:', error);
      throw error;
    }
  }
}

module.exports = { PineconeRetriever };
