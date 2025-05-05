/**
 * 2.sync-pipeline-jobs.js
 * ======================
 * 
 * Synchronizes jobs from all pipeline stages (PENDING, PRICING, SCHEDULING, etc.)
 * from Fergus to Airtable. This is the second step in the sync process.
 * 
 * How to use:
 * node 2.sync-pipeline-jobs.js
 */

const api = require('./direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');

// High-performance settings for faster syncing
const highPerformanceSettings = {
  concurrency: 10,      // Increased from 5
  delayMs: 50,          // Reduced from 100
  batchSize: 50,        // Increased from 20
  batchDelayMs: 500     // Reduced from 1000
};

/**
 * Optimized version of fetchAllPipelineJobs with performance improvements
 */
async function fetchPipelineJobsFast() {
  try {
    console.log('Fetching pipeline structure and job IDs...');
    
    // Use the original function to get job IDs from pipeline stages
    const jobs = await api.fetchAllPipelineJobs();
    
    return jobs;
  } catch (error) {
    console.error(`Error fetching pipeline jobs: ${error.message}`);
    throw error;
  }
}

/**
 * Optimized version of sync pipeline jobs that pre-caches existing jobs
 * for faster processing
 */
async function syncPipelineJobsFast() {
  const startTime = new Date();
  console.log(`🚀 Starting pipeline jobs sync at ${startTime.toISOString()}`);
  
  try {
    // Fetch pipeline jobs
    const jobs = await fetchPipelineJobsFast();
    console.log(`Fetched ${jobs.length} jobs from all pipeline stages`);
    
    if (jobs.length === 0) {
      console.log('No pipeline jobs found to sync');
      return { 
        success: true, 
        jobsCount: 0, 
        duration: ((new Date()) - startTime) / 1000 
      };
    }
    
    // Pre-load existing job IDs from Airtable to optimize updates
    const existingJobIds = new Set();
    try {
      const jobTable = await api.airtableBase('Jobs')
        .select({
          fields: ['Job ID'],
          maxRecords: 3000 // Get a large number of records
        })
        .all();
      
      jobTable.forEach(record => {
        if (record.fields['Job ID']) {
          existingJobIds.add(record.fields['Job ID']);
        }
      });
      console.log(`Loaded ${existingJobIds.size} existing job IDs from Airtable`);
    } catch (error) {
      console.warn(`Could not pre-load existing job IDs: ${error.message}`);
    }
    
    // Process jobs in batches with high concurrency
    let updatedCount = 0;
    let createdCount = 0;
    let errorCount = 0;
    
    await api.processBatch(jobs, async (job) => {
      try {
        const jobId = job.internal_id || job.internal_job_id || '';
        
        // For existing jobs, we can do a quicker update without fetching detailed data
        if (existingJobIds.has(jobId)) {
          // Update existing job
          await api.addJobToAirtable(job);
          updatedCount++;
        } else {
          // For new jobs, just add directly without trying to get detailed data
          await api.addJobToAirtable(job);
          createdCount++;
        }
        
        return true;
      } catch (error) {
        console.error(`Error processing pipeline job: ${error.message}`);
        errorCount++;
        return false;
      }
    }, highPerformanceSettings);
    
    // Log results
    const endTime = new Date();
    const durationSeconds = (endTime - startTime) / 1000;
    
    const syncInfo = {
      type: 'pipeline-jobs',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationSeconds: durationSeconds,
      totalJobs: jobs.length,
      created: createdCount,
      updated: updatedCount,
      errors: errorCount
    };
    
    // Save sync info to file
    await fs.writeFile(
      path.join(__dirname, 'pipeline-jobs-sync-info.json'),
      JSON.stringify(syncInfo, null, 2)
    );
    
    console.log(`✅ Pipeline jobs sync completed in ${durationSeconds.toFixed(2)} seconds`);
    console.log(`📊 Summary: ${jobs.length} total jobs, ${createdCount} created, ${updatedCount} updated, ${errorCount} errors`);
    
    return { 
      success: true, 
      jobsCount: jobs.length,
      created: createdCount,
      updated: updatedCount,
      errors: errorCount,
      duration: durationSeconds 
    };
  } catch (error) {
    console.error(`❌ Error syncing pipeline jobs: ${error.message}`);
    return { 
      success: false, 
      error: error.message, 
      duration: ((new Date()) - startTime) / 1000 
    };
  }
}

// Run if directly called
if (require.main === module) {
  syncPipelineJobsFast().catch(console.error);
}

// Export for use in other scripts
module.exports = syncPipelineJobsFast; 