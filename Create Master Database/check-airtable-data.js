/**
 * check-airtable-data.js
 * 
 * This script checks what data is already in Airtable for a specific job
 * or invoice number. It helps to verify the current state before updating.
 * 
 * Usage:
 * - Find by job: node check-airtable-data.js job NW-21491
 * - Find by invoice: node check-airtable-data.js invoice INV-34111
 */

const api = require('../direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Get Airtable base from the API module
const airtableBase = api.airtableBase;

async function checkAirtableData(type, searchValue) {
  try {
    console.log(`Searching Airtable for ${type}: ${searchValue}`);
    
    // Construct filter formula based on type
    let filterFormula;
    if (type === 'job') {
      filterFormula = `{Job} = '${searchValue}'`;
    } else if (type === 'invoice') {
      filterFormula = `{Invoice} = '${searchValue}'`;
    } else {
      console.error('Invalid search type. Use "job" or "invoice"');
      return;
    }
    
    // Query Airtable
    const records = await airtableBase('Invoices')
      .select({
        filterByFormula: filterFormula
      })
      .all();
    
    if (!records || records.length === 0) {
      console.log(`No records found in Airtable for ${type}: ${searchValue}`);
      return;
    }
    
    console.log(`Found ${records.length} record(s) in Airtable`);
    
    // Save the data to a file
    const outputDir = path.join(__dirname, '..', 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = `airtable-${type}-${searchValue}.json`;
    const filePath = path.join(outputDir, filename);
    
    // Format records for better readability
    const formattedRecords = records.map(record => ({
      id: record.id,
      fields: record.fields
    }));
    
    await fs.writeFile(filePath, JSON.stringify(formattedRecords, null, 2));
    console.log(`Saved Airtable data to: ${filePath}`);
    
    // Display a summary of each record
    console.log('\n=== AIRTABLE RECORDS SUMMARY ===');
    records.forEach((record, index) => {
      console.log(`\nRecord ${index + 1} of ${records.length}:`);
      displayRecordSummary(record.fields);
    });
    
  } catch (error) {
    console.error('Error checking Airtable data:', error.message);
  }
}

function displayRecordSummary(fields) {
  // Define important fields to display
  const basicFields = [
    'Job', 'Invoice', 'Status', 'Customer', 'Total', 'Invoice Date', 'Due Date'
  ];
  
  const contactFields = [
    'Site Contact Name', 'Site Contact Email', 'Site Contact Phone',
    'Main Contact Name', 'Main Contact Email', 'Main Contact Phone',
    'Billing Contact Name', 'Billing Contact Email', 'Billing Contact Phone'
  ];
  
  // Display basic information
  console.log('Basic Information:');
  basicFields.forEach(field => {
    if (fields[field] !== undefined) {
      console.log(`  ${field}: ${fields[field]}`);
    }
  });
  
  // Display contact information
  console.log('\nContact Information:');
  let hasContactInfo = false;
  
  contactFields.forEach(field => {
    if (fields[field]) {
      console.log(`  ${field}: ${fields[field]}`);
      hasContactInfo = true;
    }
  });
  
  if (!hasContactInfo) {
    console.log('  No contact information found');
  }
  
  // Show other available fields
  const otherFields = Object.keys(fields)
    .filter(key => !basicFields.includes(key) && !contactFields.includes(key));
  
  if (otherFields.length > 0) {
    console.log('\nOther Available Fields:');
    otherFields.forEach(field => {
      console.log(`  ${field}`);
    });
  }
}

// Main execution
const searchType = process.argv[2];
const searchValue = process.argv[3];

if (!searchType || !searchValue) {
  console.log('Please provide both search type and value');
  console.log('Usage:');
  console.log('  node check-airtable-data.js job NW-21491');
  console.log('  node check-airtable-data.js invoice INV-34111');
  process.exit(1);
}

// Validate search type
if (searchType !== 'job' && searchType !== 'invoice') {
  console.log('Invalid search type. Use "job" or "invoice"');
  process.exit(1);
}

// Run the function
checkAirtableData(searchType, searchValue)
  .then(() => console.log('\nProcess completed'))
  .catch(err => console.error('Error in main process:', err)); 