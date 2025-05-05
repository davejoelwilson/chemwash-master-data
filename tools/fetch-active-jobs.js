const { FergusClient } = require('./api-client-example');
const fs = require('fs').promises;
const path = require('path');

async function fetchActiveJobs() {
  try {
    // Initialize Fergus client
    const client = new FergusClient();
    await client.initialize();
    
    console.log('Fetching all active jobs...');
    
    // Fetch active jobs using POST with proper parameters
    const data = {
      page: 1,
      per_page: 100,
      sort: { manual: "desc" }
    };
    
    const response = await client.apiRequest('status_board/all_active_jobs', 'POST', data);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save full response to a file
    const outputFile = path.join(outputDir, 'active-jobs-payload.json');
    await fs.writeFile(outputFile, JSON.stringify(response, null, 2));
    
    console.log(`Saved full payload to ${outputFile}`);
    
    // Extract job data
    const jobs = response.data || [];
    console.log(`Found ${jobs.length} active jobs`);
    
    // If there are jobs, save a sample job structure
    if (jobs.length > 0) {
      const sampleFile = path.join(outputDir, 'job-sample.json');
      await fs.writeFile(sampleFile, JSON.stringify(jobs[0], null, 2));
      console.log(`Saved job sample structure to ${sampleFile}`);
      
      // Log sample structure for Airtable mapping
      console.log('\nSample job structure for Airtable mapping:');
      console.log(JSON.stringify(jobs[0], null, 2));
    }
    
    return jobs;
  } catch (error) {
    console.error('Error fetching active jobs:', error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  fetchActiveJobs().catch(console.error);
}

module.exports = { fetchActiveJobs }; 