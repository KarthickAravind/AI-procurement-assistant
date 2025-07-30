const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const datasetsDir = path.join(__dirname, '../db/data/datasets');
const outputDir = path.join(__dirname, '../db/data');

// Dataset files to process
const datasetFiles = [
    'construction_suppliers_dataset.csv',
    'logistics_suppliers_dataset.csv', 
    'manufacturing_suppliers_dataset.csv'
];

// Function to convert dataset to CAP format
function convertDataset(inputFile, category) {
    return new Promise((resolve, reject) => {
        const results = [];
        const inputPath = path.join(datasetsDir, inputFile);
        
        if (!fs.existsSync(inputPath)) {
            console.log(`⚠️  Dataset file not found: ${inputFile}`);
            console.log(`   Please place your dataset in: ${inputPath}`);
            resolve([]);
            return;
        }

        console.log(`📖 Processing ${inputFile}...`);
        
        fs.createReadStream(inputPath)
            .pipe(csv())
            .on('data', (data) => {
                // Convert your dataset format to CAP format
                const supplier = {
                    ID: data['Supplier ID'] || data['ID'],
                    name: data['Name'] || data['name'],
                    region: data['Region'] || data['region'],
                    material: data['Material'] || data['material'],
                    pricePerUnit: parseFloat((data['Price per Unit (USD)'] || data['Price per Unit'] || '0').replace(/[$,]/g, '')),
                    currency_code: 'USD',
                    leadTime: parseInt((data['Lead Time'] || '0').replace(/[^\d]/g, '')),
                    rating: parseFloat((data['Rating'] || '0').replace(/[^\d.]/g, '')),
                    category: category,
                    contactEmail: `contact@${(data['Name'] || 'supplier').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
                    contactPhone: '+1-555-000-0000',
                    address: `${data['Region'] || 'Unknown'} Office`,
                    isActive: true
                };
                results.push(supplier);
            })
            .on('end', () => {
                console.log(`✅ Processed ${results.length} suppliers from ${inputFile}`);
                resolve(results);
            })
            .on('error', reject);
    });
}

// Main conversion function
async function convertAllDatasets() {
    console.log('🚀 Starting dataset conversion...\n');
    
    let allSuppliers = [];
    let startingID = 9000; // Start from ID 9000 to avoid conflicts
    
    // Process each dataset
    for (let i = 0; i < datasetFiles.length; i++) {
        const file = datasetFiles[i];
        const category = file.split('_')[0]; // construction, logistics, manufacturing
        
        const suppliers = await convertDataset(file, category);
        
        // Assign sequential IDs
        suppliers.forEach((supplier, index) => {
            supplier.ID = startingID + index;
        });
        
        allSuppliers = allSuppliers.concat(suppliers);
        startingID += 1000; // Leave space for next category
    }
    
    if (allSuppliers.length === 0) {
        console.log('\n⚠️  No datasets found to convert.');
        console.log('📁 Please place your CSV files in: db/data/datasets/');
        console.log('   Expected files:');
        datasetFiles.forEach(file => console.log(`   - ${file}`));
        return;
    }
    
    // Generate CAP-compatible CSV
    const outputFile = path.join(outputDir, 'sap.procurement-Suppliers-bulk.csv');
    const headers = 'ID;name;region;material;pricePerUnit;currency_code;leadTime;rating;category;contactEmail;contactPhone;address;isActive';
    
    let csvContent = headers + '\n';
    allSuppliers.forEach(supplier => {
        csvContent += `${supplier.ID};${supplier.name};${supplier.region};${supplier.material};${supplier.pricePerUnit};${supplier.currency_code};${supplier.leadTime};${supplier.rating};${supplier.category};${supplier.contactEmail};${supplier.contactPhone};${supplier.address};${supplier.isActive}\n`;
    });
    
    fs.writeFileSync(outputFile, csvContent);
    
    console.log(`\n✅ Conversion complete!`);
    console.log(`📊 Total suppliers processed: ${allSuppliers.length}`);
    console.log(`📁 Output file: ${outputFile}`);
    console.log(`\n🚀 You can now restart your CAP server to load the new data.`);
}

// Run the conversion
convertAllDatasets().catch(console.error);
