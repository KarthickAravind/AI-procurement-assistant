// Test script to simulate RFQ flow
const testRFQFlow = async () => {
    console.log('🧪 Testing RFQ Flow...');
    
    // Test data
    const testSupplier = {
        ID: 1001,
        name: "NextGenSolutions",
        category: "Manufacturing",
        material: "Aluminum Sheets",
        leadTime: "7-10 days",
        contact: "nextgensolutions@tradesupply.net",
        location: "Addis Ababa"
    };
    
    const testProducts = [
        {ID: "P1", name: "Aluminum Sheets - Standard", description: "Standard quality Aluminum Sheets", price: "100"},
        {ID: "P2", name: "Aluminum Sheets - Premium", description: "Premium quality Aluminum Sheets", price: "150"}
    ];
    
    const rfqNumber = "RFQ-" + Date.now();
    
    console.log('📋 RFQ Number:', rfqNumber);
    console.log('🏭 Supplier:', testSupplier.name);
    console.log('📦 Products:', testProducts.length);
    
    // Simulate adding materials to inventory
    for (let i = 0; i < testProducts.length; i++) {
        const product = testProducts[i];
        const quantity = i + 1; // 1, 2, etc.
        
        const materialData = {
            ID: rfqNumber + "-" + product.ID,
            name: product.name,
            supplierName: testSupplier.name,
            quantity: quantity,
            category: testSupplier.category,
            unitPrice: parseFloat(product.price),
            currency: "USD",
            unit: "pcs",
            description: product.description,
            location: "Warehouse A",
            deliveryPeriod: testSupplier.leadTime
        };
        
        console.log(`📤 Adding material ${i + 1}:`, materialData);
        
        try {
            const response = await fetch('http://localhost:4004/odata/v4/procurement/addMaterial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(materialData)
            });
            
            const result = await response.json();
            console.log(`✅ Material ${i + 1} result:`, result);
            
            if (!result.success) {
                console.error(`❌ Failed to add material ${i + 1}:`, result.message);
            }
        } catch (error) {
            console.error(`💥 Error adding material ${i + 1}:`, error);
        }
    }
    
    // Check if materials were added
    console.log('🔍 Checking inventory...');
    try {
        const response = await fetch('http://localhost:4004/odata/v4/procurement/Materials?$filter=contains(ID,\'' + rfqNumber + '\')');
        const data = await response.json();
        const addedMaterials = data.value || [];
        
        console.log(`📊 Found ${addedMaterials.length} materials with RFQ number ${rfqNumber}`);
        addedMaterials.forEach((material, index) => {
            console.log(`  ${index + 1}. ${material.ID}: ${material.name} (${material.quantity} ${material.unit}) - Supplier: ${material.supplierName}, Delivery: ${material.deliveryPeriod}`);
        });
        
        if (addedMaterials.length === testProducts.length) {
            console.log('🎉 RFQ Flow Test PASSED! All materials added successfully.');
        } else {
            console.log('⚠️ RFQ Flow Test PARTIAL: Expected ' + testProducts.length + ' materials, found ' + addedMaterials.length);
        }
        
    } catch (error) {
        console.error('💥 Error checking inventory:', error);
    }
};

// Run the test
testRFQFlow();
