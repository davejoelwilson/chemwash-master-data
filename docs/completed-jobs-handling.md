# Handling Completed Jobs in Fergus-Airtable Sync

## The Problem

The main Fergus API endpoint `status_board/all_active_jobs` only returns jobs with active statuses such as:
- To Price
- Quote Sent
- Active
- Quote Rejected

It does *not* return jobs with completed statuses like:
- Completed
- Invoiced
- Paid

This creates a challenge when trying to sync all jobs to Airtable, as we would miss jobs that have been completed.

## The Solution

We've implemented a two-part approach to ensure we can sync all jobs, including completed ones:

### 1. Fetching All Job IDs

The `status_board/data` endpoint provides a comprehensive list of job IDs for *all* job statuses in the system, including:
- Active jobs
- Completed jobs
- Invoiced jobs
- Paid jobs
- Draft jobs
- Jobs on hold

We make a POST request to this endpoint and recursively extract all job IDs from the nested response. This gives us a complete list of all job IDs that exist in the system, regardless of status.

### 2. Fetching Individual Job Details

Once we have all job IDs, we can fetch the details for each job individually using the `job_card/load_from_job` endpoint:

```javascript
// Make sure to use job_id, not id parameter
const response = await axios.post('https://app.fergus.com/api/v2/job_card/load_from_job', {
  job_id: jobId  // This is the correct parameter name
}, {
  headers: getDefaultHeaders()
});
```

This endpoint returns detailed job information for any job ID, regardless of its status.

## Implementation Strategy

1. **Extract All Job IDs**
   - Use `extract-job-ids.js` to get a list of all job IDs from the `status_board/data` endpoint
   - Store these IDs for processing

2. **Fetch & Process Jobs in Batches**
   - Process job IDs in batches to avoid rate limits
   - For each ID, use the `fetchJobById` function to get detailed job data
   - Sync each job to Airtable

3. **Handling Rate Limits**
   - Add delays between API calls (300-500ms)
   - Process in smaller batches with delays between batches
   - Implement exponential backoff for retries on failures

## Monitoring & Maintenance

- The cookies used for authentication will expire periodically (typically every few weeks)
- When this happens, you'll need to:
  1. Log into Fergus in your browser
  2. Copy new cookies from a network request
  3. Update the `FERGUS_COOKIES` constant in the script

## Code Structure

- `extract-job-ids.js` - Extracts all job IDs from status_board/data
- `test-fetch-job-by-id.js` - Tests fetching a specific job by ID
- `direct-fergus-api.js` - Main integration code with improved functions for fetching all jobs

## Limitations

- Rate limiting: The Fergus API may rate-limit requests if too many are made too quickly
- Authentication: Cookie-based authentication requires periodic manual updates
- API changes: If Fergus changes their API, this approach may need to be updated 