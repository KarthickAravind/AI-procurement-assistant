#!/usr/bin/env node

/**
 * Data Loading Script
 * Loads suppliers data from JSON file into the database
 */

const cds = require('@sap/cds');

async function main() {
    try {
        console.log('🚀 Starting data loading process...');
        
        // Connect to database
        await cds.connect.to('db');
        console.log('✅ Connected to database');
        
        // Get the service
        const service = await cds.connect.to('ProcurementService');
        
        // Load suppliers data
        console.log('📊 Loading suppliers data...');
        const result = await service.send('loadSuppliersData');
        
        if (result.success) {
            console.log(`✅ ${result.message}`);
            
            // Initialize materials data
            console.log('📦 Initializing materials data...');
            const materialsResult = await service.send('initializeMaterialsData');
            
            if (materialsResult.success) {
                console.log(`✅ ${materialsResult.message}`);
            } else {
                console.log(`⚠️ Materials initialization: ${materialsResult.message}`);
            }
        } else {
            console.error(`❌ ${result.message}`);
            process.exit(1);
        }
        
        console.log('🎉 Data loading completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
main();
