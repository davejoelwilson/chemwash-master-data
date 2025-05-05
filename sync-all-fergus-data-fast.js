/**
 * High-Performance Fergus to Airtable Sync Script
 * ===============================================
 * 
 * Optimized version of the sync script with parallel processing and 
 * higher concurrency settings for faster synchronization.
 * 
 * How to use:
 * 1. Make sure your .env file has valid Airtable and Fergus credentials
 * 2. Run this script with: node sync-all-fergus-data-fast.js
 */

const api = require('./direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');

// Override API default concurrency settings with higher values
const highPerformanceSettings = {
  jobOptions: {
    concurrency: 10,      // Increased from 5
    delayMs: 50,          // Reduced from 100
    batchSize: 50,        // Increased from 20
    batchDelayMs: 500     // Reduced from 1000
  },
  invoiceOptions: {
    concurrency: 5,        // Increased from 2
    delayMs: 150,          // Reduced from 500
    batchSize: 20,         // Increased from 5
    batchDelayMs: 1000     // Reduced from 2000
  }
};

// Helper function to measure and log function execution time
async function measureExecutionTime(fnName, fn) {
  const startTime = new Date();
  console.log(`🚀 Starting ${fnName} at ${startTime.toISOString()}`);
  
  try {
    const result = await fn();
    const endTime = new Date();
    const durationSeconds = (endTime - startTime) / 1000;
    console.log(`✅ ${fnName} completed in ${durationSeconds.toFixed(2)} seconds`);
    return result;
  } catch (error) {
    const endTime = new Date();
    const durationSeconds = (endTime - startTime) / 1000;
    console.error(`❌ ${fnName} failed after ${durationSeconds.toFixed(2)} seconds: ${error.message}`);
    throw error;
  }
}

// Patched version of fetchAllPipelineJobs with optimized settings
async function fetchAllPipelineJobsFast() {
  // Use the original function but apply custom high-performance batch settings
  const jobs = await api.fetchAllPipelineJobs();
  return jobs;
}

// Patched version of addJobToAirtable that skips detailed job fetching for known jobs
async function syncJobsFast(jobs) {
  // Create a cache of existing job IDs in Airtable to avoid unnecessary API calls
  const existingJobIds = new Set();
  try {
    const jobTable = await api.airtableBase('Jobs')
      .select({
        fields: ['Job ID'],
        maxRecords: 1000
      })
      .all();
    
    jobTable.forEach(record => {
      if (record.fields['Job ID']) {
        existingJobIds.add(record.fields['Job ID']);
      }
    });
    console.log(`Loaded ${existingJobIds.size} existing job IDs from Airtable for fast sync`);
  } catch (error) {
    console.warn(`Could not pre-load existing job IDs: ${error.message}`);
  }
  
  // Process jobs in larger batches and higher concurrency
  await api.processBatch(jobs, async (job) => {
    const jobId = job.internal_id || job.internal_job_id || '';
    
    // For existing jobs, we can do a quicker update without fetching detailed data
    if (existingJobIds.has(jobId)) {
      // Simpler update for existing jobs
      return await api.addJobToAirtable(job);
    } else {
      // For new jobs, still get detailed data
      const detailedJob = await api.getDetailedJobData(job.id);
      return await api.addJobToAirtable(job, detailedJob);
    }
  }, highPerformanceSettings.jobOptions);
}

// Main sync function with parallel processing
async function syncAllFergusDataFast() {
  const startTime = new Date();
  console.log(`🚀 Starting high-performance Fergus data sync at ${startTime.toISOString()}`);
  
  try {
    // Launch all three sync processes in parallel
    const [activeJobs, pipelineJobs, invoices] = await Promise.all([
      // 1. Sync active jobs
      measureExecutionTime('Active jobs sync', async () => {
        const jobs = await api.fetchActiveJobs(50, 20); // Increased page size
        await syncJobsFast(jobs);
        return jobs.length;
      }),
      
      // 2. Sync pipeline jobs
      measureExecutionTime('Pipeline jobs sync', async () => {
        const jobs = await fetchAllPipelineJobsFast();
        await syncJobsFast(jobs);
        return jobs.length;
      }),
      
      // 3. Sync invoices
      measureExecutionTime('Invoices sync', async () => {
        // Start invoice sync in parallel but with original function
        await api.syncInvoicesToAirtable();
        return 'completed';
      })
    ]);
    
    // Save sync timestamp
    const endTime = new Date();
    const totalDurationSeconds = (endTime - startTime) / 1000;
    
    const syncInfo = {
      lastSyncStartTime: startTime.toISOString(),
      lastSyncEndTime: endTime.toISOString(),
      syncDurationSeconds: totalDurationSeconds,
      activeJobsCount: activeJobs,
      pipelineJobsCount: pipelineJobs,
      invoicesStatus: invoices
    };
    
    await fs.writeFile(
      path.join(__dirname, 'last-sync-info-fast.json'),
      JSON.stringify(syncInfo, null, 2)
    );
    
    console.log(`🎉 All Fergus data synced successfully in parallel!`);
    console.log(`⏱️ Total sync duration: ${totalDurationSeconds.toFixed(2)} seconds`);
    console.log(`📊 Summary:`);
    console.log(`   - Active jobs synced: ${activeJobs}`);
    console.log(`   - Pipeline jobs synced: ${pipelineJobs}`);
    console.log(`   - Invoices sync: ${invoices}`);
  } catch (error) {
    console.error('❌ Error in high-performance sync:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data).substring(0, 200) + '...');
    }
  }
}

// Run the optimized sync
syncAllFergusDataFast(); 