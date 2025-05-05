const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

/**
 * Fergus to Airtable INCREMENTAL Sync Script
 * ==========================================
 * This script provides an efficient alternative to the full sync process in direct-fergus-api.js
 * by only syncing jobs and invoices that have changed since the last successful run.
 * 
 * BENEFITS:
 * - Dramatically reduced API calls (both to Fergus and Airtable)
 * - Much faster execution time (seconds vs minutes)
 * - Lower system resource usage
 * - Reduced chance of hitting API rate limits
 * - More suitable for frequent (daily) execution
 * 
 * HOW IT WORKS:
 * 1. Tracks the last successful sync time in last_sync.json
 * 2. Uses HTTP If-Modified-Since header to get only recently modified jobs
 * 3. Also checks for newly created jobs separately
 * 4. Only processes jobs that have changed or are new since last run
 * 5. Intelligently checks for invoices only on jobs with statuses likely to have them
 * 
 * USAGE:
 * - First run: Will use a default of 1 day ago as the start point
 * - Subsequent runs: Will use the timestamp from last_sync.json
 * 
 * SCHEDULING:
 * This script is designed to be run daily via:
 * - cron jobs on Linux/Mac: `0 2 * * * cd /path/to/script && node incremental-sync.js >> sync.log 2>&1`
 * - Task Scheduler on Windows
 * - Any other scheduling system
 * 
 * TECHNICAL IMPLEMENTATION:
 * The script uses two complementary methods to ensure complete data:
 * 1. If-Modified-Since HTTP header - Catches modified jobs
 * 2. created_at date filter - Catches newly created jobs
 * 
 * The results are combined, duplicates removed, and then processed efficiently
 * with batching and concurrency controls to maximize performance while
 * respecting API limits.
 */

// Initialize Airtable
const Airtable = require('airtable');
const airtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

// Get the main API functions from the original script - don't import addJobToAirtable
const { 
  // We no longer need to import this since we have our own implementation
  // addJobToAirtable 
} = require('./direct-fergus-api');

