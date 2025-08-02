const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

async function loadSuppliers() {
    try {
        console.log('🔄 Starting suppliers data loading...');
        
        // Connect to database
        await cds.connect.to('db');
        console.log('✅ Connected to database');
        
        // Get entities using CDS model
        const db = await cds.connect.to('db');
        const model = cds.model;
        const Suppliers = model.definitions['sap.procurement.Suppliers'];
        const SupplierProducts = model.definitions['sap.procurement.SupplierProducts'];
        
        // Clear existing data
        console.log('🗑️ Clearing existing data...');
        await db.run(DELETE.from('sap.procurement.SupplierProducts'));
        await db.run(DELETE.from('sap.procurement.Suppliers'));
        
        // Load JSON data
        const dataPath = path.join(__dirname, 'db/data/suppliers.json');
        console.log('📁 Loading from:', dataPath);
        
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const suppliersData = JSON.parse(rawData);
        
        console.log(`📊 Found ${suppliersData.suppliers.length} suppliers`);
        
        // Region mapping
        const regionMap = {
            'AF': 'Africa',
            'AS': 'Asia', 
            'AMER': 'Americas',
            'EU': 'Europe',
            'OC': 'Oceania'
        };
        
        let successCount = 0;
        
        for (const supplier of suppliersData.suppliers) {
            try {
                // Insert supplier
                await db.run(INSERT.into(Suppliers).entries({
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
                }));
                
                // Insert products
                if (supplier.products && Array.isArray(supplier.products)) {
                    for (const product of supplier.products) {
                        await db.run(INSERT.into(SupplierProducts).entries({
                            ID: cds.utils.uuid(),
                            supplier_ID: supplier.ID,
                            name: product.name,
                            description: product.description,
                            price: product.price
                        }));
                    }
                }
                
                successCount++;
                
                if (successCount % 50 === 0) {
                    console.log(`✅ Processed ${successCount} suppliers...`);
                }
                
            } catch (error) {
                console.error(`❌ Error with supplier ${supplier.ID}:`, error.message);
            }
        }
        
        console.log(`🎉 Successfully loaded ${successCount} suppliers!`);
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

// Run the function
loadSuppliers().then(() => {
    console.log('✅ Data loading completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
});
