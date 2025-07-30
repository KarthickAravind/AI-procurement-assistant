# Supplier Datasets Directory

This directory contains the supplier datasets for the AI-Powered Procurement Assistant.

## Dataset Files

Place your CSV files here with the following naming convention:

1. **construction_suppliers_dataset.csv** - 1000 construction suppliers
2. **logistics_suppliers_dataset.csv** - 1000 logistics suppliers  
3. **manufacturing_suppliers_dataset.csv** - 1000 manufacturing suppliers

## CSV Format

Each CSV file should have the following columns:
- Supplier ID
- Name
- Region
- Material
- Price per Unit (USD)
- Lead Time
- Rating

Example format:
```
Supplier ID,Name,Region,Material,Price per Unit (USD),Lead Time,Rating
8001,Scott Kelley and Kennedy,MEA,Shipping Containers,$2982.88,5 days,3.9/5.0
```

## Loading Data

After placing your CSV files here, run the data conversion script:
```bash
npm run convert-datasets
```

This will convert your datasets to the CAP-compatible format in the main data directory.
