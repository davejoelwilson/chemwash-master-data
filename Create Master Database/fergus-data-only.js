/**
 * fergus-data-only.js
 * 
 * This script fetches data directly from Fergus without requiring Airtable credentials.
 * It only uses the Fergus API parts of direct-fergus-api.js.
 * 
 * Usage: node fergus-data-only.js NW-21255
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Store cookies directly (copied from direct-fergus-api.js)
const FERGUS_COOKIES = `_cfuvid=toxe.5PL2tIbfswmuikIcyOf4anaEczzmXQ0LnPfIME-1743668792085-0.0.1.1-604800000; pscd=partner.fergus.com; intercom-device-id-tbx03t1n=194b1a0c-037b-4e2c-afb0-e8afb2bd699a; rpjwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiIiLCJpYXQiOjE3NDM2Njg4MDksImV4cCI6MTgwNjc0MDgwOSwidXNkIjp7ImNvbXBhbnlfZ3VpZCI6IjcwZjA5ZmFmLWNhNGEtNDE2OS04NDU2LTI4ZjYxZDQzOWIwZSIsImVtcGxveWVlX2d1aWQiOiI2NDdmNzM1YS0zOTMxLTQ0ODUtYWRmMy1iMmMxMWM5ZjM1MTEifX0.EGKJ2zgIc54Z1jXttEyUNWMvmZZoRVLJTlqCuiZ77dph3NDFlMb4X3SIaSHdx_kVe3DVkLY26mum-ZAlocvlFTxTI-TDfKs2NfqEvuj-CWVS6FNJHHFbPyQWkTt72X4Ru1jCuzqFQO_CRXmKVoJ64LASrzYAFNR4E0iYYCKPK7T7k9COI9fdaxZN3koSefO3A5r9mBcaTDVVhTy6tQzgjVqv13FLDXe80gXcYTIUttGBMaFVw-7tQypr43QU03Sh8Dqx6bqpRi6mV20fQi87dSg1mX5u91b4mxiXIJTs07g32zvhwtWDprbijzE-Xb1e2_WMWj-flKEDSP9SZIr6xg; __stripe_mid=d62a3cde-2277-49f8-bd76-0334b5697b77932edc; csrf_rp_cook=aa324e372fec92e54640d7ad5f77d28b; rpsession=a%3A4%3A%7Bs%3A10%3A%22session_id%22%3Bs%3A32%3A%22e0f475bf008003e9232d938a3da7c548%22%3Bs%3A10%3A%22ip_address%22%3Bs%3A13%3A%22202.74.201.65%22%3Bs%3A10%3A%22user_agent%22%3Bs%3A117%3A%22Mozilla%2F5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F134.0.0.0%20Safari%2F537.36%22%3Bs%3A13%3A%22last_activity%22%3Bi%3A1744245283%3B%7D2c0121cf4fb3f53189cf83e6ecf18850; __stripe_sid=c2a6c47f-7b77-4a57-9fca-03a5f5fd5548fa0fa4; intercom-session-tbx03t1n=NTZTalp6YnFjYmpBeWxyUnluN0ZUSW5ETTQxQWdBS05Ld25sL3dEbXMrR2xBUW5nVVlLK2NRQUlIc3drZlpBcmZmVWtLbVI2dFg3a3RSZzZFNW1kTkFveGt5QnhpVXY1WnRWYjVYWUg4QXc9LS16Q1Eybm56UWV5WFd1OTJjanZ5YnpRPT0=--d3fb4859fc7a087676e3f1890ce0b3f6b38033ab`;

/**
 * Default headers for Fergus API requests
 */
const getDefaultHeaders = () => ({
  'Cookie': FERGUS_COOKIES,
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Accept-Language': 'en-GB,en;q=0.7',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Origin': 'https://app.fergus.com',
  'Referer': 'https://app.fergus.com/dashboard',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-Device-Type': 'desktop',
  'X-Screen-Height': '1050',
  'X-Screen-Width': '1680'
});

/**
 * Get detailed job information using the extended_json endpoint
 */
