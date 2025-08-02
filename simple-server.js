const cds = require('@sap/cds');

// Set environment variables
process.env.PORT = '4004';

async function startServer() {
    try {
        console.log('🚀 Starting server on port 4004...');
        
        // Configure database
        cds.env.requires.db = {
            kind: 'sqlite',
            credentials: { url: 'db.sqlite' }
        };
        
        // Start server
        const server = await cds.serve('all', { port: 4004 });
        
        console.log('✅ Server started successfully!');
        console.log('🌐 Server running at: http://localhost:4004');
        console.log('📊 Admin Service: http://localhost:4004/admin');
        console.log('🛒 Procurement Service: http://localhost:4004/procurement');
        console.log('📱 Fiori App: http://localhost:4004/procurement-assistant/webapp/index.html');
        
        // Keep running
        setInterval(() => {
            console.log('🔄 Server is running...');
        }, 30000);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

startServer();
