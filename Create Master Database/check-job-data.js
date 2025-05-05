/**
 * check-job-data.js
 * 
 * A simple script to fetch and display data for a specific job ID
 * Usage: node check-job-data.js NW-21491
 */

const api = require('./direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function fetchAndLogJobData(jobId) {
  try {
    // Remove the "NW-" prefix if present to get the numeric ID
    const numericId = jobId.replace('NW-', '');
    console.log(`Checking job data for ${jobId} (numeric ID: ${numericId})...`);
    
    // Try to get detailed job data
    console.log("Fetching detailed job data...");
    const detailedJob = await api.getDetailedJobData(numericId);
    
    if (!detailedJob) {
      console.log(`No detailed data found for job ${jobId}`);
      
      // Try standard job lookup as fallback
      console.log("Trying alternative job data lookup...");
      const jobWithInvoices = await api.fetchJobWithInvoices(numericId, { saveToFile: true });
      
      if (jobWithInvoices && jobWithInvoices.result === 'success') {
        const jobData = jobWithInvoices.value?.jobCard?.job;
        if (jobData) {
          console.log("Found job data via fetchJobWithInvoices method");
          await saveJobDataToFile(jobData, jobId);
          printJobContactInfo(jobData);
          return;
        }
      }
      
      console.log(`No job data found for ${jobId} using any method`);
      return;
    }
    
    console.log(`Successfully fetched data for job ${jobId}`);
    
    // Save the job data to a file for inspection
    await saveJobDataToFile(detailedJob, jobId);
    
    // Print the most relevant contact information
    printJobContactInfo(detailedJob);
    
  } catch (error) {
    console.error('Error fetching job data:', error.message);
  }
}

async function saveJobDataToFile(jobData, jobId) {
  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, 'output');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Save the job data to a file
  const filename = `job-data-${jobId}.json`;
  const filePath = path.join(outputDir, filename);
  
  await fs.writeFile(filePath, JSON.stringify(jobData, null, 2));
  console.log(`Job data saved to ${filePath}`);
}

function printJobContactInfo(job) {
  console.log("\n=== BASIC JOB INFORMATION ===");
  console.log(`Job ID: ${job.internal_id || job.internal_job_id || 'Unknown'}`);
  console.log(`Status: ${job.job_status || job.status_name || 'Unknown'}`);
  console.log(`Customer Name: ${job.customer_full_name || job.customer_name || 'Unknown'}`);
  console.log(`Job Type: ${job.job_type_name || 'Unknown'}`);
  console.log(`Description: ${job.brief_description || 'None'}`);
  
  // Format the site address
  let siteAddress = '';
  if (typeof job.site_address === 'object') {
    const parts = [
      job.site_address.address_1,
      job.site_address.address_2,
      job.site_address.address_suburb,
      job.site_address.address_city,
      job.site_address.address_region,
      job.site_address.address_postcode
    ].filter(Boolean);
    siteAddress = parts.join(', ');
  } else {
    siteAddress = job.site_address || 'Unknown';
  }
  console.log(`Site Address: ${siteAddress}`);
  
  // Print Site Contact Information
  console.log("\n=== SITE CONTACT INFORMATION ===");
  if (typeof job.site_address === 'object' && job.site_address) {
    const firstName = job.site_address.first_name || '';
    const lastName = job.site_address.last_name || '';
    console.log(`Name: ${firstName} ${lastName}`.trim());
    
    if (Array.isArray(job.site_address.contact_items)) {
      job.site_address.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          console.log(`Email: ${item.contact_val || 'None'}`);
        } else if (item.contact_type === 'phone') {
          console.log(`Phone: ${item.contact_val || 'None'}`);
        }
      });
    } else {
      console.log("No contact items found for site contact");
    }
  } else {
    console.log("No site contact information available");
  }
  
  // Print Main Contact Information
  console.log("\n=== MAIN CONTACT INFORMATION ===");
  if (job.main_contact) {
    const firstName = job.main_contact.first_name || '';
    const lastName = job.main_contact.last_name || '';
    console.log(`Name: ${firstName} ${lastName}`.trim());
    
    if (Array.isArray(job.main_contact.contact_items)) {
      job.main_contact.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          console.log(`Email: ${item.contact_val || 'None'}`);
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          console.log(`Phone: ${item.contact_val || 'None'}`);
        }
      });
    } else {
      console.log("No contact items found for main contact");
    }
  } else {
    console.log("No main contact information available");
  }
  
  // Print Billing Contact Information
  console.log("\n=== BILLING CONTACT INFORMATION ===");
  if (job.billing_contact) {
    const firstName = job.billing_contact.first_name || '';
    const lastName = job.billing_contact.last_name || '';
    console.log(`Name: ${firstName} ${lastName}`.trim());
    
    if (Array.isArray(job.billing_contact.contact_items)) {
      job.billing_contact.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          console.log(`Email: ${item.contact_val || 'None'}`);
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          console.log(`Phone: ${item.contact_val || 'None'}`);
        }
      });
    } else {
      console.log("No contact items found for billing contact");
    }
    
    // Print billing address
    if (job.billing_contact.address_1) {
      const parts = [
        job.billing_contact.address_1,
        job.billing_contact.address_2,
        job.billing_contact.address_suburb,
        job.billing_contact.address_city,
        job.billing_contact.address_region,
        job.billing_contact.address_postcode
      ].filter(Boolean);
      console.log(`Billing Address: ${parts.join(', ')}`);
    }
  } else {
    console.log("No billing contact information available");
  }
  
  // Invoice information if available
  if (job.invoices && job.invoices.length > 0) {
    console.log("\n=== INVOICE INFORMATION ===");
    job.invoices.forEach((invoice, index) => {
      console.log(`Invoice ${index + 1}:`);
      console.log(`  Number: ${invoice.invoice_number || 'Unknown'}`);
      console.log(`  Status: ${invoice.status || 'Unknown'}`);
      console.log(`  Total: ${invoice.total || 0}`);
      console.log(`  Date: ${invoice.invoice_date || 'Unknown'}`);
    });
  }
}

// Main execution - get job ID from command line argument
const jobId = process.argv[2] || 'NW-21491'; // Default to the requested job ID if none provided

// Run the function
fetchAndLogJobData(jobId)
  .then(() => console.log('Done!'))
  .catch(err => console.error('Error:', err)); 