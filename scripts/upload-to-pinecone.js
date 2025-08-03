/**
 * Upload Suppliers and Materials to Pinecone Vector Database
 * One-time script to populate Pinecone index with embeddings
 */

const cds = require('@sap/cds');
const { PineconeRetriever } = require('../srv/ai-chat/retriever');
const { ProcurementActions } = require('../srv/ai-chat/actions');
require('dotenv').config();

class PineconeUploader {
  constructor() {
    this.retriever = new PineconeRetriever();
    this.actions = new ProcurementActions();
  }

  async initialize() {
    console.log('🚀 Initializing Pinecone uploader...');
    
    // Connect to CDS service
    await cds.connect.to('db');
    
    // Initialize components
    await this.retriever.initialize();
    await this.actions.initialize();
    
    console.log('✅ Pinecone uploader initialized');
  }

  /**
   * Upload all suppliers to Pinecone
   */
  async uploadSuppliers() {
    try {
      console.log('📤 Starting supplier upload to Pinecone...');
      
      // Get all suppliers from database
      const suppliers = await this.actions.getAllSuppliers();
      console.log(`📊 Found ${suppliers.length} suppliers to upload`);
      
      if (suppliers.length === 0) {
        console.log('⚠️ No suppliers found. Make sure to load supplier data first.');
        return;
      }
      
      // Upload to Pinecone
      await this.retriever.upsertSuppliers(suppliers);
      
      console.log(`✅ Successfully uploaded ${suppliers.length} suppliers to Pinecone`);
      
    } catch (error) {
      console.error('❌ Error uploading suppliers:', error);
      throw error;
    }
  }

  /**
   * Upload all materials to Pinecone
   */
  async uploadMaterials() {
    try {
      console.log('📤 Starting materials upload to Pinecone...');
      
      // Get all materials from database
      const materials = await this.actions.getAllMaterials();
      console.log(`📊 Found ${materials.length} materials to upload`);
      
      if (materials.length === 0) {
        console.log('⚠️ No materials found. Materials will be uploaded as they are added.');
        return;
      }
      
      // Transform materials to product format for Pinecone
      const products = materials.map(material => ({
        ID: material.ID,
        name: material.name,
        description: material.description || `${material.name} - ${material.category}`,
        category: material.category,
        price: material.unitPrice || 0,
        currency: material.currency_code || 'USD',
        unit: material.unit || 'pcs',
        availability: material.stockStatus || 'Available',
        supplier_ID: material.supplier_ID
      }));
      
      // Upload to Pinecone
      await this.retriever.upsertProducts(products);
      
      console.log(`✅ Successfully uploaded ${products.length} materials to Pinecone`);
      
    } catch (error) {
      console.error('❌ Error uploading materials:', error);
      throw error;
    }
  }

  /**
   * Clear Pinecone index (use with caution)
   */
  async clearIndex() {
    try {
      console.log('🗑️ Clearing Pinecone index...');
      await this.retriever.clearIndex();
      console.log('✅ Pinecone index cleared');
      
    } catch (error) {
      console.error('❌ Error clearing index:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats() {
    try {
      console.log('📊 Getting Pinecone index statistics...');
      const stats = await this.retriever.getIndexStats();
      
      if (stats) {
        console.log('📈 Index Statistics:');
        console.log(`   Total Vectors: ${stats.totalVectorCount || 0}`);
        console.log(`   Index Fullness: ${((stats.indexFullness || 0) * 100).toFixed(2)}%`);
        console.log(`   Dimension: ${stats.dimension || 'Unknown'}`);
        
        if (stats.namespaces) {
          console.log('   Namespaces:');
          Object.entries(stats.namespaces).forEach(([namespace, data]) => {
            console.log(`     ${namespace}: ${data.vectorCount || 0} vectors`);
          });
        }
      } else {
        console.log('❌ Could not retrieve index statistics');
      }
      
    } catch (error) {
      console.error('❌ Error getting index stats:', error);
      throw error;
    }
  }

  /**
   * Test vector search
   */
  async testSearch() {
    try {
      console.log('🔍 Testing vector search...');
      
      // Test supplier search
      console.log('\n🏭 Testing supplier search:');
      const supplierResults = await this.retriever.searchSuppliers('USB cable suppliers in Asia', 3);
      console.log(`Found ${supplierResults.length} supplier matches:`);
      supplierResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.supplier.name} (Score: ${result.score.toFixed(3)})`);
      });
      
      // Test semantic search
      console.log('\n🔍 Testing semantic search:');
      const semanticResults = await this.retriever.semanticSearch('electronics manufacturing', 3);
      console.log(`Found ${semanticResults.length} semantic matches:`);
      semanticResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.data.name} (${result.type}) (Score: ${result.score.toFixed(3)})`);
      });
      
    } catch (error) {
      console.error('❌ Error testing search:', error);
      throw error;
    }
  }

  /**
   * Full upload process
   */
  async uploadAll() {
    try {
      await this.initialize();
      
      console.log('🚀 Starting full upload process...');
      
      // Get initial stats
      await this.getIndexStats();
      
      // Upload suppliers
      await this.uploadSuppliers();
      
      // Upload materials
      await this.uploadMaterials();
      
      // Get final stats
      console.log('\n📊 Final index statistics:');
      await this.getIndexStats();
      
      // Test search functionality
      console.log('\n🧪 Testing search functionality:');
      await this.testSearch();
      
      console.log('\n🎉 Upload process completed successfully!');
      
    } catch (error) {
      console.error('❌ Upload process failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const uploader = new PineconeUploader();
  
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'upload':
        await uploader.uploadAll();
        break;
        
      case 'suppliers':
        await uploader.initialize();
        await uploader.uploadSuppliers();
        break;
        
      case 'materials':
        await uploader.initialize();
        await uploader.uploadMaterials();
        break;
        
      case 'clear':
        await uploader.initialize();
        await uploader.clearIndex();
        break;
        
      case 'stats':
        await uploader.initialize();
        await uploader.getIndexStats();
        break;
        
      case 'test':
        await uploader.initialize();
        await uploader.testSearch();
        break;
        
      default:
        console.log(`
🤖 Pinecone Upload Script

Usage: node scripts/upload-to-pinecone.js <command>

Commands:
  upload     - Upload all suppliers and materials to Pinecone
  suppliers  - Upload only suppliers
  materials  - Upload only materials
  clear      - Clear the Pinecone index (use with caution)
  stats      - Show index statistics
  test       - Test search functionality

Examples:
  node scripts/upload-to-pinecone.js upload
  node scripts/upload-to-pinecone.js stats
  node scripts/upload-to-pinecone.js test
        `);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { PineconeUploader };
