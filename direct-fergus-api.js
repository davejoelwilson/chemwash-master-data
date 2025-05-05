const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Initialize Airtable
const Airtable = require('airtable');
const airtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

/**
 * Fergus to Airtable Sync Script
 * ==============================
 * This script fetches jobs from Fergus and syncs them to Airtable without using
 * browser automation. Instead, it uses direct API calls with cookie-based authentication.
 * 
 * IMPORTANT NOTE:
 * For daily incremental syncing, consider using the more efficient incremental-sync.js script
 * which only processes jobs that have been changed or created since the last sync.
 * This current script performs a FULL sync of ALL jobs and is more resource intensive.
 * 
 * FEATURES:
 * - Upserts jobs to Airtable (creates new or updates existing)
 * - Detects and logs status changes (e.g., "Quote Sent" to "Won")
 * - Handles pagination to fetch large numbers of jobs
 * - Avoids duplicate creation by checking existing records
 * - Option to track job status change history
 * 
 * BENEFITS OF THIS APPROACH:
 * - Much faster and more efficient than browser automation
 * - No browser window needed to run the script
 * - Significantly reduces resource usage
 * - Can run silently in the background or on a server
 * - Cookies typically last for weeks before needing to be refreshed
 * 
 * HOW IT WORKS:
 * 1. Uses pre-obtained authentication cookies to access the Fergus API directly
 * 2. Fetches job data through pagination to get many records
 * 3. Maps the data to match the Airtable schema
 * 4. Syncs the jobs to Airtable, updating existing records as needed
 * 5. Tracks and logs status changes for further analysis
 * 
 * AIRTABLE SETUP:
 * The script currently works with an Airtable base that has:
 * 1. A "Jobs" table with the following fields:
 *    - Job ID (text)
 *    - Customer Name (text)
 *    - Description (text)
 *    - Job Type (text)
 *    - Job Status (text)
 *    - Site Address (text)
 *    - Created Date (date)
 * 
 * 2. Optional: Create a "Job Changes" table to track status history:
 *    - Job ID (text)
 *    - Previous Status (text)
 *    - New Status (text)
 *    - Changed At (datetime)
 *    Then uncomment the relevant code in the logJobStatusChange function
 * 
 * AUTHENTICATION COOKIE MANAGEMENT:
 * The cookies need to be updated when they expire (typically every few weeks).
 * To update the cookies:
 * 
 * 1. Log into Fergus in your browser (Chrome or Firefox recommended)
 * 2. Open Developer Tools:
 *    - Chrome: Press F12 or right-click > Inspect
 *    - Firefox: Press F12 or right-click > Inspect Element
 * 
 * 3. Go to the Network tab in Developer Tools
 * 
 * 4. Refresh the page or perform any action in Fergus
 * 
 * 5. Find a request to app.fergus.com:
 *    - Look for requests to status_board/all_active_jobs or any other API endpoint
 *    - Click on the request to see its details
 * 
 * 6. In Chrome:
 *    - Right-click on the request > Copy > Copy as cURL
 *    - Look for the '-b' or '--cookie' parameter in the cURL command
 *    - The cookie value is the long string after this parameter
 * 
 * 7. In Firefox:
 *    - Go to the Headers tab of the request
 *    - Find the 'Cookie' header under Request Headers
 *    - Copy the entire value of the Cookie header
 * 
 * 8. Update the FERGUS_COOKIES constant below with the new cookie value
 * 
 * 9. Test the script to ensure the cookies are working
 * 
 * SCHEDULING:
 * You can schedule this script to run periodically using:
 * - cron jobs on Linux/Mac
 * - Task Scheduler on Windows
 * - Any other scheduling tool or service
 * 
 * TROUBLESHOOTING:
 * - If you get a 401 Unauthorized error, your cookies have expired and need to be updated
 * - If you get a 429 Too Many Requests error, you're being rate limited - add more delay between requests
 * - If Airtable fields aren't being populated correctly, check the field mapping in addJobToAirtable()
 */

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
 * Fetch jobs from Fergus API with pagination
 */
