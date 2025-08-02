const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

/**
 * Load suppliers data from JSON file into database
 */
async function loadSuppliersData() {
    try {
        console.log('🔄 Starting data loading process...');
        
        // Get database entities
        const { Suppliers, SupplierProducts, Materials } = cds.entities('sap.procurement');
        
        // Clear existing data
        console.log('🗑️ Clearing existing data...');
        await DELETE.from(SupplierProducts);
        await DELETE.from(Suppliers);
        
        // Load new data from JSON file
        const dataPath = path.join(__dirname, '../db/data/suppliers.json');
        console.log('📁 Loading data from:', dataPath);
        
        if (!fs.existsSync(dataPath)) {
            throw new Error(`Data file not found: ${dataPath}`);
        }
        
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const suppliersData = JSON.parse(rawData);
        
        if (!suppliersData.suppliers || !Array.isArray(suppliersData.suppliers)) {
            throw new Error('Invalid JSON structure: expected suppliers array');
        }
        
        console.log(`📊 Found ${suppliersData.suppliers.length} suppliers to import`);
        
        // Process each supplier
        let successCount = 0;
        let errorCount = 0;
        
        for (const supplier of suppliersData.suppliers) {
            try {
                // Map region codes to readable names
                const regionMap = {
                    'AF': 'Africa',
                    'AS': 'Asia',
                    'AMER': 'Americas', 
                    'EU': 'Europe',
                    'OC': 'Oceania'
                };
                
                // Insert supplier
                await INSERT.into(Suppliers).entries({
                    ID: supplier.ID,
                    name: supplier.name,
                    category: supplier.category,
                    material: supplier.material,
                    region: regionMap[supplier.region] || supplier.region,
                    leadTime: supplier.leadTime,
                    rating: supplier.rating,
                    contact: supplier.contact,
                    location: supplier.location,
                    isActive: true
                });
                
                // Insert products for this supplier
                if (supplier.products && Array.isArray(supplier.products)) {
                    for (const product of supplier.products) {
                        await INSERT.into(SupplierProducts).entries({
                            ID: cds.utils.uuid(),
                            supplier_ID: supplier.ID,
                            name: product.name,
                            description: product.description,
                            price: product.price
                        });
                    }
                }
                
                successCount++;
                
                // Log progress every 50 suppliers
                if (successCount % 50 === 0) {
                    console.log(`✅ Processed ${successCount} suppliers...`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing supplier ${supplier.ID}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('🎉 Data loading completed!');
        console.log(`✅ Successfully loaded: ${successCount} suppliers`);
        console.log(`❌ Errors: ${errorCount} suppliers`);
        
        return {
            success: true,
            loaded: successCount,
            errors: errorCount,
            total: suppliersData.suppliers.length
        };
        
    } catch (error) {
        console.error('💥 Fatal error during data loading:', error);
        throw error;
    }
}

/**
 * Initialize sample materials data
 */
async function initializeMaterialsData() {
    try {
        const { Materials, Suppliers } = cds.entities('sap.procurement');
        
        // Get some suppliers for reference
        const suppliers = await SELECT.from(Suppliers).limit(5);
        
        if (suppliers.length === 0) {
            console.log('⚠️ No suppliers found, skipping materials initialization');
            return;
        }
        
        // Sample materials data
        const sampleMaterials = [
            {
                ID: 'MAT001',
                name: 'Steel Beams - Grade A',
                supplier_ID: suppliers[0].ID,
                quantity: 150,
                category: 'Manufacturing',
                unitPrice: 250.00,
                unit: 'pcs',
                description: 'High-grade steel beams for construction',
                location: 'Warehouse A',
                stockStatus: 'Normal'
            },
            {
                ID: 'MAT002', 
                name: 'Plastic Mold Cases',
                supplier_ID: suppliers[1].ID,
                quantity: 75,
                category: 'Manufacturing',
                unitPrice: 85.50,
                unit: 'pcs',
                description: 'Durable plastic molding cases',
                location: 'Warehouse B',
                stockStatus: 'Low Stock'
            }
        ];
        
        // Clear existing materials
        await DELETE.from(Materials);
        
        // Insert sample materials
        for (const material of sampleMaterials) {
            await INSERT.into(Materials).entries({
                ...material,
                isActive: true,
                minStockLevel: 10,
                maxStockLevel: 500,
                lastUpdated: new Date()
            });
        }
        
        console.log(`✅ Initialized ${sampleMaterials.length} sample materials`);
        
    } catch (error) {
        console.error('❌ Error initializing materials:', error);
    }
}

module.exports = {
    loadSuppliersData,
    initializeMaterialsData
};