async function getDetailedJobData(jobId) {
  try {
    console.log(`Getting detailed data for job ${jobId}...`);
    
    // Try to get data using the job_id first (seems to be more reliable)
    const jobData = await fetchJobWithInvoices(jobId, { useJobId: true, saveToFile: true });
    
    if (jobData && jobData.result === 'success') {
      const detailedJob = jobData.value?.jobCard?.job || null;
      
      // Add any additional data from the response that might be useful
      if (detailedJob) {
        // Make sure site_address is included
        if (!detailedJob.site_address && jobData.value?.siteContact) {
          detailedJob.site_address = jobData.value.siteContact;
        }
        
        // Make sure invoices are included
        if (!detailedJob.invoices && jobData.value?.invoices) {
          detailedJob.invoices = jobData.value.invoices;
        }
        
        // Include description
        if (!detailedJob.long_description && jobData.value?.jobCard?.job?.long_description) {
          detailedJob.long_description = jobData.value.jobCard.job.long_description;
        }
      }
      
      return detailedJob;
    }
    
    // If that fails, try using internal_job_id
    const altJobData = await fetchJobWithInvoices(jobId, { saveToFile: true });
    
    if (altJobData && altJobData.result === 'success') {
      return altJobData.value?.jobCard?.job || null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting detailed job data for ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Fetch invoice data using the jobs/extended_json endpoint
 */
async function fetchJobWithInvoices(jobIdentifier, options = {}) {
  try {
    const url = 'https://app.fergus.com/api/v2/jobs/extended_json';
    console.log(`Fetching job ${jobIdentifier} with invoices...`);
    
    // Support both internal_job_id and job_id
    let params = {};
    
    if (options.useJobId) {
      // If we're using the job_id approach
      params = {
        internal_job_id: '', // Empty string as shown in Postman
        job_id: jobIdentifier,
        page: options.page || ''
      };
    } else {
      // Default to using internal_job_id
      params = {
        internal_job_id: jobIdentifier,
        job_id: '',
        page: options.page || ''
      };
    }
    
    console.log('Request params:', params);
    
    // Use GET with params instead of POST with form data
    const response = await axios.get(url, { 
      params,
      headers: getDefaultHeaders()
    });
    
    // Check if we need to save the data to file for examination
    if (options.saveToFile) {
      try {
        const outputDir = path.join(__dirname, '..', 'output');
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(
          path.join(outputDir, `job-with-invoices-${jobIdentifier}.json`), 
          JSON.stringify(response.data, null, 2)
        );
        console.log(`Saved job with invoices to output/job-with-invoices-${jobIdentifier}.json`);
      } catch (saveError) {
        console.error(`Error saving job data to file: ${saveError.message}`);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching job ${jobIdentifier} with invoices:`, error.message);
    return null;
  }
}

async function fetchJobData(jobId) {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '..', 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log(`Processing job: ${jobId}`);
    
    // Remove the "NW-" prefix if present to get the numeric ID for Fergus
    const numericId = jobId.replace('NW-', '');
    
    // First try to get detailed job data
    console.log(`Fetching detailed job data from Fergus for ${numericId}...`);
    let jobData = await getDetailedJobData(numericId);
    
    if (!jobData) {
      console.log(`No detailed data found, trying alternative lookup method...`);
      
      // Try direct fetch with extended_json
      const jobWithInvoices = await fetchJobWithInvoices(numericId, { saveToFile: true });
      
      if (!jobWithInvoices || jobWithInvoices.result !== 'success') {
        console.log(`❌ Could not find data for job ${jobId} using any method`);
        return;
      }
      
      jobData = jobWithInvoices.value?.jobCard?.job;
      if (!jobData) {
        console.log(`❌ Response had success status but no job data for ${jobId}`);
        return;
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
    
  } catch (error) {
    console.error('Error in job data fetch process:', error);
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

  // Customer Data
  console.log('\nCustomer Information:');
  if (jobData.customer) {
    console.log(`  Name: ${jobData.customer.customer_full_name || 'Unknown'}`);
    
    if (jobData.customer.billing_contact) {
      console.log('  Billing Address:');
      const billingContact = jobData.customer.billing_contact;
      console.log(`    ${billingContact.address_1 || ''} ${billingContact.address_2 || ''}`);
      console.log(`    ${billingContact.address_suburb || ''} ${billingContact.address_city || ''} ${billingContact.address_postcode || ''}`);
    }
    
    if (jobData.customer.postal_address) {
      console.log('  Postal Address:');
      const postalAddress = jobData.customer.postal_address;
      console.log(`    ${postalAddress.address_1 || ''} ${postalAddress.address_2 || ''}`);
      console.log(`    ${postalAddress.address_suburb || ''} ${postalAddress.address_city || ''} ${postalAddress.address_postcode || ''}`);
    }
  } else {
    console.log('  No customer information available');
  }
  
  // Invoice Info
  if (jobData.invoices && jobData.invoices.length > 0) {
    console.log('\nInvoices:');
    jobData.invoices.forEach((invoice, index) => {
      console.log(`  Invoice ${index + 1}:`);
      console.log(`    Number: ${invoice.invoice_number || 'Unknown'}`);
      console.log(`    Status: ${invoice.status || 'Unknown'}`);
      console.log(`    Total: ${invoice.total || 0}`);
      console.log(`    Date: ${invoice.invoice_date || 'Unknown'}`);
    });
  }
}

// Main execution
const jobId = process.argv[2];

if (!jobId) {
  console.log('Please provide a job ID');
  console.log('Usage: node fergus-data-only.js NW-21255');
  process.exit(1);
}

// Run the function
fetchJobData(jobId)
  .then(() => console.log('Process completed'))
  .catch(err => console.error('Error in main process:', err)); 