async function fetchActiveJobs(pageSize = 20, maxPages = 50) {
  const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
  let allJobs = [];
  let currentPage = 1;
  
  try {
    // Fetch jobs using pagination
    while (currentPage <= maxPages) {
      console.log(`Fetching page ${currentPage}...`);
      
      const response = await axios.post(url, {
        page: currentPage,
        page_size: pageSize,
        filter: "",
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
    
    console.log(`Fetched a total of ${allJobs.length} jobs from Fergus API`);
    
    if (allJobs.length > 0) {
      console.log('First job sample:', JSON.stringify(allJobs[0], null, 2).substring(0, 300) + '...');
    }
    
    return allJobs;
  } catch (error) {
    console.error('Error fetching jobs from Fergus:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    throw error;
  }
}

/**
 * Get detailed job information using the extended_json endpoint
 * This will be used after we have the initial list of jobs to get more detailed data
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
 * Improved function to add or update a job in Airtable (upsert) with more detailed data
 */
async function addJobToAirtable(job, detailedJob = null) {
  try {
    // Use detailed job data if available, otherwise use the standard job data
    const mergedJob = {
      ...job,
      ...(detailedJob || {})
    };
    
    console.log(`Processing job ${mergedJob.internal_id || mergedJob.internal_job_id || ''}...`);
    
    // Handle the site address field which might be either an object or a string
    const siteAddress = typeof mergedJob.site_address === 'object' 
      ? formatAddressObject(mergedJob.site_address)
      : mergedJob.site_address || '';
    
    console.log(`Site address type: ${typeof mergedJob.site_address}`);
    console.log(`Formatted site address: ${siteAddress}`);
    
    // Extract suburb and city from site address if available
    let siteSuburb = '', siteCity = '';
    
    if (typeof mergedJob.site_address === 'object') {
      siteSuburb = mergedJob.site_address.address_suburb || '';
      siteCity = mergedJob.site_address.address_city || '';
      console.log(`Extracted from object - Suburb: "${siteSuburb}", City: "${siteCity}"`);
    } else if (typeof mergedJob.site_address === 'string') {
      // Try to extract suburb and city from address string
      const addressParts = mergedJob.site_address.split(',');
      if (addressParts.length >= 3) {
        // Assume format is like "Street, Suburb, City Postcode"
        siteSuburb = addressParts[1].trim();
        // City might have postcode attached, try to get just the city
        const cityPart = addressParts[2].trim();
        siteCity = cityPart.split(' ')[0] || cityPart;
        console.log(`Extracted from string - Suburb: "${siteSuburb}", City: "${siteCity}"`);
      } else {
        console.log(`Could not extract suburb and city from string: "${mergedJob.site_address}"`);
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
        console.log(`Using billing contact address: ${billingAddress}`);
      } else if (mergedJob.customer.postal_address) {
        // Fall back to postal address
        billingAddress = formatAddressObject(mergedJob.customer.postal_address);
        console.log(`Using postal address: ${billingAddress}`);
      } else if (mergedJob.customer.physical_address) {
        // Fall back to physical address
        billingAddress = formatAddressObject(mergedJob.customer.physical_address);
        console.log(`Using physical address: ${billingAddress}`);
      } else {
        console.log('No customer address found');
      }
    } else {
      console.log('No customer object found');
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
      console.log(`Site contact: ${siteContactName} | Email: ${siteContactEmail} | Phone: ${siteContactPhone}`);
    }
    
    // Create a standard record object from the job data
    // Start with the required fields that we know exist in Airtable
    const record = {
      'Job ID': mergedJob.internal_id || mergedJob.internal_job_id || '',
      'Customer Name': customerName,
      'Description': mergedJob.brief_description || '',
      'Job Type': mergedJob.job_type_name || 'Unknown',
      'Job Status': mergedJob.job_status || mergedJob.status_name || '',
      'Site Address': siteAddress,
      'Created Date': mergedJob.created_at ? new Date(mergedJob.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    };

    // Now add the new fields - they already exist in Airtable but might not have data
    // Since we know these fields exist in the table, we don't need to check
    record['Suburb'] = siteSuburb;
    record['City'] = siteCity;
    record['Billing Address'] = billingAddress;
    
    // Add site contact fields
    record['Site Contact Name'] = siteContactName;
    record['Site Contact Email'] = siteContactEmail;
    record['Site Contact Phone'] = siteContactPhone;
    
    // Extract main contact information if available
    let mainContactName = '';
    let mainContactEmail = '';
    let mainContactPhone = '';
    
    // Main contact could be in merged job
    if (mergedJob.main_contact) {
      const mainContact = mergedJob.main_contact;
      
      // Extract contact name
      const firstName = mainContact.first_name || '';
      const lastName = mainContact.last_name || '';
      mainContactName = [firstName, lastName].filter(Boolean).join(' ');
      
      // Extract contact items (email, phone) if available
      if (Array.isArray(mainContact.contact_items)) {
        mainContact.contact_items.forEach(item => {
          if (item.contact_type === 'email') {
            mainContactEmail = item.contact_val || '';
          } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
            // If we already have a phone number, add this as a secondary one
            if (mainContactPhone) {
              mainContactPhone += `, ${item.contact_val}`;
            } else {
              mainContactPhone = item.contact_val || '';
            }
          }
        });
      }
      console.log(`Main contact: ${mainContactName} | Email: ${mainContactEmail} | Phone: ${mainContactPhone}`);
    }
    
    // Add main contact fields
    record['Main Contact Name'] = mainContactName;
    record['Main Contact Email'] = mainContactEmail;
    record['Main Contact Phone'] = mainContactPhone;
    
    // Extract billing contact information if available
    let billingContactName = '';
    let billingContactEmail = '';
    let billingContactPhone = '';
    
    // Billing contact could be in merged job
    if (mergedJob.billing_contact) {
      const billingContact = mergedJob.billing_contact;
      
      // Extract contact name
      const firstName = billingContact.first_name || '';
      const lastName = billingContact.last_name || '';
      billingContactName = [firstName, lastName].filter(Boolean).join(' ');
      
      // Extract contact items (email, phone) if available
      if (Array.isArray(billingContact.contact_items)) {
        billingContact.contact_items.forEach(item => {
          if (item.contact_type === 'email') {
            billingContactEmail = item.contact_val || '';
          } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
            // If we already have a phone number, add this as a secondary one
            if (billingContactPhone) {
              billingContactPhone += `, ${item.contact_val}`;
            } else {
              billingContactPhone = item.contact_val || '';
            }
          }
        });
      }
      console.log(`Billing contact: ${billingContactName} | Email: ${billingContactEmail} | Phone: ${billingContactPhone}`);
    }
    
    // Add billing contact fields
    record['Billing Contact Name'] = billingContactName;
    record['Billing Contact Email'] = billingContactEmail;
    record['Billing Contact Phone'] = billingContactPhone;
    
    // Add detailed description if available
    if (mergedJob.long_description) {
      record['Detailed Description'] = mergedJob.long_description;
    }
    
    console.log('Final record to save:', JSON.stringify({
      'Job ID': record['Job ID'],
      'Suburb': record['Suburb'],
      'City': record['City'],
      'Billing Address': record['Billing Address'],
      'Site Contact Name': record['Site Contact Name'],
      'Site Contact Email': record['Site Contact Email'],
      'Site Contact Phone': record['Site Contact Phone']
    }));

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
        
        // Log this status change to a separate Airtable table if you want to track history
        await logJobStatusChange(record['Job ID'], currentStatus, newStatus);
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
 * @param {Array} jobs Array of jobs to process
 * @param {Function} processFn Function to process each job
 * @param {Object} options Options including concurrency level and delay
 * @returns {Promise<Array>} Results from processing
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
 * Fetch completed jobs from Fergus API with pagination
 * Includes jobs with statuses like "Completed", "Invoiced", "Paid"
 */
async function fetchCompletedJobs(pageSize = 20, maxPages = 10) {
  // Use the active jobs endpoint instead and filter for completed statuses
  const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
  let allJobs = [];
  let currentPage = 1;
  
  try {
    // Fetch jobs using pagination
    while (currentPage <= maxPages) {
      console.log(`Fetching completed jobs page ${currentPage}...`);
      
      const response = await axios.post(url, {
        page: currentPage,
        page_size: pageSize,
        filter: "",
        selected_group_ids: [],
        selected_employee_ids: []
      }, {
        headers: getDefaultHeaders()
      });
      
      const jobs = response.data.value || [];
      
      // Filter for completed statuses manually
      const completedJobs = jobs.filter(job => {
        const status = job.job_status || job.status_name || '';
        return ['completed', 'invoiced', 'paid'].some(s => 
          status.toLowerCase().includes(s)
        );
      });
      
      console.log(`Fetched ${completedJobs.length} completed jobs from page ${currentPage}`);
      
      // Break if no more jobs
      if (jobs.length === 0) break;
      
      // Add completed jobs to collection
      allJobs = [...allJobs, ...completedJobs];
      
      // Check if there are more pages
      const totalPages = response.data.paging?.total_pages || 0;
      if (currentPage >= totalPages) break;
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Next page
      currentPage++;
    }
    
    console.log(`Fetched a total of ${allJobs.length} completed jobs from Fergus API`);
    
    if (allJobs.length > 0) {
      console.log('First completed job sample:', JSON.stringify(allJobs[0], null, 2).substring(0, 300) + '...');
    }
    
    return allJobs;
  } catch (error) {
    console.error('Error fetching completed jobs from Fergus:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', typeof error.response.data === 'object' ? 
        JSON.stringify(error.response.data).substring(0, 500) : 
        'Non-JSON response (possibly HTML)');
    }
    
    // Return empty array instead of attempting alternative methods that don't work
    console.log('Returning empty array for completed jobs due to error');
    return [];
  }
}

/**
 * Fetch a specific job by ID directly
 * Used to get completed jobs or other jobs not returned by the active jobs endpoint
 */
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
      return jobCardResponse.data.value.job || null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching job ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Improved main function to sync jobs from Fergus to Airtable with concurrent processing
 */
async function syncJobsToAirtable() {
  try {
    // First, get all job IDs from the status_board/data endpoint - this includes ALL jobs
    console.log('Fetching all job IDs from status_board/data...');
    const extractJobIds = async () => {
      try {
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
      } catch (error) {
        console.error('Error extracting job IDs:', error.message);
        return [];
      }
    };
    
    const allJobIds = await extractJobIds();
    console.log(`Found ${allJobIds.length} total job IDs`);
    
    if (allJobIds.length === 0) {
      // Fallback to fetchActiveJobs if we couldn't get job IDs from status_board/data
      console.log('Falling back to fetchActiveJobs...');
      const activeJobs = await fetchActiveJobs(20, 20);
      
      if (activeJobs.length === 0) {
        console.log('No jobs found to sync');
        return;
      }
      
      console.log(`Found ${activeJobs.length} active jobs to sync`);
      const jobMap = new Map();
      
      // Add active jobs to map
      activeJobs.forEach(job => {
        if (job.internal_id) {
          jobMap.set(job.internal_id, job);
        }
      });
      
      // Convert map back to array
      const jobs = Array.from(jobMap.values());
      
      // Save a sample job for reference
      await saveSampleJob(jobs[0]);
      
      // Configure concurrency options
      const options = {
        concurrency: 5,
        delayMs: 100,
        batchSize: 20,
        batchDelayMs: 1000
      };
      
      // Process all jobs concurrently in batches
      console.log(`Syncing ${jobs.length} active jobs to Airtable...`);
      await processBatch(jobs, async (job) => {
        try {
          return await addJobToAirtable(job);
        } catch (error) {
          console.error(`Error processing job ${job?.internal_id}:`, error.message);
          return null;
        }
      }, options);
      
      console.log('Active jobs sync completed');
      return;
    }
    
    // Process all job IDs in batches to avoid rate limits
    console.log(`Processing all ${allJobIds.length} job IDs...`);
    
    // Configure concurrency options for job fetching
    const jobOptions = {
      concurrency: 5,    // Increase concurrency from 2 to 5 for better performance
      delayMs: 100,      // Decrease delay between calls for better performance
      batchSize: 20,     // Increase batch size from 10 to 20
      batchDelayMs: 1000 // Decrease delay between batches for better performance
    };
    
    // Process all jobs, not just a small sample
    const totalJobs = allJobIds.length;
    const batchSize = 100; // Process in large batches of 100
    const jobs = [];
    
    // Process jobs in batches of 100
    for (let startIndex = 0; startIndex < totalJobs; startIndex += batchSize) {
      const endIndex = Math.min(startIndex + batchSize, totalJobs);
      const currentBatch = allJobIds.slice(startIndex, endIndex);
      
      console.log(`Processing job batch ${Math.floor(startIndex/batchSize) + 1}/${Math.ceil(totalJobs/batchSize)} (indices ${startIndex}-${endIndex-1})...`);
      
      await processBatch(currentBatch, async (jobId) => {
        try {
          console.log(`Fetching job details for job ID: ${jobId}`);
          const job = await fetchJobById(jobId);
          
          if (job) {
            jobs.push(job);
            console.log(`Successfully fetched job ${job.internal_id || jobId}`);
            
            // Sync the job to Airtable immediately
            await addJobToAirtable(job);
            console.log(`Synced job ${job.internal_id || jobId} to Airtable`);
          } else {
            console.log(`Could not fetch job details for ID: ${jobId}`);
          }
          
          return job;
        } catch (error) {
          console.error(`Error processing job ID ${jobId}:`, error.message);
          return null;
        }
      }, jobOptions);
      
      console.log(`Completed batch ${Math.floor(startIndex/batchSize) + 1}/${Math.ceil(totalJobs/batchSize)}`);
      
      // Break after first batch during development to avoid long runs
      if (process.env.NODE_ENV === 'development') {
        console.log('Breaking after first batch because NODE_ENV is development');
        break;
      }
    }
    
    console.log(`Successfully processed ${jobs.length} out of ${totalJobs} job IDs`);
    
    if (jobs.length > 0) {
      // Save a sample job for reference
      await saveSampleJob(jobs[0]);
    }
    
    console.log('Job sync completed successfully!');
  } catch (error) {
    console.error('Error in sync process:', error.message);
  }
}

/**
 * Log a job status change to track history (optional)
 * You can create a "Job Changes" table in Airtable to track this history
 */
async function logJobStatusChange(jobId, oldStatus, newStatus) {
  try {
    // Check if the "Job Changes" table exists in your Airtable base
    // If it doesn't, you can comment out this function call or create the table
    const changeLog = {
      'Job ID': jobId,
      'Previous Status': oldStatus,
      'New Status': newStatus,
      'Changed At': new Date().toISOString()
    };
    
    // Uncomment the lines below if you create a Job Changes table in Airtable
    // await airtableBase('Job Changes').create(changeLog);
    // console.log(`📝 Logged status change for job ${jobId}`);
    
    // For now, just log to console
    console.log(`📝 Status change logged: ${jobId} ${oldStatus} → ${newStatus} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`Error logging job status change:`, error.message);
  }
}

/**
 * Save sample job data to a file
 */
async function saveSampleJob(job) {
  const outputDir = path.join(__dirname, 'output');
  await fs.mkdir(outputDir, { recursive: true });
  
  const sampleFile = path.join(outputDir, 'job-sample.json');
  await fs.writeFile(sampleFile, JSON.stringify(job, null, 2));
  console.log(`Saved job sample structure to ${sampleFile}`);
}

/**
 * Fetch invoices from Fergus API with pagination
 */
async function fetchInvoices(pageSize = 20, maxPages = 3) {
  // Trying different endpoint for invoices - this is more likely the correct one
  const url = 'https://app.fergus.com/api/v2/financials/invoices';
  
  let allInvoices = [];
  let currentPage = 1;
  
  try {
    // Fetch invoices using pagination
    while (currentPage <= maxPages) {
      console.log(`Fetching invoices page ${currentPage}...`);
      
      // For invoices, POST is likely the right method with specific filtering
      const response = await axios.post(url, {
        page: currentPage,
        page_size: pageSize,
        filter: {},
        sort: { date: "desc" }
      }, {
        headers: getDefaultHeaders()
      });
      
      const invoices = response.data.data || response.data.value || [];
      console.log(`Fetched ${invoices.length} invoices from page ${currentPage}`);
      
      // Break if no more invoices
      if (invoices.length === 0) break;
      
      // Add invoices to collection
      allInvoices = [...allInvoices, ...invoices];
      
      // Check if there are more pages
      const totalPages = Math.ceil((response.data.recordsTotal || 0) / pageSize);
      if (currentPage >= totalPages) break;
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Next page
      currentPage++;
    }
    
    console.log(`Fetched a total of ${allInvoices.length} invoices from Fergus API`);
    
    if (allInvoices.length > 0) {
      // Save a sample invoice
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'invoice-sample.json'), 
        JSON.stringify(allInvoices[0], null, 2)
      );
      console.log('Saved invoice sample to output/invoice-sample.json');
    }
    
    return allInvoices;
  } catch (error) {
    console.error('Error fetching invoices from Fergus:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    
    // If we get a 404, let's try an alternative endpoint
    if (error.response && error.response.status === 404) {
      console.log('Trying alternative invoice endpoint...');
      return await fetchInvoicesAlternative(pageSize, maxPages);
    }
    
    throw error;
  }
}

/**
 * Alternative method to fetch invoices from a different endpoint
 */
async function fetchInvoicesAlternative(pageSize = 20, maxPages = 3) {
  const url = 'https://app.fergus.com/api/v2/finance/invoices';
  let allInvoices = [];
  let currentPage = 1;
  
  try {
    // Fetch invoices using pagination with an alternative endpoint
    while (currentPage <= maxPages) {
      console.log(`Fetching invoices (alt) page ${currentPage}...`);
      
      const response = await axios.get(url, {
        params: {
          page: currentPage,
          per_page: pageSize
        },
        headers: getDefaultHeaders()
      });
      
      const invoices = response.data.data || response.data.value || [];
      console.log(`Fetched ${invoices.length} invoices from alt page ${currentPage}`);
      
      // Break if no more invoices
      if (invoices.length === 0) break;
      
      // Add invoices to collection
      allInvoices = [...allInvoices, ...invoices];
      
      // Check if we have a next page
      if (!response.data.next_page_url) break;
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Next page
      currentPage++;
    }
    
    console.log(`Fetched a total of ${allInvoices.length} invoices from alternative API endpoint`);
    
    if (allInvoices.length > 0) {
      // Save a sample invoice
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'invoice-sample-alt.json'), 
        JSON.stringify(allInvoices[0], null, 2)
      );
      console.log('Saved invoice sample to output/invoice-sample-alt.json');
    }
    
    return allInvoices;
  } catch (error) {
    console.error('Error fetching invoices from alternative endpoint:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    return []; // Return empty array instead of throwing
  }
}

/**
 * Get full invoice details including customer information
 */
async function getInvoiceDetails(invoiceId) {
  try {
    const url = `https://app.fergus.com/api/v2/invoices/${invoiceId}`;
    const response = await axios.get(url, {
      headers: getDefaultHeaders()
    });
    
    return response.data.value;
  } catch (error) {
    console.error(`Error fetching details for invoice ${invoiceId}:`, error.message);
    return null;
  }
}

/**
 * Add or update an invoice in Airtable (upsert)
 * This handles various invoice data formats we might encounter
 */
async function addInvoiceToAirtable(invoice, jobData = null) {
  try {
    // Extract invoice fields carefully since we have multiple possible formats
    const invoiceNumber = invoice.invoice_number || invoice.number || '';
    
    // If we don't have an invoice number, we can't process it
    if (!invoiceNumber) {
      console.log('Skipping invoice without invoice number');
      return null;
    }
    
    // Get job info either from the invoice or the provided job data
    let jobNumber, siteAddress, customerName;
    
    if (jobData) {
      // If we have job data, use it
      jobNumber = jobData.internal_id || jobData.internal_job_id || '';
      siteAddress = typeof jobData.site_address === 'object' 
        ? formatAddressObject(jobData.site_address) 
        : jobData.site_address || '';
      customerName = jobData.customer_full_name || jobData.customer_name || '';
    } else {
      // Otherwise, try to extract from the invoice
      jobNumber = invoice.job_number || (invoice.job && invoice.job.number) || '';
      siteAddress = invoice.site_address || (invoice.job && invoice.job.site_address) || '';
      customerName = invoice.customer_name || invoice.customer_full_name || '';
    }
    
    const status = invoice.status || 'UNKNOWN';
    const amount = invoice.amount_paid || invoice.amount || invoice.total || 0;
    const invoiceRef = invoice.reference || invoice.ref || '';
    const date = invoice.date || invoice.created_at || invoice.invoice_date || null;
    
    // Parse customer name into first/last if possible
    let firstName = '', lastName = '';
    if (customerName) {
      const nameParts = customerName.split(' ');
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      } else {
        firstName = customerName;
      }
    }
    
    // Format invoice date
    let invoiceDate = null;
    if (date) {
      invoiceDate = new Date(date).toISOString().split('T')[0];
    }

    // Create a standard record object from the invoice data
    const record = {
      'Invoice Number': invoiceNumber,
      'Invoice Reference': invoiceRef,
      'Fergus Site Address': siteAddress,
      'Fergus Job Number': jobNumber,
      'Amount Paid': amount,
      'Invoice Status': status,
      'Customer': customerName,
      'Invoice Date': invoiceDate,
      'First Name': firstName,
      'Last Name': lastName,
      'Total': invoice.total || amount
    };

    // Add Credit Note info if available
    if (invoice.credit_note) {
      record['Credit Note'] = invoice.credit_note;
    }

    // Log what we're processing
    console.log(`Processing invoice ${invoiceNumber} for customer ${customerName}`);

    // Check if the invoice already exists in Airtable - use invoice number as the unique identifier
    const existingRecords = await airtableBase('Invoices')
      .select({
        filterByFormula: `{Invoice Number} = "${invoiceNumber}"`,
        maxRecords: 1
      })
      .firstPage();
    
    let result;
    
    if (existingRecords && existingRecords.length > 0) {
      // Invoice exists - update it with the latest data
      const existingRecord = existingRecords[0];
      const recordId = existingRecord.getId();
      const existingFields = existingRecord.fields;
      
      // Check for status changes
      const currentStatus = existingFields['Invoice Status'];
      
      if (currentStatus !== status && currentStatus && status) {
        console.log(`🔄 Status change for invoice ${invoiceNumber}: ${currentStatus} → ${status}`);
      }
      
      // Update the record in Airtable
      result = await airtableBase('Invoices').update(recordId, record);
      console.log(`✅ Updated invoice ${invoiceNumber} in Airtable`);
    } else {
      // Invoice doesn't exist - create a new record
      result = await airtableBase('Invoices').create(record);
      console.log(`➕ Added new invoice ${invoiceNumber} to Airtable`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error upserting invoice:`, error.message);
    // Continue with other invoices instead of throwing
    return null;
  }
}

/**
 * Try another approach - fetch invoices from jobs
 */
async function fetchInvoicesFromJobs(jobs) {
  const invoices = [];
  
  console.log('Trying to extract invoices from jobs...');
  
  try {
    // Go through each job and check for invoice information
    for (let i = 0; i < Math.min(jobs.length, 10); i++) { // Try first 10 jobs
      const job = jobs[i];
      console.log(`Checking job ${job.internal_id} for invoices...`);
      
      try {
        // Try to get detailed job information that might include invoices
        const jobDetailsUrl = `https://app.fergus.com/api/v2/job_card/load_from_job`;
        const response = await axios.post(jobDetailsUrl, {
          job_id: job.id
        }, {
          headers: getDefaultHeaders()
        });
        
        // Check if there are invoices in the response
        const jobDetails = response.data?.value;
        
        if (jobDetails && jobDetails.invoices && jobDetails.invoices.length > 0) {
          console.log(`Found ${jobDetails.invoices.length} invoices in job ${job.internal_id}`);
          
          // Add job reference to each invoice
          const jobInvoices = jobDetails.invoices.map(invoice => ({
            ...invoice,
            job_number: job.internal_id,
            site_address: job.site_address,
            customer_name: job.customer_full_name
          }));
          
          invoices.push(...jobInvoices);
          
          // Save a sample invoice for structure examination
          if (invoices.length > 0 && invoices.length <= 5) {
            const outputDir = path.join(__dirname, 'output');
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(
              path.join(outputDir, `job-invoice-sample-${invoices.length}.json`), 
              JSON.stringify(invoices[invoices.length - 1], null, 2)
            );
          }
        }
      } catch (error) {
        console.error(`Error getting details for job ${job.internal_id}:`, error.message);
      }
      
      // Add a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`Found a total of ${invoices.length} invoices from jobs`);
    return invoices;
  } catch (error) {
    console.error('Error extracting invoices from jobs:', error.message);
    return [];
  }
}

/**
 * Another approach - fetch invoice using the customer_invoices/job_card endpoint
 */
async function fetchInvoiceByJobCard(invoiceId) {
  try {
    const url = `https://app.fergus.com/api/v2/customer_invoices/job_card/${invoiceId}`;
    console.log(`Fetching invoice details from ${url}`);
    
    const response = await axios.get(url, {
      headers: getDefaultHeaders()
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching invoice ${invoiceId}:`, error.message);
    return null;
  }
}

/**
 * Fetch all invoices using the customer_invoices endpoint
 */
async function fetchAllCustomerInvoices(pageSize = 20, maxPages = 3) {
  const url = 'https://app.fergus.com/api/v2/customer_invoices';
  let allInvoices = [];
  let currentPage = 1;
  
  try {
    // Fetch invoices using pagination
    while (currentPage <= maxPages) {
      console.log(`Fetching customer invoices page ${currentPage}...`);
      
      const response = await axios.get(url, {
        params: {
          page: currentPage,
          per_page: pageSize
        },
        headers: getDefaultHeaders()
      });
      
      const invoices = response.data.invoices || [];
      console.log(`Fetched ${invoices.length} customer invoices from page ${currentPage}`);
      
      // Break if no more invoices
      if (invoices.length === 0) break;
      
      // Add invoices to collection
      allInvoices = [...allInvoices, ...invoices];
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Next page
      currentPage++;
      
      // Break after first page during testing
      if (process.env.NODE_ENV === 'development') break;
    }
    
    console.log(`Fetched a total of ${allInvoices.length} customer invoices`);
    
    if (allInvoices.length > 0) {
      // Save a sample invoice
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'customer-invoice-sample.json'), 
        JSON.stringify(allInvoices[0], null, 2)
      );
      console.log('Saved customer invoice sample to output/customer-invoice-sample.json');
      
      // Get detailed info for first invoice
      if (allInvoices[0].id) {
        const detailedInvoice = await fetchInvoiceByJobCard(allInvoices[0].id);
        if (detailedInvoice) {
          await fs.writeFile(
            path.join(outputDir, 'detailed-invoice-sample.json'), 
            JSON.stringify(detailedInvoice, null, 2)
          );
          console.log('Saved detailed invoice sample to output/detailed-invoice-sample.json');
        }
      }
    }
    
    return allInvoices;
  } catch (error) {
    console.error('Error fetching customer invoices:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    return [];
  }
}

/**
 * Sync invoices from Fergus to Airtable
 */
async function syncInvoicesToAirtable() {
  try {
    // Try the customer_invoices endpoint first (this is likely the correct one)
    console.log('Fetching invoices from customer_invoices endpoint...');
    let invoices = await fetchAllCustomerInvoices(20, 2);
    
    // If that doesn't work, try the other methods
    if (invoices.length === 0) {
      console.log('Trying other invoice endpoints...');
      invoices = await fetchInvoices(20, 2);
    }
    
    // If we still don't have invoices, try extracting from jobs
    if (invoices.length === 0) {
      console.log('No invoices found via direct API, trying to extract from jobs...');
      const jobs = await fetchActiveJobs(20, 2);
      invoices = await fetchInvoicesFromJobs(jobs);
    }
    
    if (invoices.length === 0) {
      console.log('No invoices found to sync after trying all methods');
      return;
    }
    
    // Sync invoices to Airtable
    console.log(`Syncing ${invoices.length} invoices to Airtable...`);
    for (const invoice of invoices) {
      try {
        // Get detailed invoice information if needed and if we have an ID
        let detailedInvoice = null;
        if (invoice.id) {
          detailedInvoice = await fetchInvoiceByJobCard(invoice.id);
        }
        
        await addInvoiceToAirtable(invoice, detailedInvoice);
        // Add delay to avoid Airtable rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error processing invoice:`, error.message);
      }
    }
    
    console.log('Invoice sync completed successfully!');
  } catch (error) {
    console.error('Error in invoice sync process:', error.message);
  }
}

/**
 * Fetch invoice data using the jobs/extended_json endpoint
 * This endpoint provides more comprehensive invoice data directly from a job
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
    
    // Extract and normalize the job data
    let normalizedData = response.data;
    
    // Check if we need to save the data to file for examination
    if (options.saveToFile) {
      try {
        const outputDir = path.join(__dirname, 'output');
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
    
    // If the job data is in the expected format, return it
    if (normalizedData && normalizedData.result === 'success') {
      // Pull out the job data and ensure site_address is included
      const jobData = normalizedData.value?.jobCard?.job || null;
      
      if (jobData) {
        // Make sure we include the site_address object with contact information
        if (!jobData.site_address && normalizedData.value?.jobCard?.jobContactId) {
          // Try to get site address information from the response
          const siteContact = normalizedData.value?.siteContact;
          if (siteContact) {
            jobData.site_address = siteContact;
          }
        }
        
        // Also ensure we have access to any invoices
        if (!jobData.invoices && normalizedData.value?.invoices) {
          jobData.invoices = normalizedData.value.invoices;
        }
      }
      
      return normalizedData;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching job ${jobIdentifier} with invoices:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', typeof error.response.data === 'string' && 
                   error.response.data.length > 1000 ? 
                   'Response too large to display' : 
                   JSON.stringify(error.response.data));
    }
    return null;
  }
}

/**
 * Process invoices from job data and sync to Airtable
 */
async function syncJobInvoicesToAirtable(jobId) {
  try {
    // First get the job data with invoices
    const jobData = await fetchJobWithInvoices(jobId);
    
    if (!jobData || !jobData.invoices) {
      console.log(`No invoice data found for job ${jobId}`);
      return [];
    }
    
    const invoices = jobData.invoices;
    console.log(`Found ${invoices.length} invoices for job ${jobId}`);
    
    // Get job details to enrich the invoice data
    const jobDetails = {
      jobNumber: jobData.internal_id || jobId,
      siteAddress: jobData.site_address || '',
      customerName: jobData.customer_name || ''
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

/**
 * Improved function to sync multiple jobs with their invoices
 */
async function syncMultipleJobsWithInvoices(jobIds) {
  console.log(`Starting to sync ${jobIds.length} jobs with their invoices...`);
  
  let totalInvoices = 0;
  
  for (const jobId of jobIds) {
    console.log(`Processing job ${jobId}...`);
    const invoices = await syncJobInvoicesToAirtable(jobId);
    totalInvoices += invoices.length;
    
    // Add delay between jobs
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`Completed syncing ${totalInvoices} invoices from ${jobIds.length} jobs`);
}

/**
 * Find jobs with invoices and sync them to Airtable with concurrent processing
 * This function checks specific jobs for invoices using the jobs/extended_json endpoint
 */
async function findAndSyncInvoices() {
  try {
    console.log('Looking for jobs that might have invoices...');
    
    // First, get active jobs
    console.log('Fetching active jobs (20 pages)...'); // Increase from 10 to 20 pages to get more jobs
    const activeJobs = await fetchActiveJobs(20, 20);
    
    // Also get completed jobs as they're more likely to have invoices
    console.log('Fetching completed jobs...');
    const completedJobs = await fetchCompletedJobs(20, 5);
    
    // Combine both sets of jobs
    const allJobs = [...activeJobs, ...completedJobs];
    
    if (allJobs.length === 0) {
      console.log('No jobs found to check for invoices');
      return;
    }
    
    console.log(`Found ${allJobs.length} total jobs to search for invoices (${activeJobs.length} active, ${completedJobs.length} completed)`);
    
    // Try to find jobs that might have invoices based on their status and other attributes
    let jobsToCheck = [];
    
    // Check for jobs with specific statuses that are likely to have invoices
    const invoiceStatusJobs = allJobs.filter(job => {
      const status = job.job_status || job.status_name || '';
      return ['invoiced', 'paid', 'completed'].some(s => 
        status.toLowerCase().includes(s.toLowerCase())
      );
    });
    
    if (invoiceStatusJobs.length > 0) {
      console.log(`Found ${invoiceStatusJobs.length} jobs with invoice-related statuses`);
      // Add these to our check list (up to 20)
      jobsToCheck = [...jobsToCheck, ...invoiceStatusJobs.slice(0, 20)];
    }
    
    // Add jobs that might have financial data
    const jobsWithFinancialData = allJobs.filter(job => 
      job.total_claimed > 0 || 
      job.total_paid > 0 || 
      job.has_invoice === true ||
      job.invoice_count > 0
    );
    
    if (jobsWithFinancialData.length > 0) {
      console.log(`Found ${jobsWithFinancialData.length} jobs with financial data indicators`);
      // Add jobs not already in our list (up to 40 total)
      const remainingSlots = Math.max(0, 40 - jobsToCheck.length);
      const jobsToAdd = jobsWithFinancialData
        .filter(job => !jobsToCheck.some(j => j.id === job.id))
        .slice(0, remainingSlots);
      
      jobsToCheck = [...jobsToCheck, ...jobsToAdd];
    }
    
    // Add any "Won" status jobs as they might have invoices
    const wonJobs = allJobs.filter(job => {
      const status = job.job_status || job.status_name || '';
      return status.toLowerCase().includes('won');
    });
    
    if (wonJobs.length > 0) {
      console.log(`Found ${wonJobs.length} 'Won' status jobs that might have invoices`);
      // Add jobs not already in our list (up to 60 total)
      const remainingSlots = Math.max(0, 60 - jobsToCheck.length);
      const jobsToAdd = wonJobs
        .filter(job => !jobsToCheck.some(j => j.id === job.id))
        .slice(0, remainingSlots);
      
      jobsToCheck = [...jobsToCheck, ...jobsToAdd];
    }
    
    // If we don't have many jobs to check, add more from the active jobs
    if (jobsToCheck.length < 20) {
      const remainingSlots = 20 - jobsToCheck.length;
      const additionalJobs = allJobs
        .filter(job => !jobsToCheck.some(j => j.id === job.id))
        .slice(0, remainingSlots);
      
      jobsToCheck = [...jobsToCheck, ...additionalJobs];
      console.log(`Added ${additionalJobs.length} additional jobs to check for invoices`);
    }
    
    console.log(`Will check ${jobsToCheck.length} jobs for invoices`);
    
    // Configure concurrency options for invoice processing
    const invoiceOptions = {
      concurrency: 2,    // Lower concurrency for invoice API calls
      delayMs: 500,      // More delay between calls
      batchSize: 5,      // Smaller batch size
      batchDelayMs: 2000 // More delay between batches
    };
    
    let totalInvoicesFound = 0;
    
    // Create a directory for invoice samples
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Try multiple approaches for finding invoices
    // First attempt - Process jobs concurrently in batches with improved logging
    console.log('ATTEMPT 1: Using extended_json endpoint to find invoices');
    await processBatch(jobsToCheck, async (job) => {
      try {
        const jobId = job.id || job.job_id;
        const internalJobId = job.internal_id || job.internal_job_id || '';
        
        if (!jobId && !internalJobId) return null;
        
        console.log(`Checking job ${internalJobId || jobId} (${job.job_status || 'Unknown status'}) for invoices...`);
        
        // Try with job_id first
        let jobData;
        if (jobId) {
          jobData = await fetchJobWithInvoices(jobId, { useJobId: true });
        }
        
        // If that fails, try with internal_job_id
        if (!jobData && internalJobId) {
          const numericId = internalJobId.replace('NW-', '');
          jobData = await fetchJobWithInvoices(numericId);
        }
        
        if (!jobData || jobData.result !== 'success') {
          console.log(`Couldn't get detailed data for job ${internalJobId || jobId}`);
          return null;
        }
        
        // Save the full job data for inspection
        await fs.writeFile(
          path.join(outputDir, `job-with-invoices-${internalJobId || jobId}.json`), 
          JSON.stringify(jobData, null, 2)
        );
        
        // Check if we have invoices in the response
        const invoices = jobData.value?.invoices || [];
        
        // Check if the job has financial data that indicates it might have invoices
        const financialData = jobData.value?.total_paid || jobData.value?.total_claimed || 0;
        
        if (invoices && invoices.length > 0) {
          console.log(`✅ Found ${invoices.length} invoices for job ${internalJobId || jobId}`);
          
          // Save a sample invoice for structure examination
          await fs.writeFile(
            path.join(outputDir, `invoice-sample-${internalJobId || jobId}.json`), 
            JSON.stringify(invoices[0], null, 2)
          );
          
          // Process invoices with the job information
          const jobInfo = jobData.value?.jobCard?.job || job;
          
          // Process invoices
          for (const invoice of invoices) {
            console.log(`Processing invoice for job ${internalJobId || jobId}`);
            const result = await addInvoiceToAirtable(invoice, jobInfo);
            if (result) totalInvoicesFound++;
          }
          
          return invoices;
        } else if (financialData > 0) {
          console.log(`💲 Job ${internalJobId || jobId} has financial data (${financialData}) but no invoices in response`);
          
          // Try alternative endpoints for finding invoices
          try {
            console.log(`Trying alternative API approaches for job ${internalJobId || jobId}...`);
            
            // Try jobcard endpoint
            const jobCardUrl = `https://app.fergus.com/api/v2/job_card/load_from_job`;
            const jobCardResponse = await axios.post(jobCardUrl, {
              job_id: jobId
            }, {
              headers: getDefaultHeaders()
            });
            
            // Check for invoices in this response
            if (jobCardResponse.data?.value?.invoices?.length > 0) {
              const invoices = jobCardResponse.data.value.invoices;
              console.log(`✅ Found ${invoices.length} invoices using job_card endpoint for job ${internalJobId || jobId}`);
              
              // Save invoice sample
              await fs.writeFile(
                path.join(outputDir, `jobcard-invoice-${internalJobId || jobId}.json`), 
                JSON.stringify(invoices[0], null, 2)
              );
              
              // Process these invoices
              for (const invoice of invoices) {
                const result = await addInvoiceToAirtable(invoice, jobInfo);
                if (result) totalInvoicesFound++;
              }
              
              return invoices;
            }
            
            // If no invoices found via job_card, try the final alternative
            const invoiceApiUrl = `https://app.fergus.com/api/v2/customer_invoices/job/${jobId}`;
            const invoiceResponse = await axios.get(invoiceApiUrl, {
              headers: getDefaultHeaders()
            });
            
            if (invoiceResponse.data?.invoices?.length > 0) {
              const invoices = invoiceResponse.data.invoices;
              console.log(`✅ Found ${invoices.length} invoices using customer_invoices endpoint for job ${internalJobId || jobId}`);
              
              // Save invoice sample
              await fs.writeFile(
                path.join(outputDir, `api-invoice-${internalJobId || jobId}.json`), 
                JSON.stringify(invoices[0], null, 2)
              );
              
              // Process these invoices
              for (const invoice of invoices) {
                const result = await addInvoiceToAirtable(invoice, jobInfo);
                if (result) totalInvoicesFound++;
              }
              
              return invoices;
            }
          } catch (altError) {
            console.log(`Alternative invoice endpoints returned no results for ${internalJobId || jobId}`);
          }
        } else {
          console.log(`No invoices or financial data found in job data for ${internalJobId || jobId}`);
        }
        
        return null;
      } catch (error) {
        console.error(`Error processing job for invoices:`, error.message);
        return null;
      }
    }, invoiceOptions);
    
    // If we still haven't found any invoices, try another approach
    if (totalInvoicesFound === 0) {
      console.log('\nATTEMPT 2: Trying to fetch invoices directly from the financials endpoint');
      
      // Try fetching invoices directly from the financials endpoint
      try {
        const invoicesUrl = 'https://app.fergus.com/api/v2/financials/data';
        const invoicesResponse = await axios.post(invoicesUrl, {}, {
          headers: getDefaultHeaders()
        });
        
        if (invoicesResponse.data) {
          // Save the response to analyze its structure
          await fs.writeFile(
            path.join(outputDir, 'financials-data.json'), 
            JSON.stringify(invoicesResponse.data, null, 2)
          );
          
          console.log('Saved financials data response for analysis');
          
          // Look for invoice IDs in the response
          const findInvoiceIDs = (obj, results = []) => {
            if (!obj || typeof obj !== 'object') return results;
            
            if (obj.invoice_number || obj.invoice_id) {
              results.push({
                invoice_id: obj.invoice_id,
                invoice_number: obj.invoice_number,
                job_id: obj.job_id,
                amount: obj.amount
              });
            }
            
            if (Array.isArray(obj)) {
              obj.forEach(item => findInvoiceIDs(item, results));
            } else {
              Object.values(obj).forEach(val => findInvoiceIDs(val, results));
            }
            
            return results;
          };
          
          const invoiceIDs = findInvoiceIDs(invoicesResponse.data);
          if (invoiceIDs.length > 0) {
            console.log(`Found ${invoiceIDs.length} potential invoice IDs in financials data`);
            
            // Try to get detailed info for each invoice
            for (const invoiceInfo of invoiceIDs.slice(0, 5)) { // Try first 5 only
              try {
                if (invoiceInfo.invoice_id) {
                  console.log(`Fetching details for invoice ID ${invoiceInfo.invoice_id}`);
                  
                  const invoiceUrl = `https://app.fergus.com/api/v2/invoices/${invoiceInfo.invoice_id}`;
                  const invoiceData = await axios.get(invoiceUrl, {
                    headers: getDefaultHeaders()
                  });
                  
                  if (invoiceData.data) {
                    console.log(`✅ Successfully fetched invoice ${invoiceInfo.invoice_id}`);
                    await fs.writeFile(
                      path.join(outputDir, `invoice-detail-${invoiceInfo.invoice_id}.json`), 
                      JSON.stringify(invoiceData.data, null, 2)
                    );
                    
                    // If there's valid invoice data, add to Airtable
                    if (invoiceData.data.value) {
                      const result = await addInvoiceToAirtable(invoiceData.data.value);
                      if (result) totalInvoicesFound++;
                    }
                  }
                }
              } catch (invoiceError) {
                console.log(`Could not fetch invoice ${invoiceInfo.invoice_id}: ${invoiceError.message}`);
              }
            }
          } else {
            console.log('No invoice IDs found in financials data');
          }
        }
      } catch (financialsError) {
        console.error('Error fetching financials data:', financialsError.message);
      }
    }
    
    console.log(`Completed invoice sync, found ${totalInvoicesFound} invoices total`);
    
    if (totalInvoicesFound === 0) {
      console.log(`
==============================================
No invoices were found in the jobs checked.
This could be because:
1. The jobs don't have any invoices yet
2. We need to use a different API endpoint
3. Authentication or permissions issues

The following could help:
1. Check the output directory for saved job data
2. Look at the job statuses in Fergus to find jobs that have been invoiced
3. Try manually invoicing a job in Fergus then run this script again
==============================================
`);
    }
  } catch (error) {
    console.error('Error finding and syncing invoices:', error.message);
  }
}

/**
 * Helper function to fetch jobs with specific statuses
 */
async function fetchJobsWithStatus(statuses, pageSize = 20, maxPages = 3) {
  try {
    console.log(`Fetching jobs with statuses: ${statuses.join(', ')}...`);
    
    const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
    let jobsWithStatus = [];
    let currentPage = 1;
    
    while (currentPage <= maxPages) {
      console.log(`Fetching page ${currentPage}...`);
      
      const response = await axios.post(url, {
        page: currentPage,
        page_size: pageSize,
        filter: "",
        selected_group_ids: [],
        selected_employee_ids: []
      }, {
        headers: getDefaultHeaders()
      });
      
      const jobs = response.data.value || [];
      
      // Filter jobs by status
      const matchingJobs = jobs.filter(job => {
        const jobStatus = job.job_status || job.status_name || '';
        return statuses.some(status => 
          jobStatus.toLowerCase().includes(status.toLowerCase())
        );
      });
      
      console.log(`Found ${matchingJobs.length} matching jobs on page ${currentPage}`);
      
      // Add matching jobs to collection
      jobsWithStatus = [...jobsWithStatus, ...matchingJobs];
      
      // Check if there are more pages
      const totalPages = response.data.paging?.total_pages || 0;
      if (currentPage >= totalPages || jobs.length === 0) break;
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Next page
      currentPage++;
    }
    
    console.log(`Found a total of ${jobsWithStatus.length} jobs with requested statuses`);
    return jobsWithStatus;
  } catch (error) {
    console.error('Error fetching jobs by status:', error.message);
    return [];
  }
}

/**
 * Improved main function to sync both jobs and invoices from Fergus to Airtable
 */
async function syncAllToAirtable() {
  try {
    console.log("=== SYNCING JOBS ===");
    await syncJobsToAirtable();
    
    console.log("\n=== LOOKING FOR INVOICES ===");
    await findAndSyncInvoices();
    
    console.log('All sync operations completed successfully!');
    return { success: true, message: 'Sync completed successfully' };
  } catch (error) {
    console.error('Error in sync process:', error.message);
    return { success: false, message: `Sync failed: ${error.message}` };
  }
}

/**
 * Process a subset of all job IDs to avoid memory issues and timeouts
 * Useful for extremely large job sets
 */
async function processSubsetOfJobs(startIndex = 0, count = 100) {
  try {
    // First, get all job IDs from the status_board/data endpoint
    console.log('Fetching all job IDs from status_board/data...');
    const extractJobIds = async () => {
      try {
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
      } catch (error) {
        console.error('Error extracting job IDs:', error.message);
        return [];
      }
    };
    
    const allJobIds = await extractJobIds();
    console.log(`Found ${allJobIds.length} total job IDs`);
    
    if (allJobIds.length === 0) {
      console.log('No jobs found to process');
      return { success: false, message: 'No jobs found' };
    }
    
    // Calculate subset range
    const endIndex = Math.min(startIndex + count, allJobIds.length);
    const jobIdsToProcess = allJobIds.slice(startIndex, endIndex);
    
    console.log(`Processing subset of jobs from index ${startIndex} to ${endIndex-1} (${jobIdsToProcess.length} jobs)`);
    
    // Configure concurrency options for job fetching
    const jobOptions = {
      concurrency: 2,
      delayMs: 500,
      batchSize: 10,
      batchDelayMs: 2000
    };
    
    const jobs = [];
    
    await processBatch(jobIdsToProcess, async (jobId) => {
      try {
        console.log(`Fetching job details for job ID: ${jobId}`);
        const job = await fetchJobById(jobId);
        
        if (job) {
          jobs.push(job);
          console.log(`Successfully fetched job ${job.internal_id || jobId}`);
          
          // Sync the job to Airtable immediately
          await addJobToAirtable(job);
          console.log(`Synced job ${job.internal_id || jobId} to Airtable`);
        } else {
          console.log(`Could not fetch job details for ID: ${jobId}`);
        }
        
        return job;
      } catch (error) {
        console.error(`Error processing job ID ${jobId}:`, error.message);
        return null;
      }
    }, jobOptions);
    
    console.log(`Successfully processed ${jobs.length} out of ${jobIdsToProcess.length} job IDs in subset`);
    
    return {
      success: true,
      message: `Processed ${jobs.length} jobs`,
      startIndex,
      endIndex: endIndex,
      totalJobIds: allJobIds.length
    };
  } catch (error) {
    console.error('Error processing job subset:', error.message);
    return { success: false, message: `Error: ${error.message}` };
  }
}

// Update the main execution to use the new combined sync function
if (require.main === module) {
  // Check if we have specific command line arguments to process a subset
  const args = process.argv.slice(2);
  if (args.length >= 2 && args[0] === '--subset') {
    const [startIndex, count] = args[1].split(':').map(Number);
    if (!isNaN(startIndex) && !isNaN(count)) {
      processSubsetOfJobs(startIndex, count).catch(console.error);
    } else {
      console.error('Invalid subset format. Use --subset start:count, e.g. --subset 0:100');
      syncAllToAirtable().catch(console.error);
    }
  } else {
    syncAllToAirtable().catch(console.error);
  }
}

// Update exports to include the new functions
module.exports = { 
  fetchActiveJobs, 
  fetchCompletedJobs,
  fetchJobById,
  fetchInvoices,
  fetchJobWithInvoices,
  getDetailedJobData,
  findAndSyncInvoices,
  fetchJobsWithStatus,
  syncJobInvoicesToAirtable,
  syncMultipleJobsWithInvoices,
  addJobToAirtable, 
  addInvoiceToAirtable,
  syncJobsToAirtable,
  syncInvoicesToAirtable,
  syncAllToAirtable,
  processSubsetOfJobs
}; 

/**
 * Fetch jobs from all pipeline stages using the /data endpoint
 * This will get jobs from all statuses shown in the status board: 
 * PENDING, PRICING, SCHEDULING, IN PROGRESS, BACK COSTING, INVOICING, and PAYMENTS
 */
async function fetchAllPipelineJobs() {
  const url = 'https://app.fergus.com/api/v2/status_board/data';
  
  try {
    console.log('Fetching pipeline structure and job IDs...');
    
    const response = await axios.post(url, {
      page: 1,
      page_size: 100, // Request a large size to get all data at once
      filter: "",
      selected_group_ids: [],
      selected_employee_ids: []
    }, {
      headers: getDefaultHeaders()
    });
    
    // Check if the response contains the expected data structure
    if (!response.data || response.data.result !== 'success') {
      console.error('Unexpected response structure:', response.data);
      return [];
    }
    
    // Save sample of response for debugging
    await fs.writeFile(
      path.join(__dirname, 'sample-data-response.json'),
      JSON.stringify(response.data, null, 2)
    );
    console.log('Saved sample data response to sample-data-response.json');
    
    // Extract job IDs from each pipeline stage
    const jobIds = [];
    const pipelineData = response.data.value;
    let sectionCounts = {};
    
    // Check all active sections in the pipeline
    if (pipelineData && pipelineData.active) {
      // Process each pipeline stage (pending, pricing, scheduling, etc.)
      for (const stageName in pipelineData.active) {
        if (pipelineData.active[stageName] && pipelineData.active[stageName].sections) {
          sectionCounts[stageName] = {};
          
          // Process each section within a stage
          for (const sectionName in pipelineData.active[stageName].sections) {
            const section = pipelineData.active[stageName].sections[sectionName];
            
            // Some sections have job_ids in params
            if (section && section.params && section.params.job_ids && Array.isArray(section.params.job_ids)) {
              const ids = section.params.job_ids;
              console.log(`Found ${ids.length} job IDs in ${stageName} - ${sectionName}`);
              
              // Add metadata about the stage and section
              ids.forEach(id => {
                jobIds.push({
                  id: id,
                  pipeline_stage: stageName,
                  pipeline_section: sectionName
                });
              });
              
              sectionCounts[stageName][sectionName] = ids.length;
            }
          }
        }
      }
    }
    
    console.log('Pipeline section counts:', JSON.stringify(sectionCounts, null, 2));
    console.log(`Found a total of ${jobIds.length} job IDs across all pipeline stages`);
    
    // Save job IDs to a file for reference
    await fs.writeFile(
      path.join(__dirname, 'pipeline-job-ids.json'),
      JSON.stringify(jobIds, null, 2)
    );
    
    // Fetch detailed job data for each ID
    console.log('Fetching detailed job data for all pipeline jobs...');
    const allJobs = [];
    const batchSize = 10; // Process in small batches to avoid overwhelming the API
    
    // Process job IDs in batches
    for (let i = 0; i < jobIds.length; i += batchSize) {
      const batch = jobIds.slice(i, i + batchSize);
      console.log(`Processing batch ${i/batchSize + 1} of ${Math.ceil(jobIds.length/batchSize)}...`);
      
      const batchPromises = batch.map(async (jobIdInfo) => {
        try {
          // Try to get job data directly first
          let jobData = await fetchJobById(jobIdInfo.id);
          
          // If direct fetch fails, try the extended JSON endpoint
          if (!jobData) {
            const detailedResponse = await fetchJobWithInvoices(jobIdInfo.id, { useJobId: true });
            if (detailedResponse && detailedResponse.result === 'success') {
              jobData = detailedResponse.value?.jobCard?.job || null;
            }
          }
          
          // Add pipeline metadata to job data
          if (jobData) {
            jobData.pipeline_stage = jobIdInfo.pipeline_stage;
            jobData.pipeline_section = jobIdInfo.pipeline_section;
            return jobData;
          }
          
          return null;
        } catch (error) {
          console.error(`Error fetching job ${jobIdInfo.id}:`, error.message);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validJobs = batchResults.filter(job => job !== null);
      allJobs.push(...validJobs);
      
      // Delay between batches to avoid rate limiting
      if (i + batchSize < jobIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Successfully fetched ${allJobs.length} jobs out of ${jobIds.length} IDs`);
    
    if (allJobs.length > 0) {
      // Save all jobs to a file for inspection
      await fs.writeFile(
        path.join(__dirname, 'all-pipeline-jobs.json'),
        JSON.stringify(allJobs, null, 2)
      );
      console.log('Saved all pipeline jobs to all-pipeline-jobs.json');
      
      // Log a sample
      console.log('First job sample:', JSON.stringify(allJobs[0], null, 2).substring(0, 300) + '...');
    }
    
    return allJobs;
  } catch (error) {
    console.error('Error fetching pipeline jobs from Fergus:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    return [];
  }
}

/**
 * Sync all jobs from all pipeline stages to Airtable
 */
async function syncAllPipelineJobsToAirtable() {
  try {
    console.log('Starting pipeline jobs sync...');
    
    // Fetch all jobs from all pipeline stages
    const jobs = await fetchAllPipelineJobs();
    console.log(`Processing ${jobs.length} jobs from all pipeline stages`);
    
    // Process jobs in batches to avoid hitting Airtable rate limits
    await processBatch(jobs, async (job) => {
      // Get detailed job data if available
      const detailedJob = await getDetailedJobData(job.id);
      
      // Add or update job in Airtable
      await addJobToAirtable(job, detailedJob);
    }, { batchSize: 10 });
    
    console.log('Pipeline jobs sync completed successfully');
  } catch (error) {
    console.error('Error syncing pipeline jobs to Airtable:', error.message);
  }
}

// ... existing code ...

// Update the main sync function to include pipeline jobs
async function syncAllToAirtable() {
  try {
    // Sync active jobs
    await syncJobsToAirtable();
    
    // Sync pipeline jobs from all stages
    await syncAllPipelineJobsToAirtable();
    
    // Sync invoices
    await syncInvoicesToAirtable();
    
    console.log('All syncing completed successfully!');
  } catch (error) {
    console.error('Error during full sync:', error.message);
  }
}

// ... existing code ...

// Expose functions for external usage
module.exports = {
  syncJobsToAirtable,
  syncInvoicesToAirtable,
  fetchJobWithInvoices,
  syncJobInvoicesToAirtable,
  syncMultipleJobsWithInvoices,
  fetchActiveJobs,
  addJobToAirtable,
  addInvoiceToAirtable,
  getInvoiceDetails,
  fetchCompletedJobs,
  saveSampleJob,
  findAndSyncInvoices,
  syncAllToAirtable,
  fetchAllPipelineJobs,
  syncAllPipelineJobsToAirtable,
  processBatch,
  airtableBase
};