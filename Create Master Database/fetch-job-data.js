/**
 * fetch-job-data.js
 * 
 * This script fetches data from Fergus for a specific job or list of jobs
 * and saves it to JSON files without updating Airtable.
 * 
 * Usage:
 * - Fetch single job: node fetch-job-data.js NW-21491
 * - Fetch multiple jobs: node fetch-job-data.js NW-21491,NW-21492,NW-21493
 */

const api = require('../direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function fetchJobData(jobIds) {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '..', 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log(`Will fetch data for ${jobIds.length} jobs`);
    let successCount = 0;
    let failCount = 0;
    
    // Process each job
    for (let i = 0; i < jobIds.length; i++) {
      const jobId = jobIds[i];
      console.log(`\n[${i+1}/${jobIds.length}] Processing job: ${jobId}`);
      
      try {
        // Remove the "NW-" prefix if present to get the numeric ID for Fergus
        const numericId = jobId.replace('NW-', '');
        
        // First try to get detailed job data - this method usually has the most information
        console.log(`Fetching detailed job data from Fergus for ${numericId}...`);
        let jobData = await api.getDetailedJobData(numericId);
        
        if (!jobData) {
          console.log(`No detailed data found, trying alternative lookup method...`);
          
          // Try using fetchJobWithInvoices as a fallback
          const jobWithInvoices = await api.fetchJobWithInvoices(numericId, { saveToFile: false });
          
          if (!jobWithInvoices || jobWithInvoices.result !== 'success') {
            console.log(`❌ Could not find data for job ${jobId} using any method`);
            failCount++;
            continue;
          }
          
          jobData = jobWithInvoices.value?.jobCard?.job;
          if (!jobData) {
            console.log(`❌ Response had success status but no job data for ${jobId}`);
            failCount++;
            continue;
          }
        }
        
        // Add original job ID to the data
        jobData.original_job_id = jobId;
        
        // Save the job data to a JSON file
        const filename = `job-data-${jobId}.json`;
        const filePath = path.join(outputDir, filename);
        await fs.writeFile(filePath, JSON.stringify(jobData, null, 2));
        console.log(`✅ Saved job data to: ${filePath}`);
        
        // Display contact info summary
        displayContactInfo(jobData);
        
        successCount++;
        
        // Add a delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`❌ Error fetching data for job ${jobId}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`\n=== FETCH SUMMARY ===`);
    console.log(`Successfully fetched data for ${successCount} of ${jobIds.length} jobs`);
    if (failCount > 0) {
      console.log(`Failed to fetch data for ${failCount} jobs`);
    }
    console.log(`Check the 'output' directory for the JSON files`);
    
  } catch (error) {
    console.error('Error in job data fetch process:', error.message);
  }
}

function displayContactInfo(jobData) {
  console.log('\n--- CONTACT INFO SUMMARY ---');
  
  // Site Contact
  console.log('Site Contact:');
  if (typeof jobData.site_address === 'object' && jobData.site_address) {
    const firstName = jobData.site_address.first_name || '';
    const lastName = jobData.site_address.last_name || '';
    console.log(`  Name: ${firstName} ${lastName}`.trim());
    
    if (Array.isArray(jobData.site_address.contact_items)) {
      jobData.site_address.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          console.log(`  Email: ${item.contact_val || 'None'}`);
        } else if (item.contact_type === 'phone') {
          console.log(`  Phone: ${item.contact_val || 'None'}`);
        }
      });
    } else {
      console.log('  No contact details available');
    }
  } else {
    console.log('  No site contact information available');
  }
  
  // Main Contact
  console.log('\nMain Contact:');
  if (jobData.main_contact) {
    const firstName = jobData.main_contact.first_name || '';
    const lastName = jobData.main_contact.last_name || '';
    console.log(`  Name: ${firstName} ${lastName}`.trim());
    
    if (Array.isArray(jobData.main_contact.contact_items)) {
      jobData.main_contact.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          console.log(`  Email: ${item.contact_val || 'None'}`);
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          console.log(`  Phone: ${item.contact_val || 'None'}`);
        }
      });
    } else {
      console.log('  No contact details available');
    }
  } else {
    console.log('  No main contact information available');
  }
  
  // Billing Contact
  console.log('\nBilling Contact:');
  if (jobData.billing_contact) {
    const firstName = jobData.billing_contact.first_name || '';
    const lastName = jobData.billing_contact.last_name || '';
    console.log(`  Name: ${firstName} ${lastName}`.trim());
    
    if (Array.isArray(jobData.billing_contact.contact_items)) {
      jobData.billing_contact.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          console.log(`  Email: ${item.contact_val || 'None'}`);
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          console.log(`  Phone: ${item.contact_val || 'None'}`);
        }
      });
    } else {
      console.log('  No contact details available');
    }
  } else {
    console.log('  No billing contact information available');
  }
}

// Main execution
const jobIdsArg = process.argv[2];

if (!jobIdsArg) {
  console.log('Please provide at least one job ID');
  console.log('Usage: node fetch-job-data.js NW-21491');
  console.log('       node fetch-job-data.js NW-21491,NW-21492,NW-21493');
  process.exit(1);
}

// Split by comma if multiple job IDs provided
const jobIds = jobIdsArg.split(',');

// Run the function
fetchJobData(jobIds)
  .then(() => console.log('Process completed'))
  .catch(err => console.error('Error in main process:', err)); 