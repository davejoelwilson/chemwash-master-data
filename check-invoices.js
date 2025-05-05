/**
 * check-invoices.js
 * =================
 * 
 * This script checks the current invoices in Airtable to understand their structure.
 * It will help us identify what fields exist and what data is already there.
 */

// Import required libraries
require('dotenv').config();
const Airtable = require('airtable');

// Initialize Airtable with API key from .env file
const airtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

/**
 * Fetch and analyze all invoice records from Airtable
 */
async function checkInvoices() {
  try {
    console.log('Fetching invoices from Airtable...');
    
    // Get all invoices from the Invoices table
    const records = await airtableBase('Invoices')
      .select({
        maxRecords: 100 // Adjust this number if you have more invoices
      })
      .all();
    
    console.log(`Found ${records.length} invoices in Airtable.`);
    
    if (records.length === 0) {
      console.log('No invoices found in Airtable.');
      return;
    }
    
    // Extract all field names from the first record
    const firstRecord = records[0];
    const fieldNames = Object.keys(firstRecord.fields);
    
    console.log('\n--- FIELD NAMES ---');
    console.log(fieldNames.join(', '));
    
    // Display a sample of each invoice
    console.log('\n--- SAMPLE INVOICES ---');
    records.forEach((record, index) => {
      console.log(`\nINVOICE ${index + 1}:`);
      console.log(JSON.stringify(record.fields, null, 2));
      
      // Only show first 5 invoices to avoid overwhelming output
      if (index === 4 && records.length > 5) {
        console.log(`\n...and ${records.length - 5} more invoices.`);
        return false; // Break the forEach loop
      }
    });
    
    // Check for specific fields that might help with synchronization
    const hasInvoiceNumber = fieldNames.includes('Invoice Number');
    const hasInvoiceId = fieldNames.includes('Invoice ID');
    const hasJobNumber = fieldNames.includes('Fergus Job Number');
    
    console.log('\n--- ANALYSIS ---');
    console.log(`Has 'Invoice Number' field: ${hasInvoiceNumber}`);
    console.log(`Has 'Invoice ID' field: ${hasInvoiceId}`);
    console.log(`Has 'Fergus Job Number' field: ${hasJobNumber}`);
    
    // Analyze duplicate job numbers
    if (hasJobNumber) {
      const jobNumbers = new Map();
      records.forEach(record => {
        const jobNumber = record.fields['Fergus Job Number'];
        if (jobNumber) {
          if (jobNumbers.has(jobNumber)) {
            jobNumbers.set(jobNumber, jobNumbers.get(jobNumber) + 1);
          } else {
            jobNumbers.set(jobNumber, 1);
          }
        }
      });
      
      const duplicateJobNumbers = Array.from(jobNumbers.entries())
        .filter(([_, count]) => count > 1);
      
      if (duplicateJobNumbers.length > 0) {
        console.log('\n--- JOBS WITH MULTIPLE INVOICES ---');
        duplicateJobNumbers.forEach(([jobNumber, count]) => {
          console.log(`Job ${jobNumber} has ${count} invoices`);
        });
      }
    }
    
    // Provide insights and recommendations
    console.log('\n--- RECOMMENDATIONS ---');
    if (hasInvoiceNumber) {
      console.log('- Use "Invoice Number" as the unique identifier for syncing');
    } else if (hasInvoiceId) {
      console.log('- Use "Invoice ID" as the unique identifier for syncing');
    } else {
      console.log('- Create either an "Invoice Number" or "Invoice ID" field to use as a unique identifier');
    }
    
    if (hasJobNumber) {
      console.log('- Use "Fergus Job Number" to link invoices to their corresponding jobs');
    } else {
      console.log('- Consider adding a "Fergus Job Number" field to link invoices to jobs');
    }
    
  } catch (error) {
    console.error('Error checking invoices:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the function
if (require.main === module) {
  checkInvoices().then(() => {
    console.log('Invoice check completed.');
  }).catch(console.error);
}

module.exports = checkInvoices; 