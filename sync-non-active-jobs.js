/**
 * Fergus Non-Active Jobs to Airtable Sync
 * ======================================
 * This script specifically focuses on fetching non-active jobs (jobs to invoice and others)
 * from Fergus and syncing them to Airtable
 * 
 * FEATURES:
 * - Retrieves jobs with various non-active statuses
 * - Specifically targets "Completed", "Invoiced", "Paid", and other closed statuses
 * - Syncs full job data to Airtable using the same table as the main sync
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Initialize Airtable
const Airtable = require('airtable');
const airtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

// Store your Fergus cookies here - copy from browser or curl request
// These will need to be updated periodically when they expire
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

/**
 * Processes a batch of jobs concurrently
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

/**
 * Fetch non-active jobs from Fergus API
 * This includes Completed, Invoiced, Paid, and other relevant statuses
 */
async function fetchNonActiveJobs(pageSize = 50, maxPages = 10) {
  try {
    console.log('Fetching non-active jobs...');
    
    // The jobs endpoint with search filter to find non-active jobs
    const url = 'https://app.fergus.com/api/v2/jobs';
    let allJobs = [];
    
    // Try different search terms to find non-active jobs
    const searchTerms = [
      "status:completed", 
      "status:invoiced", 
      "status:paid",
      "status:closed",
      "status:won",
      "status:done",
      "status:finished",
      "invoice",
      "completed",
      "archived"
    ];
    
    // Try each search term separately to maximize our chances
    for (const searchTerm of searchTerms) {
      console.log(`Searching for jobs with term: ${searchTerm}`);
      
      try {
        let currentPage = 1;
        
        while (currentPage <= maxPages) {
          console.log(`Fetching jobs with term "${searchTerm}" page ${currentPage}...`);
          
          const response = await axios.get(url, {
            params: {
              page: currentPage,
              per_page: pageSize,
              search: searchTerm
            },
            headers: getDefaultHeaders()
          });
          
          const jobs = response.data.jobs || [];
          console.log(`Fetched ${jobs.length} jobs with term "${searchTerm}" from page ${currentPage}`);
          
          if (jobs.length === 0) break;
          
          allJobs = [...allJobs, ...jobs];
          
          // Check for next page info
          if (!response.data.meta?.next_page) break;
          
          // Next page
          currentPage++;
          
          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error searching for "${searchTerm}":`, error.message);
        // Continue with the next search term
      }
    }
    
    // Deduplicate jobs based on ID
    const uniqueJobs = Array.from(
      new Map(allJobs.map(job => [job.id, job])).values()
    );
    
    console.log(`Fetched a total of ${allJobs.length} jobs (${uniqueJobs.length} unique)`);
    
    // Save a sample job for reference
    if (uniqueJobs.length > 0) {
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'non-active-job-sample.json'),
        JSON.stringify(uniqueJobs[0], null, 2)
      );
    }
    
    return uniqueJobs;
  } catch (error) {
    console.error('Error fetching non-active jobs:', error.message);
    return [];
  }
}

// Also try searching via the status_board API
async function fetchJobsFromStatusBoard() {
  try {
    console.log('Searching for non-active jobs via status_board API...');
    
    const url = 'https://app.fergus.com/api/v2/status_board/data';
    const response = await axios.post(url, {}, { 
      headers: getDefaultHeaders() 
    });
    
    const data = response.data;
    
    // Log all status names we find
    const allStatuses = new Set();
    
    // Function to recursively extract statuses from the response
    const extractStatuses = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.status_name) {
        allStatuses.add(obj.status_name);
      }
      
      if (Array.isArray(obj)) {
        obj.forEach(item => extractStatuses(item));
      } else {
        Object.values(obj).forEach(val => extractStatuses(val));
      }
    };
    
    extractStatuses(data);
    console.log(`Found status names: ${Array.from(allStatuses).join(', ')}`);
    
    // Extract job IDs
    const jobIds = new Set();
    
    // Function to recursively extract job IDs
    const extractJobIds = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (Array.isArray(obj.job_ids)) {
        obj.job_ids.forEach(id => jobIds.add(id));
      }
      
      if (Array.isArray(obj)) {
        obj.forEach(item => extractJobIds(item));
      } else {
        Object.values(obj).forEach(val => extractJobIds(val));
      }
    };
    
    extractJobIds(data);
    console.log(`Found ${jobIds.size} job IDs from status board`);
    
    // Get detailed information for each job
    const jobs = [];
    
    // Just process a sample of jobs for testing (first 20)
    const jobIdsToProcess = Array.from(jobIds).slice(0, 50);
    
    for (const jobId of jobIdsToProcess) {
      try {
        const jobData = await getDetailedJobData(jobId);
        if (jobData) {
          jobs.push(jobData);
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error getting detailed data for job ${jobId}:`, error.message);
      }
    }
    
    console.log(`Fetched detailed data for ${jobs.length} jobs from status board`);
    return jobs;
  } catch (error) {
    console.error('Error fetching from status_board:', error.message);
    return [];
  }
}

