/**
 * Fergus to Airtable Data Sync Script
 * 
 * This script synchronizes job and invoice data from Fergus to Airtable.
 * 
 * Features:
 * - Fetches all active jobs from Fergus
 * - Updates existing job records in Airtable
 * - Adds new jobs that aren't in Airtable yet
 * - Tracks job status changes
 * - Looks for jobs that might have invoices
 * - Syncs invoice data to Airtable
 * 
 * Usage:
 * node sync-fergus-data.js
 */

const { syncAllToAirtable } = require('./direct-fergus-api');
require('dotenv').config();

// Validate environment variables
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('❌ Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env file');
  process.exit(1);
}

// Run the sync process
async function main() {
  try {
    console.log('🚀 Starting Fergus to Airtable sync process...');
    console.log(`Using Airtable base: ${process.env.AIRTABLE_BASE_ID}`);
    
    const startTime = Date.now();
    await syncAllToAirtable();
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`\n✅ Sync completed in ${duration.toFixed(2)} seconds`);
  } catch (error) {
    console.error('❌ Error in sync process:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 