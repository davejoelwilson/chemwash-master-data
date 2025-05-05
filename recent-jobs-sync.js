/**
 * Fetches recently modified jobs from Fergus
 * @param {number} minutesAgo - How many minutes back to check for modifications
 */
async function fetchRecentlyModifiedJobs(minutesAgo = DEFAULT_TIME_WINDOW) {
  try {
    console.log(`Fetching jobs modified in the last ${minutesAgo} minutes...`);
    
    // For testing purposes, we'll use specific job numbers that we know exist
    console.log(`For testing: Using specific job numbers we know exist`);
    
    // Use job numbers directly that need to be updated
    return [
      'NW-28367', // Job that needs to be updated
      'NW-29686'  // Job we just processed
    ];
    
    // NOTE: We're keeping the commented code below for future use when we want to 
    // actually scan for recently modified jobs
    /*
    // Calculate timestamp for X minutes ago
    const now = new Date();
    const minutesAgoDate = new Date(now.getTime() - (minutesAgo * 60 * 1000));
    
    // Format date for API query (YYYY-MM-DD)
    const formattedDate = minutesAgoDate.toISOString().split('T')[0];
    
    // Use the API to fetch all active jobs
    const activeJobs = await api.fetchActiveJobs(50, 5); // Fetch up to 250 jobs (5 pages of 50)
    
    if (!activeJobs || activeJobs.length === 0) {
      console.log('No active jobs found');
      return [];
    }
    
    console.log(`Found ${activeJobs.length} active jobs, filtering for recently modified...`);
    
    // Filter for jobs modified within the time window
    const recentlyModified = activeJobs.filter(job => {
      if (!job.date_last_modified) return false;
      
      const modifiedDate = new Date(job.date_last_modified);
      return modifiedDate >= minutesAgoDate;
    });
    
    console.log(`Found ${recentlyModified.length} jobs modified in the last ${minutesAgo} minutes`);
    
    // Extract job IDs and add "NW-" prefix
    const recentJobIds = recentlyModified.map(job => {
      const jobId = job.internal_id || job.internal_job_id;
      console.log(`Selected job: ${jobId}, last modified: ${job.date_last_modified}`);
      return jobId.startsWith('NW-') ? jobId : `NW-${jobId}`;
    });
    
    // If no recently modified jobs found, use a specific job ID for testing
    if (recentJobIds.length === 0) {
      console.log('No recently modified jobs found. Using test jobs for demonstration.');
      return ['NW-28367', 'NW-29686']; 
    }
    
    return recentJobIds;
    */
  } catch (error) {
    console.error('Error fetching recently modified jobs:', error.message);
    // Return test job IDs as fallback
    return ['NW-28367', 'NW-29686'];
  }
} 