/**
 * run-all-sync.js
 * ===============
 * 
 * Runs all three sync steps in sequence:
 * 1. Sync active jobs
 * 2. Sync pipeline jobs
 * 3. Sync invoices
 * 
 * How to use:
 * node run-all-sync.js
 */

const syncActiveJobs = require('./1.sync-active-jobs');
const syncPipelineJobs = require('./2.sync-pipeline-jobs');
const syncInvoices = require('./3.sync-invoices');
const fs = require('fs').promises;
const path = require('path');

async function runAllSync() {
  const startTime = new Date();
  console.log(`🚀 Starting full Fergus to Airtable sync at ${startTime.toISOString()}`);
  
  const results = {
    startTime: startTime.toISOString(),
    steps: []
  };
  
  try {
    // Step 1: Sync active jobs
    console.log('\n==================================================');
    console.log('STEP 1: SYNCING ACTIVE JOBS');
    console.log('==================================================\n');
    
    const activeJobsResult = await syncActiveJobs();
    results.steps.push({
      name: 'active-jobs',
      ...activeJobsResult
    });
    
    // Step 2: Sync pipeline jobs
    console.log('\n==================================================');
    console.log('STEP 2: SYNCING PIPELINE JOBS');
    console.log('==================================================\n');
    
    const pipelineJobsResult = await syncPipelineJobs();
    results.steps.push({
      name: 'pipeline-jobs',
      ...pipelineJobsResult
    });
    
    // Step 3: Sync invoices
    console.log('\n==================================================');
    console.log('STEP 3: SYNCING INVOICES');
    console.log('==================================================\n');
    
    const invoicesResult = await syncInvoices();
    results.steps.push({
      name: 'invoices',
      ...invoicesResult
    });
    
    // Calculate and log summary
    const endTime = new Date();
    const totalDurationSeconds = (endTime - startTime) / 1000;
    
    results.endTime = endTime.toISOString();
    results.totalDurationSeconds = totalDurationSeconds;
    results.success = results.steps.every(step => step.success);
    
    // Save results to file
    await fs.writeFile(
      path.join(__dirname, 'full-sync-results.json'),
      JSON.stringify(results, null, 2)
    );
    
    // Print summary
    console.log('\n==================================================');
    console.log('SYNC COMPLETE - SUMMARY');
    console.log('==================================================');
    console.log(`Total duration: ${totalDurationSeconds.toFixed(2)} seconds`);
    
    let totalJobs = 0;
    let totalInvoices = 0;
    
    results.steps.forEach(step => {
      if (step.name.includes('jobs')) {
        totalJobs += step.jobsCount || 0;
      }
      if (step.name === 'invoices') {
        totalInvoices = step.invoicesCount || 0;
      }
    });
    
    console.log(`Total jobs synced: ${totalJobs}`);
    console.log(`Total invoices synced: ${totalInvoices}`);
    console.log(`Overall status: ${results.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    return results;
  } catch (error) {
    console.error(`❌ Error during sync: ${error.message}`);
    
    // Save partial results
    const endTime = new Date();
    results.endTime = endTime.toISOString();
    results.totalDurationSeconds = (endTime - startTime) / 1000;
    results.success = false;
    results.error = error.message;
    
    await fs.writeFile(
      path.join(__dirname, 'full-sync-results.json'),
      JSON.stringify(results, null, 2)
    );
    
    return {
      success: false,
      error: error.message,
      duration: (endTime - startTime) / 1000
    };
  }
}

// Run if called directly
if (require.main === module) {
  runAllSync().catch(console.error);
}

module.exports = runAllSync; 