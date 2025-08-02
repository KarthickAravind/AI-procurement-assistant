const cds = require('@sap/cds');

async function testData() {
    try {
        console.log('🔍 Testing data access...');
        
        // Connect to database with explicit configuration
        const db = await cds.connect.to({
            kind: 'sqlite',
            credentials: { url: 'db.sqlite' }
        });
        console.log('✅ Connected to database');
        
        // Test supplier count
        const supplierCount = await db.run('SELECT COUNT(*) as count FROM sap_procurement_Suppliers');
        console.log(`📊 Total suppliers: ${supplierCount[0].count}`);
        
        // Test sample data
        const sampleSuppliers = await db.run('SELECT ID, name, category, region, rating FROM sap_procurement_Suppliers LIMIT 5');
        console.log('📋 Sample suppliers:');
        sampleSuppliers.forEach(supplier => {
            console.log(`  - ${supplier.ID}: ${supplier.name} (${supplier.category}, ${supplier.region}, Rating: ${supplier.rating})`);
        });
        
        // Test by region
        const regionCounts = await db.run(`
            SELECT region, COUNT(*) as count 
            FROM sap_procurement_Suppliers 
            GROUP BY region 
            ORDER BY count DESC
        `);
        console.log('🌍 Suppliers by region:');
        regionCounts.forEach(region => {
            console.log(`  - ${region.region}: ${region.count} suppliers`);
        });
        
        console.log('✅ Data test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing data:', error);
    }
}

testData().then(() => {
    console.log('🎉 Test completed!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
});