/**
 * Fetch detailed job information from the extended_json endpoint
 */
async function getDetailedJobData(jobId) {
  try {
    console.log(`Getting detailed data for job ${jobId}...`);
    
    const url = 'https://app.fergus.com/api/v2/jobs/extended_json';
    const response = await axios.get(url, {
      params: {
        job_id: jobId,
        internal_job_id: '',
        page: ''
      },
      headers: getDefaultHeaders()
    });
    
    if (response.data && response.data.result === 'success') {
      return response.data.value?.jobCard?.job || null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting detailed job data for ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Add or update a job in Airtable (upsert)
 */
async function addJobToAirtable(job, detailedJob = null) {
  try {
    // Use detailed job data if available, otherwise use the standard job data
    const mergedJob = {
      ...job,
      ...(detailedJob || {})
    };
    
    console.log(`Processing job ${mergedJob.internal_id || mergedJob.internal_job_id || mergedJob.id || ''}...`);
    
    // Handle the site address field which might be either an object or a string
    const siteAddress = typeof mergedJob.site_address === 'object' 
      ? formatAddressObject(mergedJob.site_address)
      : mergedJob.site_address || '';
    
    // Extract suburb and city from site address if available
    let siteSuburb = '', siteCity = '';
    
    if (typeof mergedJob.site_address === 'object') {
      siteSuburb = mergedJob.site_address.address_suburb || '';
      siteCity = mergedJob.site_address.address_city || '';
    } else if (typeof mergedJob.site_address === 'string') {
      // Try to extract suburb and city from address string
      const addressParts = mergedJob.site_address.split(',');
      if (addressParts.length >= 3) {
        // Assume format is like "Street, Suburb, City Postcode"
        siteSuburb = addressParts[1].trim();
        // City might have postcode attached, try to get just the city
        const cityPart = addressParts[2].trim();
        siteCity = cityPart.split(' ')[0] || cityPart;
      }
    }
    
    // Get customer billing address if available
    let billingAddress = '';
    
    if (mergedJob.customer) {
      if (mergedJob.customer.billing_contact && 
          (mergedJob.customer.billing_contact.address_1 || 
           mergedJob.customer.billing_contact.address_city)) {
        // Use billing contact address if it has data
        billingAddress = formatAddressObject(mergedJob.customer.billing_contact);
      } else if (mergedJob.customer.postal_address) {
        // Fall back to postal address
        billingAddress = formatAddressObject(mergedJob.customer.postal_address);
      } else if (mergedJob.customer.physical_address) {
        // Fall back to physical address
        billingAddress = formatAddressObject(mergedJob.customer.physical_address);
      }
    }
    
    // Get customer name from nested customer object if available
    const customerName = 
      mergedJob.customer_full_name || 
      mergedJob.customer_name || 
      (mergedJob.customer && mergedJob.customer.customer_full_name) || 
      '';
    
    // Extract site contact information
    let siteContactName = '';
    let siteContactEmail = '';
    let siteContactPhone = '';
    
    if (typeof mergedJob.site_address === 'object' && mergedJob.site_address) {
      // Extract contact name from site address
      const firstName = mergedJob.site_address.first_name || '';
      const lastName = mergedJob.site_address.last_name || '';
      siteContactName = [firstName, lastName].filter(Boolean).join(' ');
      
      // Extract contact items (email, phone) if available
      if (Array.isArray(mergedJob.site_address.contact_items)) {
        mergedJob.site_address.contact_items.forEach(item => {
          if (item.contact_type === 'email') {
            siteContactEmail = item.contact_val || '';
          } else if (item.contact_type === 'phone') {
            // If we already have a phone number, add this as a secondary one
            if (siteContactPhone) {
              siteContactPhone += `, ${item.contact_val}`;
            } else {
              siteContactPhone = item.contact_val || '';
            }
          }
        });
      }
    }
    
    // Create a standard record object from the job data
    const record = {
      'Job ID': mergedJob.internal_id || mergedJob.internal_job_id || '',
      'Customer Name': customerName,
      'Description': mergedJob.brief_description || '',
      'Job Type': mergedJob.job_type_name || 'Unknown',
      'Job Status': mergedJob.job_status || mergedJob.status || mergedJob.status_name || '',
      'Site Address': siteAddress,
      'Created Date': mergedJob.created_at ? new Date(mergedJob.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      'Suburb': siteSuburb,
      'City': siteCity,
      'Billing Address': billingAddress,
      'Site Contact Name': siteContactName,
      'Site Contact Email': siteContactEmail,
      'Site Contact Phone': siteContactPhone
    };
    
    // Add detailed description if available
    if (mergedJob.long_description) {
      record['Detailed Description'] = mergedJob.long_description;
    }
    
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
    console.error(`❌ Error upserting job ${job?.internal_id || job?.id} to Airtable:`, error.message);
    // Continue with other jobs instead of throwing
    return null;
  }
}

/**
 * Main function to sync non-active jobs from Fergus to Airtable
 */
async function syncNonActiveJobs() {
  try {
    console.log('Starting sync of non-active jobs from Fergus to Airtable...');
    
    // Step 1: Fetch non-active jobs
    const nonActiveJobs = await fetchNonActiveJobs();
    
    // Step 2: Also try to fetch jobs from status board
    const statusBoardJobs = await fetchJobsFromStatusBoard();
    
    // Step 3: Combine and deduplicate jobs
    const jobMap = new Map();
    
    [...nonActiveJobs, ...statusBoardJobs].forEach(job => {
      const id = job.id || job.job_id;
      if (id && !jobMap.has(id)) {
        jobMap.set(id, job);
      }
    });
    
    const combinedJobs = Array.from(jobMap.values());
    
    if (combinedJobs.length === 0) {
      console.log('No non-active jobs found. Nothing to sync.');
      return;
    }
    
    console.log(`Found ${combinedJobs.length} jobs to process.`);
    
    // Configure options for batch processing
    const options = {
      concurrency: 5,
      delayMs: 100,
      batchSize: 20,
      batchDelayMs: 1000
    };
    
    // Process only a subset of jobs for testing
    const jobsToProcess = combinedJobs.slice(0, 50);
    console.log(`Processing ${jobsToProcess.length} jobs in batches...`);
    
    // Step 4: Process jobs in batches with concurrent API calls
    let successCount = 0;
    
    await processBatch(jobsToProcess, async (job) => {
      try {
        // Get the job ID
        const jobId = job.id || job.job_id;
        
        // Get detailed job data when possible
        let detailedJob = null;
        if (!job.site_address || !job.customer) {
          detailedJob = await getDetailedJobData(jobId);
        }
        
        // Add the job to Airtable (with detailed data if available)
        const result = await addJobToAirtable(job, detailedJob);
        
        if (result) {
          successCount++;
        }
        
        return result;
      } catch (error) {
        console.error(`Error processing job ${job?.id || job?.internal_id}:`, error.message);
        return null;
      }
    }, options);
    
    console.log(`Non-active jobs sync completed. Successfully synced ${successCount} out of ${jobsToProcess.length} jobs.`);
  } catch (error) {
    console.error('Error in non-active jobs sync process:', error.message);
  }
}

// Run the non-active jobs sync if the script is executed directly
if (require.main === module) {
  syncNonActiveJobs().catch(console.error);
}

// Export functions
module.exports = {
  syncNonActiveJobs,
  fetchNonActiveJobs,
  getDetailedJobData,
  addJobToAirtable
}; 