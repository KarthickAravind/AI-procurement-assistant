const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

async function loadData() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Loading suppliers data directly into SQLite...');
        
        // Open database
        const db = new sqlite3.Database('db.sqlite', (err) => {
            if (err) {
                console.error('❌ Error opening database:', err);
                reject(err);
                return;
            }
            console.log('✅ Connected to SQLite database');
        });
        
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
        
        // Clear existing data
        db.serialize(() => {
            console.log('🗑️ Clearing existing data...');
            db.run('DELETE FROM sap_procurement_SupplierProducts');
            db.run('DELETE FROM sap_procurement_Suppliers');
            
            let successCount = 0;
            let errorCount = 0;
            
            // Prepare statements
            const supplierStmt = db.prepare(`
                INSERT INTO sap_procurement_Suppliers 
                (ID, name, category, material, region, leadTime, rating, contact, location, isActive, createdAt, modifiedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const productStmt = db.prepare(`
                INSERT INTO sap_procurement_SupplierProducts 
                (ID, supplier_ID, name, description, price, createdAt, modifiedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            // Process suppliers
            suppliersData.suppliers.forEach((supplier, index) => {
                try {
                    // Insert supplier
                    supplierStmt.run([
                        supplier.ID,
                        supplier.name,
                        supplier.category,
                        supplier.material,
                        regionMap[supplier.region] || supplier.region,
                        supplier.leadTime,
                        supplier.rating,
                        supplier.contact,
                        supplier.location,
                        1, // isActive = true
                        new Date().toISOString(),
                        new Date().toISOString()
                    ], function(err) {
                        if (err) {
                            console.error(`❌ Error inserting supplier ${supplier.ID}:`, err.message);
                            errorCount++;
                        } else {
                            successCount++;
                            
                            // Insert products
                            if (supplier.products && Array.isArray(supplier.products)) {
                                supplier.products.forEach(product => {
                                    const productId = require('crypto').randomUUID();
                                    productStmt.run([
                                        productId,
                                        supplier.ID,
                                        product.name,
                                        product.description,
                                        product.price,
                                        new Date().toISOString(),
                                        new Date().toISOString()
                                    ], function(err) {
                                        if (err) {
                                            console.error(`❌ Error inserting product for supplier ${supplier.ID}:`, err.message);
                                        }
                                    });
                                });
                            }
                            
                            if (successCount % 100 === 0) {
                                console.log(`✅ Processed ${successCount} suppliers...`);
                            }
                        }
                    });
                    
                } catch (error) {
                    console.error(`❌ Error processing supplier ${supplier.ID}:`, error.message);
                    errorCount++;
                }
            });
            
            // Finalize statements
            supplierStmt.finalize();
            productStmt.finalize();
            
            // Close database
            db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err);
                    reject(err);
                } else {
                    console.log(`🎉 Successfully loaded ${successCount} suppliers with ${errorCount} errors!`);
                    console.log('✅ Database closed');
                    resolve({ successCount, errorCount });
                }
            });
        });
    });
}

// Run the function
loadData().then((result) => {
    console.log('✅ Data loading completed successfully!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
});
