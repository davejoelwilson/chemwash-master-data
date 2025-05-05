/**
 * Comprehensive Fergus to Airtable Sync Script
 * ============================================
 * 
 * This script is the main entry point for syncing data from Fergus to Airtable.
 * It will:
 * 1. Fetch jobs from all pipeline stages (PENDING, PRICING, SCHEDULING, IN PROGRESS, etc.)
 * 2. Fetch invoices associated with jobs
 * 3. Sync everything to Airtable
 * 
 * How to use:
 * 1. Make sure your .env file has valid Airtable and Fergus credentials
 * 2. Run this script with: node sync-all-fergus-data.js
 * 3. For scheduling, set up a cron job to run this script at regular intervals
 */

const api = require('./direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');

async function syncAllFergusData() {
  const startTime = new Date();
  console.log(`🚀 Starting comprehensive Fergus data sync at ${startTime.toISOString()}`);
  
  try {
    // Step 1: Sync jobs from active job statuses (e.g., To Price, To Schedule)
    console.log('📋 Step 1: Syncing active jobs...');
    await api.syncJobsToAirtable();
    console.log('✅ Active jobs synced successfully');
    
    // Step 2: Sync jobs from all pipeline stages
    console.log('📋 Step 2: Syncing jobs from all pipeline stages...');
    await api.syncAllPipelineJobsToAirtable();
    console.log('✅ Pipeline jobs synced successfully');
    
    // Step 3: Sync invoices
    console.log('📋 Step 3: Syncing invoices...');
    await api.syncInvoicesToAirtable();
    console.log('✅ Invoices synced successfully');
    
    // Save sync timestamp
    const endTime = new Date();
    const syncInfo = {
      lastSyncStartTime: startTime.toISOString(),
      lastSyncEndTime: endTime.toISOString(),
      syncDurationSeconds: (endTime - startTime) / 1000
    };
    
    await fs.writeFile(
      path.join(__dirname, 'last-sync-info.json'),
      JSON.stringify(syncInfo, null, 2)
    );
    
    console.log(`🎉 All Fergus data synced successfully!`);
    console.log(`⏱️ Total sync duration: ${syncInfo.syncDurationSeconds} seconds`);
  } catch (error) {
    console.error('❌ Error syncing Fergus data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    }
  }
}

// Run the sync
syncAllFergusData(); 