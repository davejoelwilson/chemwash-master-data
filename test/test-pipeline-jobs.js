/**
 * Test script to fetch jobs from all pipeline stages
 * This will get jobs from all statuses shown in the status board:
 * PENDING, PRICING, SCHEDULING, IN PROGRESS, BACK COSTING, INVOICING, and PAYMENTS
 */

const api = require('../direct-fergus-api');

async function runTest() {
  try {
    console.log('Starting test to fetch jobs from all pipeline stages...');
    
    // This will fetch jobs from all pipeline stages and save them to all-pipeline-jobs.json
    const jobs = await api.fetchAllPipelineJobs();
    console.log(`Successfully fetched ${jobs.length} jobs from all pipeline stages!`);
    
    // Sync pipeline jobs to Airtable
    console.log('Starting to sync pipeline jobs to Airtable...');
    await api.syncAllPipelineJobsToAirtable();
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

// Run the test
runTest(); 