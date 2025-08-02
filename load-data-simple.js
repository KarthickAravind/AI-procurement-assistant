const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

async function loadData() {
    try {
        console.log('🔄 Loading suppliers data...');
        
        // Connect to database
        const db = await cds.connect.to('db');
        console.log('✅ Connected to database');
        
        // Clear existing data
        console.log('🗑️ Clearing existing data...');
        try {
            await db.run('DELETE FROM sap_procurement_SupplierProducts');
            await db.run('DELETE FROM sap_procurement_Suppliers');
        } catch (error) {
            console.log('⚠️ Tables might be empty or not exist yet:', error.message);
        }
        
        // Load JSON data
        const dataPath = path.join(__dirname, 'db/data/suppliers.json');
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
                await db.run(`
                    INSERT INTO sap_procurement_Suppliers 
                    (ID, name, category, material, region, leadTime, rating, contact, location, isActive, createdAt, modifiedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    supplier.ID,
                    supplier.name,
                    supplier.category,
                    supplier.material,
                    regionMap[supplier.region] || supplier.region,
                    supplier.leadTime,
                    supplier.rating,
                    supplier.contact,
                    supplier.location,
                    true,
                    new Date().toISOString(),
                    new Date().toISOString()
                ]);
                
                // Insert products
                if (supplier.products && Array.isArray(supplier.products)) {
                    for (const product of supplier.products) {
                        const productId = require('crypto').randomUUID();
                        await db.run(`
                            INSERT INTO sap_procurement_SupplierProducts 
                            (ID, supplier_ID, name, description, price, createdAt, modifiedAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [
                            productId,
                            supplier.ID,
                            product.name,
                            product.description,
                            product.price,
                            new Date().toISOString(),
                            new Date().toISOString()
                        ]);
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
loadData().then(() => {
    console.log('✅ Data loading completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
});
