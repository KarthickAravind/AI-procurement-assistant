const cds = require('@sap/cds');

async function fixData() {
    try {
        console.log('🔧 Fixing data connection...');
        
        // Connect to the database explicitly
        const db = await cds.connect.to({
            kind: 'sqlite',
            credentials: { url: 'db.sqlite' }
        });
        
        console.log('✅ Connected to database');
        
        // Test if data exists
        const count = await db.run('SELECT COUNT(*) as count FROM sap_procurement_Suppliers');
        console.log(`📊 Found ${count[0].count} suppliers in database`);
        
        if (count[0].count === 0) {
            console.log('❌ No suppliers found! Loading data...');
            
            // Load data from our script
            const { execSync } = require('child_process');
            execSync('node direct-insert.js', { stdio: 'inherit' });
            
            // Check again
            const newCount = await db.run('SELECT COUNT(*) as count FROM sap_procurement_Suppliers');
            console.log(`📊 After loading: ${newCount[0].count} suppliers`);
        }
        
        // Test sample data
        const sample = await db.run('SELECT ID, name, category, region FROM sap_procurement_Suppliers LIMIT 3');
        console.log('📋 Sample data:');
        sample.forEach(s => console.log(`  - ${s.ID}: ${s.name} (${s.category}, ${s.region})`));
        
        console.log('✅ Data is ready!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixData().then(() => {
    console.log('🎉 Data fix completed!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Failed:', error);
    process.exit(1);
});
