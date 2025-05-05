# Fergus to Airtable Sync Solution

## Problem
The main Fergus API endpoint `status_board/all_active_jobs` only returns jobs with active statuses, not completed jobs. This creates a challenge when trying to sync all jobs to Airtable.

## Solution
We've implemented a two-part approach:

1. **Extract all job IDs from the status_board/data endpoint**
   - This endpoint returns a comprehensive list of job IDs for all statuses in the system
   - We recursively search the response for job_ids arrays and collect all job IDs

2. **Fetch detailed job information one by one**
   - For each job ID, we use the `job_card/load_from_job` endpoint
   - This endpoint returns detailed job data regardless of the job's status

3. **Batching and rate limiting**
   - We process jobs in batches to avoid rate limits
   - Add delays between API calls

## Implementation 

### 1. Extract Job IDs
```javascript
// In syncJobsToAirtable function
const extractJobIds = async () => {
  const response = await axios.post('https://app.fergus.com/api/v2/status_board/data', 
    {}, 
    { headers: getDefaultHeaders() }
  );
  
  // Helper function to recursively extract job IDs
  const extractIds = (obj, ids = new Set()) => {
    if (!obj || typeof obj !== 'object') return ids;
    
    if (Array.isArray(obj.job_ids)) {
      obj.job_ids.forEach(id => ids.add(id));
    }
    
    Object.values(obj).forEach(value => {
      if (value && typeof value === 'object') {
        extractIds(value, ids);
      }
    });
    
    return ids;
  };
  
  return Array.from(extractIds(response.data));
};

const allJobIds = await extractJobIds();
```

### 2. Fetch Job Details by ID
```javascript
async function fetchJobById(jobId) {
  // Use the job_card/load_from_job endpoint
  const response = await axios.post('https://app.fergus.com/api/v2/job_card/load_from_job', {
    job_id: jobId  // Make sure to use job_id not id
  }, {
    headers: getDefaultHeaders()
  });
  
  return response.data.value.job || null;
}
```

### 3. Process Jobs in Batches
```javascript
await processBatch(jobIds, async (jobId) => {
  try {
    console.log(`Fetching job details for job ID: ${jobId}`);
    const job = await fetchJobById(jobId);
    
    if (job) {
      // Sync the job to Airtable
      await addJobToAirtable(job);
      console.log(`Synced job ${job.internal_id || jobId} to Airtable`);
    }
    
    return job;
  } catch (error) {
    console.error(`Error processing job ID ${jobId}:`, error.message);
    return null;
  }
}, {
  concurrency: 2,    // Lower concurrency for job API calls
  delayMs: 500,      // More delay between calls
  batchSize: 10,     // Smaller batch size
  batchDelayMs: 2000 // More delay between batches
});
```

## Authentication
The solution uses cookie-based authentication. The cookies will need to be updated periodically (typically every few weeks) when they expire.

## Files

1. **direct-fergus-api.js** - Main API interface with functions:
   - `fetchJobById`: Fetches a specific job by ID
   - `syncJobsToAirtable`: Main sync function updated to use status_board/data

2. **extract-job-ids.js** - Script to extract job IDs from status_board/data endpoint

3. **test-fetch-job-by-id.js** - Test script to verify job fetching works

4. **docs/completed-jobs-handling.md** - Documentation for the approach

## Notes
- The cookies used for authentication may expire, so you'll need to manually update them periodically
- The solution is designed to handle rate limiting by using batching and delays
- The approach works with all job statuses, including completed, invoiced, and paid jobs 