// Override the addJobToAirtable function since we're using a different format
async function addJobToAirtable(record) {
  try {
    console.log(`Processing job ${record['Job ID']}...`);
    
    // Check if the job already exists in Airtable
    const existingRecords = await airtableBase('Jobs')
      .select({
        filterByFormula: `{Job ID} = "${record['Job ID']}"`,
        maxRecords: 1
      })
      .firstPage();
    
    let result;
    
    if (existingRecords && existingRecords.length > 0) {
      // Job exists - update it with the latest data
      const existingRecord = existingRecords[0];
      const recordId = existingRecord.getId();
      const existingFields = existingRecord.fields;
      
      // Check for status changes
      const currentStatus = existingFields['Job Status'];
      const newStatus = record['Job Status'];
      
      if (currentStatus !== newStatus) {
        console.log(`🔄 Status change for job ${record['Job ID']}: ${currentStatus} → ${newStatus}`);
      }
      
      // Update the record in Airtable
      result = await airtableBase('Jobs').update(recordId, record);
      console.log(`✅ Updated job ${record['Job ID']} in Airtable`);
    } else {
      // Job doesn't exist - create a new record
      result = await airtableBase('Jobs').create(record);
      console.log(`➕ Added new job ${record['Job ID']} to Airtable`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error upserting job ${record['Job ID']} to Airtable:`, error.message);
    // Continue with other jobs instead of throwing
    return null;
  }
}

// Store your Fergus cookies here - use the ones from direct-fergus-api.js
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
 * File for storing the last successful sync time
 * In Docker, this will be symlinked to the persistent storage location
 */
const lastSyncFile = path.join(__dirname, 'last_sync.json');

// Directory for output files - make Docker-friendly
const outputDir = process.env.DOCKER_ENV 
  ? path.join(__dirname, 'data', 'output')
  : path.join(__dirname, 'output');

/**
 * Get the last successful sync time
 */
async function getLastSyncTime() {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    const data = await fs.readFile(lastSyncFile, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.lastSync;
  } catch (error) {
    console.log('No previous sync time found or error reading it:', error.message);
    // Return a VERY recent date for testing (1 day ago)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return oneDayAgo.toISOString();
  }
}

/**
 * Save the current time as the last successful sync time
 */
async function saveLastSyncTime() {
  try {
    await fs.writeFile(
      lastSyncFile,
      JSON.stringify({ lastSync: new Date().toISOString() })
    );
    console.log('Saved current time as last successful sync time');
  } catch (error) {
    console.error('Error saving last sync time:', error.message);
  }
}

/**
 * Fetch recently modified jobs using the If-Modified-Since header
 */
async function fetchRecentlyModifiedJobs(sinceDate, pageSize = 20, maxPages = 10) {
  const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
  let allJobs = [];
  let currentPage = 1;
  
  try {
    // Format the date for If-Modified-Since header
    const sinceDateObj = new Date(sinceDate);
    const formattedDate = sinceDateObj.toUTCString();
    
    console.log(`Fetching jobs modified since ${formattedDate}...`);
    
    // Add If-Modified-Since header
    const headers = {
      ...getDefaultHeaders(),
      'If-Modified-Since': formattedDate
    };
    
    // Fetch jobs using pagination
    while (currentPage <= maxPages) {
      console.log(`Fetching page ${currentPage}...`);
      
      const response = await axios.post(url, {
        page: currentPage,
        page_size: pageSize,
        filter: "",  // No additional filter needed since we use the header
        selected_group_ids: [],
        selected_employee_ids: []
      }, { headers });
      
      const jobs = response.data.value || [];
      console.log(`Fetched ${jobs.length} jobs from page ${currentPage}`);
      
      // Break if no more jobs
      if (jobs.length === 0) break;
      
      // Add jobs to collection
      allJobs = [...allJobs, ...jobs];
      
      // Check if there are more pages
      const totalPages = response.data.paging?.total_pages || 0;
      if (currentPage >= totalPages) break;
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Next page
      currentPage++;
    }
    
    console.log(`Fetched a total of ${allJobs.length} jobs modified since ${formattedDate}`);
    
    // Save a sample job for debugging
    if (allJobs.length > 0) {
      await fs.writeFile(
        path.join(outputDir, 'recent-jobs-sample.json'),
        JSON.stringify(allJobs.slice(0, 5), null, 2)
      );
    }
    
    return allJobs;
  } catch (error) {
    console.error('Error fetching recently modified jobs:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

/**
 * Fetch jobs created after a specific date using the created_at filter
 */
async function fetchJobsCreatedSince(sinceDate, pageSize = 20, maxPages = 10) {
  const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
  let allJobs = [];
  let currentPage = 1;
  
  try {
    // Format the date for the filter
    const formattedDate = new Date(sinceDate).toISOString().split('T')[0];
    
    console.log(`Fetching jobs created since ${formattedDate}...`);
    
    // Fetch jobs using pagination
    while (currentPage <= maxPages) {
      console.log(`Fetching page ${currentPage}...`);
      
      const response = await axios.post(url, {
        page: currentPage,
        page_size: pageSize,
        filter: JSON.stringify({
          created_at: {
            $gte: formattedDate
          }
        }),
        selected_group_ids: [],
        selected_employee_ids: []
      }, {
        headers: getDefaultHeaders()
      });
      
      const jobs = response.data.value || [];
      console.log(`Fetched ${jobs.length} jobs from page ${currentPage}`);
      
      // Break if no more jobs
      if (jobs.length === 0) break;
      
      // Add jobs to collection
      allJobs = [...allJobs, ...jobs];
      
      // Check if there are more pages
      const totalPages = response.data.paging?.total_pages || 0;
      if (currentPage >= totalPages) break;
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Next page
      currentPage++;
    }
    
    console.log(`Fetched a total of ${allJobs.length} jobs created since ${formattedDate}`);
    return allJobs;
  } catch (error) {
    console.error('Error fetching recently created jobs:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

/**
 * Processes a batch of jobs concurrently 
 * (same functionality from the main script)
 */
async function processBatch(jobs, processFn, options = {}) {
  const {
    concurrency = 5,
    delayMs = 200,
    batchSize = 10,
    batchDelayMs = 1000
  } = options;
  
  const results = [];
  
  // Process jobs in batches
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(jobs.length/batchSize)} (${batch.length} jobs)`);
    
    // Process each batch with specified concurrency
    const batchPromises = [];
    let processed = 0;
    
    for (let j = 0; j < batch.length; j += concurrency) {
      const concurrentJobs = batch.slice(j, j + concurrency);
      
      const concurrentPromises = concurrentJobs.map(job => {
        return new Promise(async (resolve) => {
          try {
            const result = await processFn(job);
            processed++;
            console.log(`Processed ${processed}/${batch.length} jobs in current batch`);
            resolve(result);
          } catch (error) {
            console.error(`Error processing job:`, error.message);
            resolve(null);
          }
        });
      });
      
      // Wait for this group of concurrent jobs to finish
      const groupResults = await Promise.all(concurrentPromises);
      batchPromises.push(...groupResults);
      
      // Small delay between concurrent groups to avoid rate limiting
      if (j + concurrency < batch.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    results.push(...batchPromises);
    
    // Delay between batches to prevent rate limiting
    if (i + batchSize < jobs.length) {
      console.log(`Batch complete. Waiting ${batchDelayMs}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }
  
  return results;
}

// Define our own version of fetchJobById right in this file
async function fetchJobById(jobId) {
  try {
    // Try the extended_json endpoint first
    console.log(`Fetching job details for ${jobId} using extended_json...`);
    const response = await axios.get('https://app.fergus.com/api/v2/jobs/extended_json', {
      params: {
        job_id: jobId,
        internal_job_id: '',
        page: ''
      },
      headers: getDefaultHeaders()
    });
    
    if (response.data && response.data.result === 'success') {
      const jobData = response.data.value?.jobCard?.job;
      if (jobData) {
        // Enhance jobData with contact information
        jobData.contacts = extractContactInfo(jobData);
        return jobData;
      }
    }
    
    // If extended_json fails, try the job_card endpoint
    console.log(`Trying job_card/load_from_job endpoint for ${jobId}...`);
    const jobCardResponse = await axios.post('https://app.fergus.com/api/v2/job_card/load_from_job', {
      job_id: jobId  // Make sure we're using job_id not id
    }, {
      headers: getDefaultHeaders()
    });
    
    if (jobCardResponse.data && jobCardResponse.data.value) {
      const job = jobCardResponse.data.value.job || null;
      if (job) {
        // Enhance job with contact information
        job.contacts = extractContactInfo(job);
      }
      return job;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching job ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Extract contact information from a job object
 */
function extractContactInfo(job) {
  const contacts = {};
  
  // Extract site contact information
  contacts.site = {
    name: '',
    email: '',
    phone: ''
  };
  
  if (typeof job.site_address === 'object' && job.site_address) {
    // Extract contact name from site address
    const firstName = job.site_address.first_name || '';
    const lastName = job.site_address.last_name || '';
    contacts.site.name = [firstName, lastName].filter(Boolean).join(' ');
    
    // Extract contact items (email, phone) if available
    if (Array.isArray(job.site_address.contact_items)) {
      job.site_address.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          contacts.site.email = item.contact_val || '';
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          // If we already have a phone number, add this as a secondary one
          if (contacts.site.phone) {
            contacts.site.phone += `, ${item.contact_val}`;
          } else {
            contacts.site.phone = item.contact_val || '';
          }
        }
      });
    }
    console.log(`Site contact: ${contacts.site.name} | Email: ${contacts.site.email} | Phone: ${contacts.site.phone}`);
  }
  
  // Extract billing contact information
  contacts.billing = {
    name: '',
    email: '',
    phone: ''
  };
  
  // Billing contact is usually under customer.billing_contact or directly in job.billing_contact
  const billingContact = (job.customer && job.customer.billing_contact) || job.billing_contact;
  
  if (billingContact) {
    // Extract contact name
    const firstName = billingContact.first_name || '';
    const lastName = billingContact.last_name || '';
    contacts.billing.name = [firstName, lastName].filter(Boolean).join(' ');
    
    // Extract contact items (email, phone) if available
    if (Array.isArray(billingContact.contact_items)) {
      billingContact.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          contacts.billing.email = item.contact_val || '';
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          // If we already have a phone number, add this as a secondary one
          if (contacts.billing.phone) {
            contacts.billing.phone += `, ${item.contact_val}`;
          } else {
            contacts.billing.phone = item.contact_val || '';
          }
        }
      });
    }
    console.log(`Billing contact: ${contacts.billing.name} | Email: ${contacts.billing.email} | Phone: ${contacts.billing.phone}`);
  }
  
  // Extract main contact information (if different from billing)
  contacts.main = {
    name: '',
    email: '',
    phone: ''
  };
  
  // Main contact could be directly in job or in customer.main_contact
  const mainContact = (job.customer && job.customer.main_contact) || job.main_contact;
  
  if (mainContact && mainContact.id !== (billingContact && billingContact.id)) {
    // Only process main contact if it's different from billing contact
    // Extract contact name
    const firstName = mainContact.first_name || '';
    const lastName = mainContact.last_name || '';
    contacts.main.name = [firstName, lastName].filter(Boolean).join(' ');
    
    // Extract contact items (email, phone) if available
    if (Array.isArray(mainContact.contact_items)) {
      mainContact.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          contacts.main.email = item.contact_val || '';
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          // If we already have a phone number, add this as a secondary one
          if (contacts.main.phone) {
            contacts.main.phone += `, ${item.contact_val}`;
          } else {
            contacts.main.phone = item.contact_val || '';
          }
        }
      });
    }
    console.log(`Main contact: ${contacts.main.name} | Email: ${contacts.main.email} | Phone: ${contacts.main.phone}`);
  }
  
  return contacts;
}

/**
 * Helper function to format address object into a string
 */
function formatAddressObject(addressObj) {
  if (!addressObj) return '';
  
  // Filter out any null or empty values
  const parts = [
    addressObj.address_1,
    addressObj.address_2,
    addressObj.address_suburb,
    addressObj.address_city,
    addressObj.address_region,
    addressObj.address_country,
    addressObj.address_postcode
  ].filter(Boolean);
  
  return parts.join(', ');
}

// Define our own version of syncJobInvoicesToAirtable right in this file
async function syncJobInvoicesToAirtable(jobId) {
  try {
    // First get the job data with invoices
    const jobData = await fetchJobWithInvoices(jobId);
    
    if (!jobData || !jobData.value || !jobData.value.invoices) {
      console.log(`No invoice data found for job ${jobId}`);
      return [];
    }
    
    const invoices = jobData.value.invoices;
    console.log(`Found ${invoices.length} invoices for job ${jobId}`);
    
    // Get job details to enrich the invoice data
    const jobDetails = {
      jobNumber: jobData.value.jobCard?.job?.internal_id || jobId,
      siteAddress: jobData.value.jobCard?.job?.site_address || '',
      customerName: jobData.value.jobCard?.job?.customer_name || ''
    };
    
    // Add job info to each invoice
    const enrichedInvoices = invoices.map(invoice => ({
      ...invoice,
      job_number: jobDetails.jobNumber,
      site_address: jobDetails.siteAddress,
      customer_name: jobDetails.customerName
    }));
    
    // Sync each invoice to Airtable
    for (const invoice of enrichedInvoices) {
      await addInvoiceToAirtable(invoice);
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay to avoid rate limits
    }
    
    return enrichedInvoices;
  } catch (error) {
    console.error(`Error syncing invoices for job ${jobId}:`, error.message);
    return [];
  }
}

// Helper function to fetch job with invoices
async function fetchJobWithInvoices(jobIdentifier, options = {}) {
  try {
    const url = 'https://app.fergus.com/api/v2/jobs/extended_json';
    console.log(`Fetching job ${jobIdentifier} with invoices...`);
    
    // Support both internal_job_id and job_id
    let params = {};
    
    if (options && options.useJobId) {
      // If we're using the job_id approach
      params = {
        internal_job_id: '', // Empty string as shown in Postman
        job_id: jobIdentifier,
        page: options && options.page ? options.page : ''
      };
    } else {
      // Default to using internal_job_id
      params = {
        internal_job_id: jobIdentifier,
        job_id: '',
        page: options && options.page ? options.page : ''
      };
    }
    
    console.log('Request params:', params);
    
    // Use GET with params instead of POST with form data
    const response = await axios.get(url, { 
      params,
      headers: getDefaultHeaders()
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching job ${jobIdentifier} with invoices:`, error.message);
    return null;
  }
}

// Helper function to add invoice to Airtable
async function addInvoiceToAirtable(invoice) {
  try {
    console.log(`Processing invoice ${invoice.public_id || invoice.id}...`);
    
    // Format the invoice data for Airtable
    const invoiceRecord = {
      'Invoice Number': invoice.public_id || invoice.invoice_number || invoice.id || '',
      'Invoice Reference': invoice.ref || invoice.reference || '',
      'Fergus Site Address': invoice.site_address || '',
      'Fergus Job Number': invoice.job_number || '',
      'Amount Paid': invoice.paid_amount || 0,
      'Invoice Status': invoice.status || '',
      'Customer': invoice.customer_name || '',
      'Invoice Date': invoice.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : '',
      'Due Date': invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : '',
      'Total': invoice.claim_amount_incl_tax || invoice.claim_amount || 0
    };
    
    // Check if the invoice already exists in Airtable
    const existingRecords = await airtableBase('Invoices')
      .select({
        filterByFormula: `{Invoice Number} = "${invoiceRecord['Invoice Number']}"`,
        maxRecords: 1
      })
      .firstPage();
    
    let result;
    
    if (existingRecords && existingRecords.length > 0) {
      // Invoice exists - update it with the latest data
      const existingRecord = existingRecords[0];
      const recordId = existingRecord.getId();
      
      // Update the record in Airtable
      result = await airtableBase('Invoices').update(recordId, invoiceRecord);
      console.log(`✅ Updated invoice ${invoiceRecord['Invoice Number']} in Airtable`);
    } else {
      // Invoice doesn't exist - create a new record
      result = await airtableBase('Invoices').create(invoiceRecord);
      console.log(`➕ Added new invoice ${invoiceRecord['Invoice Number']} to Airtable`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error upserting invoice ${invoice?.public_id || invoice?.id} to Airtable:`, error.message);
    return null;
  }
}

/**
 * Main function for incremental sync
 */
async function incrementalSync() {
  try {
    console.log('Starting incremental sync...');
    
    // Get the last sync time
    const lastSync = await getLastSyncTime();
    console.log(`Last successful sync was at: ${lastSync}`);
    
    // METHOD 1: Get jobs modified since last sync using If-Modified-Since header
    const modifiedJobs = await fetchRecentlyModifiedJobs(lastSync);
    
    // METHOD 2: Get jobs created since last sync using created_at filter
    const newJobs = await fetchJobsCreatedSince(lastSync);
    
    // Combine both lists and remove duplicates
    const allJobs = [...modifiedJobs];
    
    // Add new jobs that aren't already in the modified list
    for (const job of newJobs) {
      if (!allJobs.some(j => j.internal_id === job.internal_id)) {
        allJobs.push(job);
      }
    }
    
    console.log(`Found ${modifiedJobs.length} modified jobs and ${newJobs.length} new jobs`);
    console.log(`Combined total (removing duplicates): ${allJobs.length} jobs to sync`);
    
    if (allJobs.length === 0) {
      console.log('No jobs to sync. Exiting.');
      await saveLastSyncTime(); // Still update last sync time
      return;
    }
    
    // Sync jobs to Airtable
    console.log(`Syncing ${allJobs.length} jobs to Airtable...`);
    
    // Configure concurrency options
    const options = {
      concurrency: 5,
      delayMs: 100,
      batchSize: 20,
      batchDelayMs: 1000
    };
    
    // Process jobs
    await processBatch(allJobs, async (job) => {
      try {
        // Get detailed job information first
        const jobId = job.id || job.job_id;
        const internalJobId = job.internal_id || job.internal_job_id || '';
        
        if (!jobId && !internalJobId) return null;
        
        // Get detailed job information using our own fetchJobById function
        const detailedJob = await fetchJobById(jobId || internalJobId.replace('NW-', ''));
        
        // Extract contact information for adding to Airtable
        const record = {
          // Basic job information from the simple job object
          'Job ID': job.internal_id || job.internal_job_id || '',
          'Description': job.brief_description || '',
          'Job Type': job.job_type_name || 'Unknown',
          'Job Status': job.job_status || job.status_name || ''
        };
        
        // Add any detailed information if available
        if (detailedJob) {
          // Site contact
          if (detailedJob.site_address) {
            const siteName = [
              detailedJob.site_address.first_name || '',
              detailedJob.site_address.last_name || ''
            ].filter(Boolean).join(' ');
            
            let siteEmail = '';
            let sitePhone = '';
            
            if (Array.isArray(detailedJob.site_address.contact_items)) {
              detailedJob.site_address.contact_items.forEach(item => {
                if (item.contact_type === 'email') {
                  siteEmail = item.contact_val || '';
                } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
                  if (sitePhone) sitePhone += ', ';
                  sitePhone += item.contact_val || '';
                }
              });
            }
            
            record['Site Address'] = formatAddressObject(detailedJob.site_address);
            record['Site Contact Name'] = siteName;
            record['Site Contact Email'] = siteEmail;
            record['Site Contact Phone'] = sitePhone;
          }
          
          // Main contact
          if (detailedJob.main_contact) {
            const mainName = [
              detailedJob.main_contact.first_name || '',
              detailedJob.main_contact.last_name || ''
            ].filter(Boolean).join(' ');
            
            let mainEmail = '';
            let mainPhone = '';
            
            if (Array.isArray(detailedJob.main_contact.contact_items)) {
              detailedJob.main_contact.contact_items.forEach(item => {
                if (item.contact_type === 'email') {
                  mainEmail = item.contact_val || '';
                } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
                  if (mainPhone) mainPhone += ', ';
                  mainPhone += item.contact_val || '';
                }
              });
            }
            
            record['Main Contact Name'] = mainName;
            record['Main Contact Email'] = mainEmail;
            record['Main Contact Phone'] = mainPhone;
          }
          
          // Billing contact
          if (detailedJob.billing_contact) {
            const billingName = [
              detailedJob.billing_contact.first_name || '',
              detailedJob.billing_contact.last_name || ''
            ].filter(Boolean).join(' ');
            
            let billingEmail = '';
            let billingPhone = '';
            
            if (Array.isArray(detailedJob.billing_contact.contact_items)) {
              detailedJob.billing_contact.contact_items.forEach(item => {
                if (item.contact_type === 'email') {
                  billingEmail = item.contact_val || '';
                } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
                  if (billingPhone) billingPhone += ', ';
                  billingPhone += item.contact_val || '';
                }
              });
            }
            
            record['Billing Contact Name'] = billingName;
            record['Billing Contact Email'] = billingEmail;
            record['Billing Contact Phone'] = billingPhone;
            record['Billing Address'] = formatAddressObject(detailedJob.billing_contact);
          }
          
          // Customer
          record['Customer Name'] = detailedJob.customer_name || '';
          record['Customer ID'] = detailedJob.customer_id || '';
          
          // More details if available
          if (detailedJob.long_description) {
            record['Detailed Description'] = detailedJob.long_description;
          }
          
          // Created date
          record['Created Date'] = detailedJob.created_at ? 
            new Date(detailedJob.created_at).toISOString().split('T')[0] : 
            new Date().toISOString().split('T')[0];
        }
        
        // Use the addJobToAirtable function to update or create the record in Airtable
        return await addJobToAirtable(record);
      } catch (error) {
        console.error(`Error processing job ${job?.internal_id}:`, error.message);
        return null;
      }
    }, options);
    
    // Check for invoices but only for jobs with status that might have invoices
    const invoiceStatusJobs = allJobs.filter(job => {
      const status = job.job_status || '';
      return ['Completed', 'Invoiced', 'Won', 'Paid'].includes(status);
    });
    
    if (invoiceStatusJobs.length > 0) {
      console.log(`Checking ${invoiceStatusJobs.length} jobs for invoices...`);
      
      // Configure options for invoice processing
      const invoiceOptions = {
        concurrency: 2,
        delayMs: 500,
        batchSize: 5,
        batchDelayMs: 2000
      };
      
      let totalInvoicesFound = 0;
      
      // Process jobs for invoices
      await processBatch(invoiceStatusJobs, async (job) => {
        try {
          const jobId = job.id || job.job_id;
          const internalJobId = job.internal_id || job.internal_job_id || '';
          
          if (!jobId && !internalJobId) return null;
          
          console.log(`Checking job ${internalJobId || jobId} for invoices...`);
          
          // Get invoices for this job using our own syncJobInvoicesToAirtable function
          const invoices = await syncJobInvoicesToAirtable(jobId || internalJobId.replace('NW-', ''));
          
          // Increment the total if invoices were found
          if (invoices && invoices.length > 0) {
            totalInvoicesFound += invoices.length;
            console.log(`Found ${invoices.length} invoices for job ${internalJobId || jobId}`);
          }
          
          return invoices;
        } catch (error) {
          console.error(`Error processing job for invoices:`, error.message);
          return null;
        }
      }, invoiceOptions);
      
      console.log(`Found and synced ${totalInvoicesFound} invoices total`);
    }
    
    // Save the current time as the last successful sync
    await saveLastSyncTime();
    
    console.log('Incremental sync completed successfully!');
  } catch (error) {
    console.error('Error in incremental sync:', error.message);
  }
}

// Run the incremental sync if called directly
if (require.main === module) {
  incrementalSync().catch(console.error);
}

// Export functions for use in other scripts
module.exports = {
  incrementalSync,
  fetchRecentlyModifiedJobs,
  fetchJobsCreatedSince,
  getLastSyncTime,
  saveLastSyncTime
}; 