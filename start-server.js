const cds = require('@sap/cds');

async function startServer() {
    try {
        console.log('🚀 Starting AI Procurement Assistant server...');
        
        // Configure database explicitly
        cds.env.requires.db = {
            kind: 'sqlite',
            credentials: { url: 'db.sqlite' }
        };
        
        // Start the server
        const server = await cds.serve('all');
        
        const port = server.server.address().port;
        console.log(`✅ Server started successfully!`);
        console.log(`🌐 Server running at: http://localhost:${port}`);
        console.log(`📊 Admin Service: http://localhost:${port}/admin`);
        console.log(`🛒 Procurement Service: http://localhost:${port}/procurement`);
        console.log(`📱 Fiori App: http://localhost:${port}/procurement-assistant/webapp/index.html`);
        console.log(`📋 Service Index: http://localhost:${port}`);
        
        // Test database connection
        console.log('\n🔍 Testing database connection...');
        const db = await cds.connect.to('db');
        const supplierCount = await db.run('SELECT COUNT(*) as count FROM sap_procurement_Suppliers');
        console.log(`📊 Database connected! Found ${supplierCount[0].count} suppliers`);
        
        // Keep the process running
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down server...');
            process.exit(0);
        });
        
        console.log('\n🎉 Server is ready! Press Ctrl+C to stop.');
        
    } catch (error) {
        console.error('❌ Error starting server:', error);
        process.exit(1);
    }
}

startServer();
