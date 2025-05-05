const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Airtable API client
const Airtable = require('airtable');

class FergusAirtableSync {
  constructor() {
    this.cookies = null;
    this.baseUrl = 'https://app.fergus.com';
    
    // Initialize Airtable
    this.airtable = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY
    }).base(process.env.AIRTABLE_BASE_ID);
  }

  /**
   * Get cookie header from stored cookies
   */
  getCookieHeader() {
    if (!this.cookies) return '';
    return this.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  }

  /**
   * Make an API request to Fergus
   */
  async apiRequest(endpoint, method = 'GET', data = null) {
    const url = `${this.baseUrl}/api/v2/${endpoint}`;
    const headers = {
      'Cookie': this.getCookieHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const config = { 
        method, 
        url, 
        headers,
        validateStatus: status => status < 500
      };
      
      if (data) {
        if (method.toUpperCase() === 'GET') {
          config.params = data;
        } else {
          config.data = data;
        }
      }
      
      const response = await axios(config);
      
      if (response.status >= 400) {
        throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(response.data)}`);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Error in API request to ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch all active jobs from Fergus
   */
  async fetchActiveJobs() {
    const data = {
      page: 1,
      per_page: 100,
      sort: { manual: "desc" }
    };
    
    const response = await this.apiRequest('status_board/all_active_jobs', 'POST', data);
    return response.data || [];
  }

  /**
   * Get job card details
   */
  async getJobCard(jobId) {
    const data = { job_id: jobId };
    const response = await this.apiRequest('job_card/load_from_job', 'POST', data);
    return response.value;
  }

  /**
   * Get quote financial details
   */
  async getQuoteFinancials(quoteId) {
    const data = { quote_id: quoteId };
    const response = await this.apiRequest('quotes/get_document_totals', 'POST', data);
    return response.value;
  }

  /**
   * Add a job to Airtable
   */
  async addJobToAirtable(job) {
    try {
      // Create record in Airtable
      const result = await this.airtable('Jobs').create({
        'Job ID': job.internal_id,
        'Customer Name': job.customer_full_name,
        'Description': job.description,
        'Job Type': job.job_type || 'Unknown',
        'Job Status': job.status,
        'Site Address': job.site_address,
        'Created Date': new Date().toISOString().split('T')[0], // Using today as created date
        'Has Active Works Order': false // Default value
      });
      
      return result;
    } catch (error) {
      console.error(`Error adding job ${job.internal_id} to Airtable:`, error.message);
      throw error;
    }
  }

  /**
   * Main sync function
   */
  async syncJobsToAirtable() {
    try {
      // Make sure we have authentication cookies
      if (!this.cookies) {
        throw new Error('No authentication cookies available. Please set cookies first.');
      }
      
      console.log('Fetching active jobs from Fergus...');
      const jobs = await this.fetchActiveJobs();
      console.log(`Found ${jobs.length} active jobs`);
      
      // Create output directory for samples
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      
      // Save sample job JSON
      if (jobs.length > 0) {
        const sampleFile = path.join(outputDir, 'job-sample.json');
        await fs.writeFile(sampleFile, JSON.stringify(jobs[0], null, 2));
        console.log(`Saved job sample structure to ${sampleFile}`);
      }
      
      // Sync each job to Airtable
      console.log('Syncing jobs to Airtable...');
      for (const job of jobs) {
        try {
          await this.addJobToAirtable(job);
          console.log(`Added job ${job.internal_id} to Airtable`);
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Error syncing job ${job.internal_id}:`, error.message);
        }
      }
      
      console.log('Job sync completed!');
    } catch (error) {
      console.error('Error syncing jobs to Airtable:', error.message);
      throw error;
    }
  }
}

// For testing and development
async function main() {
  try {
    // This is just for testing/development
    // In production, you'll need to implement proper cookie management
    console.log('This is a test script. In production, you need proper authentication.');
    console.log('Please implement cookie loading/saving as shown in the API documentation.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { FergusAirtableSync }; 