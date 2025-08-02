const cds = require('@sap/cds');

async function startServer() {
    try {
        console.log('🚀 Starting CAP server...');

        // Start the server
        const server = await cds.serve('all');

        const port = server.server?.address()?.port || process.env.PORT || 4004;
        console.log(`✅ Server started successfully!`);
        console.log(`🌐 Server running at: http://localhost:${port}`);
        console.log(`📊 Admin Service: http://localhost:${port}/admin`);
        console.log(`🛒 Procurement Service: http://localhost:${port}/procurement`);
        console.log(`📱 Fiori App: http://localhost:${port}/procurement-assistant/webapp/index.html`);

        // Keep the process running
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down server...');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error starting server:', error);
        process.exit(1);
    }
}

startServer();
