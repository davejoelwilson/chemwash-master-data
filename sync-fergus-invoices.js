/**
 * Fergus Invoices to Airtable Sync
 * ==============================
 * This script specifically focuses on fetching invoices from Fergus and syncing them to Airtable
 * 
 * FEATURES:
 * - Retrieves invoices from completed and invoiced jobs in Fergus
 * - Syncs invoice data to Airtable (creates new or updates existing)
 * - Handles different API endpoints to maximize invoice discovery
 * - Associates invoices with jobs in Airtable
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
 * Fetch jobs from Fergus that have invoices or are likely to have invoices
 * Specifically targets "Invoiced", "Paid", and other relevant statuses
 */
async function fetchJobsWithInvoices() {
  try {
    console.log('Fetching jobs that have or might have invoices...');
    
    // Directly targeting jobs with specific statuses related to invoicing
    const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
    let potentialJobs = [];
    let currentPage = 1;
    const pageSize = 50; // Larger page size to get more jobs at once
    
    while (currentPage <= 10) { // Check up to 10 pages
      console.log(`Fetching page ${currentPage} of jobs...`);
      
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
      
      if (jobs.length === 0) break;
      
      // Try to get ALL jobs as potential invoice candidates - 
      // we'll check each one individually regardless of status
      potentialJobs = [...potentialJobs, ...jobs];
      
      // Also log which status values we're seeing for debugging
      const statusValues = new Set();
      jobs.forEach(job => {
        const status = job.job_status || job.status_name || job.status || '';
        if (status) statusValues.add(status);
      });
      
      console.log(`Status values found: ${Array.from(statusValues).join(', ')}`);
      
      // Check if there are more pages
      const totalPages = response.data.paging?.total_pages || 0;
      if (currentPage >= totalPages) break;
      
      // Next page
      currentPage++;
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Total potential jobs to check for invoices: ${potentialJobs.length}`);
    return potentialJobs;
  } catch (error) {
    console.error('Error fetching jobs with invoices:', error.message);
    return [];
  }
}

/**
 * Also fetch completed jobs separately, as they're more likely to have invoices
 * This uses a different endpoint that might have different job statuses
 */
async function fetchCompletedJobs(pageSize = 20, maxPages = 5) {
  try {
    console.log('Fetching specifically completed/invoiced jobs...');
    const url = 'https://app.fergus.com/api/v2/jobs';
    let allJobs = [];
    let currentPage = 1;
    
    // Try different search terms
    const searchTerms = [
      "status:completed", 
      "status:invoiced", 
      "status:paid",
      "status:closed",
      "status:done",
      "invoice"
    ];
    
    // Try each search term separately
    for (const searchTerm of searchTerms) {
      console.log(`Searching for jobs with term: ${searchTerm}`);
      
      try {
        currentPage = 1;
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
    
    console.log(`Fetched a total of ${allJobs.length} potentially completed/invoiced jobs`);
    return allJobs;
  } catch (error) {
    console.error('Error fetching completed jobs:', error.message);
    return [];
  }
}

/**
 * Fetch invoice details directly using the finance API
 * This specifically queries for invoices from financial data
 */
async function fetchInvoicesDirectly() {
  try {
    console.log('Fetching invoices directly from financial API...');
    
    // Try multiple endpoints for invoices
    const endpoints = [
      'https://app.fergus.com/api/v2/finance/invoices',
      'https://app.fergus.com/api/v2/financials/invoices',
      'https://app.fergus.com/api/v2/invoices'
    ];
    
    let allInvoices = [];
    
    for (const url of endpoints) {
      try {
        console.log(`Trying endpoint: ${url}`);
        
        let currentPage = 1;
        const pageSize = 50;
        
        while (currentPage <= 5) { // Check up to 5 pages
          console.log(`Fetching invoice page ${currentPage}...`);
          
          const response = await axios.get(url, {
            params: {
              page: currentPage,
              per_page: pageSize
            },
            headers: getDefaultHeaders()
          });
          
          // Different endpoints may have different response structures
          const invoices = response.data.data || response.data.invoices || response.data.value || [];
          console.log(`Fetched ${invoices.length} invoices from page ${currentPage}`);
          
          if (invoices.length === 0) break;
          
          allInvoices = [...allInvoices, ...invoices];
          
          // Check if there are more pages (different structures)
          const hasNextPage = response.data.links?.next || response.data.meta?.next_page || false;
          if (!hasNextPage) break;
          
          // Next page
          currentPage++;
          
          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error with endpoint ${url}:`, error.message);
        // Continue with the next endpoint
      }
    }
    
    console.log(`Fetched a total of ${allInvoices.length} invoices directly`);
    
    // Save a sample invoice for reference
    if (allInvoices.length > 0) {
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'invoice-direct-sample.json'),
        JSON.stringify(allInvoices[0], null, 2)
      );
    }
    
    return allInvoices;
  } catch (error) {
    console.error('Error fetching invoices directly:', error.message);
    return [];
  }
}

/**
 * Fetch detailed job data including invoices
 */
async function fetchJobWithInvoices(jobId) {
  try {
    const url = 'https://app.fergus.com/api/v2/jobs/extended_json';
    console.log(`Fetching detailed data for job ${jobId}...`);
    
    const response = await axios.get(url, {
      params: {
        job_id: jobId,
        internal_job_id: '',
        page: ''
      },
      headers: getDefaultHeaders()
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching detailed data for job ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Try to fetch job invoices using the job_card endpoint
 */
async function fetchJobCardWithInvoices(jobId) {
  try {
    const url = 'https://app.fergus.com/api/v2/job_card/load_from_job';
    console.log(`Fetching job card data for job ${jobId}...`);
    
    const response = await axios.post(url, {
      job_id: jobId
    }, {
      headers: getDefaultHeaders()
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching job card for job ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Try to fetch invoices from alternative financial endpoints
 */
async function fetchFinancialInvoices(jobId) {
  try {
    const url = `https://app.fergus.com/api/v2/financials/invoices/job/${jobId}`;
    console.log(`Fetching financial invoices for job ${jobId}...`);
    
    const response = await axios.get(url, {
      headers: getDefaultHeaders()
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching financial invoices for job ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Add or update an invoice in Airtable
 */
async function addInvoiceToAirtable(invoice, jobData = null) {
  try {
    console.log(`Processing invoice: ${invoice.invoice_number || invoice.number || 'Unknown'}`);
    
    // Extract essential fields carefully since different endpoints return different structures
    const invoiceNumber = invoice.invoice_number || invoice.number || invoice.id || '';
    
    // Get job info either from the invoice or the provided job data
    let jobNumber, siteAddress, customerName, jobObj;
    
    if (jobData) {
      // If we have job data, use it
      jobObj = jobData;
      jobNumber = jobData.internal_id || jobData.internal_job_id || jobData.job_number || '';
      siteAddress = typeof jobData.site_address === 'object' 
        ? formatAddressObject(jobData.site_address) 
        : jobData.site_address || '';
      customerName = jobData.customer_full_name || jobData.customer_name || '';
    } else if (invoice.job) {
      // Use job data from the invoice
      jobObj = invoice.job;
      jobNumber = invoice.job.internal_id || invoice.job.internal_job_id || invoice.job.job_number || '';
      siteAddress = typeof invoice.job.site_address === 'object' 
        ? formatAddressObject(invoice.job.site_address) 
        : invoice.job.site_address || '';
      customerName = invoice.job.customer_full_name || invoice.job.customer_name || '';
    } else {
      // Otherwise, try to extract from the invoice
      jobNumber = invoice.job_number || '';
      siteAddress = invoice.site_address || '';
      customerName = invoice.customer_name || invoice.customer_full_name || '';
    }
    
    const status = invoice.status || 'Unknown';
    
    // Handle amount values safely for Currency field
    let amount = 0.01; // Default small non-zero value
    
    if (typeof invoice.amount_paid === 'number' && invoice.amount_paid > 0) {
      amount = invoice.amount_paid;
    } else if (typeof invoice.amount === 'number' && invoice.amount > 0) {
      amount = invoice.amount;
    } else if (typeof invoice.total === 'number' && invoice.total > 0) {
      amount = invoice.total;
    } else if (typeof invoice.draft_claim_amount_incl_tax === 'number' && invoice.draft_claim_amount_incl_tax > 0) {
      amount = invoice.draft_claim_amount_incl_tax;
    }
    
    // Ensure amount is a valid number for Currency field
    amount = parseFloat(amount);
    if (isNaN(amount)) {
      amount = 0.01; // Default to small non-zero value for Currency fields
    }
    
    const invoiceRef = invoice.reference || invoice.ref || '';
    const date = invoice.date || invoice.created_at || invoice.invoice_date || null;
    
    // Format invoice date
    let invoiceDate = null;
    if (date) {
      try {
        invoiceDate = new Date(date).toISOString().split('T')[0];
      } catch (err) {
        console.log(`Invalid date format: ${date}`);
        invoiceDate = new Date().toISOString().split('T')[0];
      }
    } else {
      invoiceDate = new Date().toISOString().split('T')[0];
    }
    
    // Get due date if available
    let dueDate = null;
    if (invoice.due_date) {
      try {
        dueDate = new Date(invoice.due_date).toISOString().split('T')[0];
      } catch (err) {
        console.log(`Invalid due date format: ${invoice.due_date}`);
      }
    }
    
    // Get creation date
    let creationDate = null;
    if (invoice.created_at) {
      try {
        creationDate = new Date(invoice.created_at).toISOString().split('T')[0];
      } catch (err) {
        console.log(`Invalid creation date format: ${invoice.created_at}`);
      }
    }
    
    // Extract contact information
    let firstName = '', lastName = '', customerEmail = '', siteContactEmail = '';
    
    // Try to extract contact info from site_address
    if (jobObj && jobObj.site_address) {
      // Get name
      firstName = jobObj.site_address.first_name || '';
      lastName = jobObj.site_address.last_name || '';
      
      // Try to get email from contact_items
      if (Array.isArray(jobObj.site_address.contact_items)) {
        const siteEmailItem = jobObj.site_address.contact_items.find(item => 
          item.contact_type === 'email');
        if (siteEmailItem) {
          siteContactEmail = siteEmailItem.contact_val || '';
        }
      }
    }
    
    // Try to extract customer email
    if (jobObj && jobObj.main_contact) {
      if (Array.isArray(jobObj.main_contact.contact_items)) {
        const customerEmailItem = jobObj.main_contact.contact_items.find(item => 
          item.contact_type === 'email');
        if (customerEmailItem) {
          customerEmail = customerEmailItem.contact_val || '';
        }
      }
    }
    
    // Total amount (may differ from Amount Paid)
    let total = amount; // Default to same as amount paid
    if (typeof invoice.total === 'number' && invoice.total > 0) {
      total = parseFloat(invoice.total);
    } else if (typeof invoice.draft_claim_amount_incl_tax === 'number' && invoice.draft_claim_amount_incl_tax > 0) {
      total = parseFloat(invoice.draft_claim_amount_incl_tax);
    }
    
    if (isNaN(total)) {
      total = amount; // Fallback to amount paid
    }

    // Done status (checkbox field)
    const isDone = status.toLowerCase() === 'paid' || 
                   (invoice.is_final === true && invoice.is_sent === true);
    
    // Xero Contact Address (if available)
    const xeroContactAddress = jobObj && jobObj.company_name ? 
      jobObj.company_name : (firstName && lastName ? `${firstName} ${lastName}` : customerName);
    
    // Create the Airtable record
    const record = {
      'Invoice Number': invoiceNumber,
      'Invoice Reference': invoiceRef,
      'Fergus Site Address': siteAddress,
      'Fergus Job Number': jobNumber,
      'Amount Paid': amount, // Proper number for Currency field
      'Invoice Status': status,
      'Customer': customerName,
      'Invoice Date': invoiceDate,
      'First Name': firstName,
      'Last Name': lastName,
      'Total': total,
      'Customer Email': customerEmail,
      'Site Contact Email': siteContactEmail,
      'Xero Contact Address': xeroContactAddress,
      'Done': isDone,
    };
    
    // Add optional dates
    if (dueDate) {
      record['Due Date'] = dueDate;
    }
    
    if (creationDate) {
      record['Creation Date'] = creationDate;
    }
    
    // Add Credit Note if we have a description
    if (invoice.description) {
      record['Credit Note'] = invoice.description;
    }
    
    // Handle items if available
    if (invoice.items && Array.isArray(invoice.items)) {
      const itemsText = invoice.items.map(item => 
        `${item.description || 'Item'}: ${item.quantity || 1} × $${item.unit_price || 0}`
      ).join('\n');
      
      if (record['Credit Note']) {
        record['Credit Note'] += '\n\n' + itemsText;
      } else {
        record['Credit Note'] = itemsText;
      }
    }
    
    console.log(`Invoice record to save: ${JSON.stringify(record)}`);
    
    // Check if the invoice already exists in Airtable
    const existingRecords = await airtableBase('Invoices')
      .select({
        filterByFormula: `{Invoice Number} = "${record['Invoice Number']}"`,
        maxRecords: 1
      })
      .firstPage();
    
    let result;
    
    if (existingRecords && existingRecords.length > 0) {
      // Invoice exists - update it
      const existingRecord = existingRecords[0];
      const recordId = existingRecord.getId();
      
      result = await airtableBase('Invoices').update(recordId, record);
      console.log(`✅ Updated invoice ${invoiceNumber} in Airtable`);
    } else {
      // Invoice doesn't exist - create a new record
      result = await airtableBase('Invoices').create(record);
      console.log(`➕ Added new invoice ${invoiceNumber} to Airtable`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error adding invoice to Airtable:`, error.message);
    return null;
  }
}

/**
 * Fetch jobs from the status_board/data endpoint
 * This endpoint gives us more data about all jobs in the system
 */
async function fetchJobsFromStatusBoard() {
  try {
    console.log('Fetching jobs from status_board/data endpoint...');
    
    const url = 'https://app.fergus.com/api/v2/status_board/data';
    
    const response = await axios.post(url, {}, {
      headers: getDefaultHeaders()
    });
    
    const data = response.data;
    
    // Log all status types we find to help with debugging
    const statusTypes = new Set();
    const jobTypes = new Set();
    
    // Function to recursively extract status and job types
    const extractTypes = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      // Extract status names
      if (obj.status_name) {
        statusTypes.add(obj.status_name);
      }
      
      // Extract job types
      if (obj.job_type_name) {
        jobTypes.add(obj.job_type_name);
      }
      
      if (Array.isArray(obj)) {
        obj.forEach(item => extractTypes(item));
      } else {
        Object.values(obj).forEach(val => extractTypes(val));
      }
    };
    
    extractTypes(data);
    
    console.log(`Status types found: ${Array.from(statusTypes).join(', ')}`);
    console.log(`Job types found: ${Array.from(jobTypes).join(', ')}`);
    
    // Extract all job IDs
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
    console.log(`Found ${jobIds.size} job IDs from status board data`);
    
    // Get jobs with types that are more likely to have invoices
    // In most systems, these would be job types that get billed to customers
    const filteredJobs = [];
    let processedCount = 0;
    
    // We'll sample some jobs to get their full details and find which ones might have invoices
    // Focus especially on jobs with types or statuses that suggest completed work or billing
    for (const jobId of jobIds) {
      try {
        // Limit the number we initially check to avoid overloading the API
        if (processedCount >= 40) break;
        
        const jobData = await fetchJobWithInvoices(jobId);
        
        if (jobData?.result === 'success' && jobData.value?.jobCard?.job) {
          processedCount++;
          
          const job = jobData.value.jobCard.job;
          
          // Check job type - we're most interested in types that might have invoices
          // These are often service, repair, maintenance jobs or ones that have been completed
          const jobType = job.job_type_name?.toLowerCase() || '';
          const jobStatus = job.status_name?.toLowerCase() || '';
          
          // Filter logic - prioritize jobs types/statuses that might have invoices
          const isPriority = 
            // Job types that often get invoiced
            jobType.includes('service') || 
            jobType.includes('repair') || 
            jobType.includes('maintenance') ||
            jobType.includes('installation') ||
            // Jobs that aren't quotes/estimates (which typically don't have invoices yet)
            !jobType.includes('quote') ||
            // Job statuses that suggest invoicing
            jobStatus.includes('complete') || 
            jobStatus.includes('invoice') || 
            jobStatus.includes('paid') ||
            jobStatus.includes('done') ||
            // Check if the job has certain keywords in its description
            (job.brief_description && 
             (job.brief_description.toLowerCase().includes('invoice') ||
              job.brief_description.toLowerCase().includes('payment') ||
              job.brief_description.toLowerCase().includes('bill')));
          
          if (isPriority) {
            console.log(`Found priority job: ${job.internal_id} (${jobType}, ${jobStatus})`);
            filteredJobs.push(job);
          } else {
            // Include some non-priority jobs too in case our assumptions are wrong
            if (Math.random() < 0.2) { // 20% chance of including non-priority jobs
              filteredJobs.push(job);
            }
          }
        }
        
        // Short delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error fetching job ${jobId} details:`, error.message);
      }
    }
    
    console.log(`Filtered to ${filteredJobs.length} jobs that might have invoices`);
    return filteredJobs;
  } catch (error) {
    console.error('Error fetching jobs from status board:', error.message);
    return [];
  }
}

/**
 * Fetch invoices using the status_board/data endpoint
 * This endpoint has 'to_invoice' section with invoice IDs
 */
async function fetchInvoicesFromStatusBoard() {
  try {
    console.log('Fetching invoices from status_board/data endpoint...');
    
    const url = 'https://app.fergus.com/api/v2/status_board/data';
    
    const response = await axios.post(url, {}, {
      headers: getDefaultHeaders()
    });
    
    const data = response.data;
    
    // Extract invoice-related IDs from the response
    const invoiceData = {
      worksOrderIds: new Set(),
      customerInvoiceIds: new Set()
    };
    
    // Function to recursively extract invoice IDs
    const extractInvoiceIds = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      // Look for to_invoice section
      if (obj.to_invoice) {
        // Look inside sections if it exists
        if (obj.to_invoice.sections?.to_invoice?.params) {
          const params = obj.to_invoice.sections.to_invoice.params;
          
          // Extract works_order_ids
          if (Array.isArray(params.works_order_ids)) {
            params.works_order_ids.forEach(id => invoiceData.worksOrderIds.add(id));
          }
          
          // Extract customer_invoice_ids
          if (Array.isArray(params.customer_invoice_ids)) {
            params.customer_invoice_ids.forEach(id => invoiceData.customerInvoiceIds.add(id));
          }
        }
      }
      
      // Also check in any 'sections' property directly
      if (obj.sections?.to_invoice?.params) {
        const params = obj.sections.to_invoice.params;
        
        // Extract works_order_ids
        if (Array.isArray(params.works_order_ids)) {
          params.works_order_ids.forEach(id => invoiceData.worksOrderIds.add(id));
        }
        
        // Extract customer_invoice_ids
        if (Array.isArray(params.customer_invoice_ids)) {
          params.customer_invoice_ids.forEach(id => invoiceData.customerInvoiceIds.add(id));
        }
      }
      
      // Recursively check all properties
      if (Array.isArray(obj)) {
        obj.forEach(item => extractInvoiceIds(item));
      } else if (typeof obj === 'object') {
        Object.values(obj).forEach(val => extractInvoiceIds(val));
      }
    };
    
    extractInvoiceIds(data);
    
    console.log(`Found ${invoiceData.worksOrderIds.size} works order IDs and ${invoiceData.customerInvoiceIds.size} customer invoice IDs`);
    
    // Save these IDs for reference
    try {
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'invoice-ids.json'),
        JSON.stringify({
          works_order_ids: Array.from(invoiceData.worksOrderIds),
          customer_invoice_ids: Array.from(invoiceData.customerInvoiceIds)
        }, null, 2)
      );
    } catch (err) {
      console.error('Error saving invoice IDs:', err.message);
    }
    
    // Also save the full response for analysis
    try {
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'status-board-data.json'),
        JSON.stringify(data, null, 2)
      );
      console.log('Saved full status board data for analysis');
    } catch (err) {
      console.error('Error saving status board data:', err.message);
    }
    
    // Fetch details for these invoice IDs
    const invoices = [];
    
    // Try to get customer invoice details first
    if (invoiceData.customerInvoiceIds.size > 0) {
      console.log('Fetching customer invoice details...');
      
      for (const invoiceId of invoiceData.customerInvoiceIds) {
        try {
          // Try different possible endpoints for invoice details
          const endpoints = [
            `https://app.fergus.com/api/v2/financials/invoices/${invoiceId}`,
            `https://app.fergus.com/api/v2/finance/invoices/${invoiceId}`,
            `https://app.fergus.com/api/v2/invoices/${invoiceId}`,
            `https://app.fergus.com/api/v2/customer_invoices/${invoiceId}`
          ];
          
          let invoiceData = null;
          
          for (const endpoint of endpoints) {
            try {
              console.log(`Trying to fetch invoice ${invoiceId} from ${endpoint}`);
              const response = await axios.get(endpoint, {
                headers: getDefaultHeaders(),
                timeout: 5000 // 5 second timeout
              });
              
              if (response.data) {
                invoiceData = response.data;
                console.log(`Successfully fetched invoice ${invoiceId}!`);
                
                // Save the customer invoice data for reference
                try {
                  const outputDir = path.join(__dirname, 'output');
                  await fs.mkdir(outputDir, { recursive: true });
                  await fs.writeFile(
                    path.join(outputDir, `customer-invoice-${invoiceId}.json`),
                    JSON.stringify(invoiceData, null, 2)
                  );
                } catch (err) {
                  // Ignore errors saving sample file
                }
                
                break;
              }
            } catch (error) {
              console.log(`Failed to fetch from ${endpoint}: ${error.message}`);
              // Continue to next endpoint
            }
          }
          
          if (invoiceData) {
            invoices.push(invoiceData);
          }
          
          // Short delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error fetching invoice ${invoiceId}:`, error.message);
        }
      }
    }
    
    // Also try to get works order details
    if (invoiceData.worksOrderIds.size > 0) {
      console.log('Fetching works order details...');
      
      for (const orderId of invoiceData.worksOrderIds) {
        try {
          // Try different possible endpoints for works order details
          const endpoints = [
            `https://app.fergus.com/api/v2/works_orders/${orderId}`,
            `https://app.fergus.com/api/v2/works-orders/${orderId}`,
            `https://app.fergus.com/api/v2/orders/${orderId}`,
            `https://app.fergus.com/api/v2/jobs/${orderId}` // Try job endpoint as well
          ];
          
          let orderData = null;
          
          for (const endpoint of endpoints) {
            try {
              console.log(`Trying to fetch works order ${orderId} from ${endpoint}`);
              const response = await axios.get(endpoint, {
                headers: getDefaultHeaders(),
                timeout: 5000 // 5 second timeout
              });
              
              if (response.data) {
                orderData = response.data;
                console.log(`Successfully fetched works order ${orderId}!`);
                
                // Save a sample of the works order data if we haven't already
                try {
                  const outputDir = path.join(__dirname, 'output');
                  await fs.mkdir(outputDir, { recursive: true });
                  await fs.writeFile(
                    path.join(outputDir, `works-order-${orderId}.json`),
                    JSON.stringify(orderData, null, 2)
                  );
                } catch (err) {
                  // Ignore errors saving sample file
                }
                
                break;
              }
            } catch (error) {
              console.log(`Failed to fetch from ${endpoint}: ${error.message}`);
              // Continue to next endpoint
            }
          }
          
          if (orderData) {
            // Try to extract invoice information from the works order
            if (orderData.invoice || orderData.invoices) {
              const extractedInvoices = orderData.invoices || [orderData.invoice];
              invoices.push(...extractedInvoices.filter(Boolean));
            } else {
              // Store the works order itself as it might contain invoice data
              orderData._is_works_order = true;  // Mark it as a works order
              orderData.total = orderData.total || 0; // Ensure total exists
              orderData.status = "Ready to invoice"; // Special status for works orders
              invoices.push(orderData);
            }
          }
          
          // Short delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error fetching works order ${orderId}:`, error.message);
        }
      }
    }
    
    console.log(`Found ${invoices.length} invoices in total from status board data`);
    return invoices;
  } catch (error) {
    console.error('Error fetching invoices from status board:', error.message);
    return [];
  }
}

/**
 * Process a job to find and sync its invoices
 */
async function processJobForInvoices(job) {
  const jobId = job.id || job.job_id;
  const internalJobId = job.internal_id || job.internal_job_id || '';
  
  if (!jobId && !internalJobId) {
    console.log('Job has no identifiers, skipping');
    return [];
  }
  
  console.log(`Looking for invoices for job ${internalJobId || jobId}...`);
  
  const invoicesFound = [];
  
  // Method 1: Try the extended_json endpoint
  const jobData = await fetchJobWithInvoices(jobId);
  if (jobData && jobData.result === 'success') {
    console.log(`Successfully fetched extended data for job ${internalJobId || jobId}`);
    
    // Save job data for reference
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, `extended-job-${internalJobId || jobId}.json`), 
      JSON.stringify(jobData, null, 2)
    );
    
    // Look for invoices in the response
    const invoices = jobData.value?.invoices || [];
    if (invoices.length > 0) {
      console.log(`Found ${invoices.length} invoices in extended data!`);
      
      // Process each invoice
      for (const invoice of invoices) {
        const result = await addInvoiceToAirtable(invoice, jobData.value?.jobCard?.job);
        if (result) invoicesFound.push(result);
      }
      
      return invoicesFound;
    } else {
      console.log('No invoices found in extended data');
    }
  }
  
  // Method 2: Try job_card endpoint
  const jobCardData = await fetchJobCardWithInvoices(jobId);
  if (jobCardData && jobCardData.result === 'success') {
    console.log(`Successfully fetched job card data for job ${internalJobId || jobId}`);
    
    // Look for invoices in the response
    const invoices = jobCardData.value?.invoices || [];
    if (invoices.length > 0) {
      console.log(`Found ${invoices.length} invoices in job card data!`);
      
      // Process each invoice
      for (const invoice of invoices) {
        const result = await addInvoiceToAirtable(invoice, jobCardData.value?.job);
        if (result) invoicesFound.push(result);
      }
      
      return invoicesFound;
    } else {
      console.log('No invoices found in job card data');
    }
  }
  
  // Method 3: Try financial invoices
  const financialData = await fetchFinancialInvoices(jobId);
  if (financialData && (financialData.data || financialData.invoices)) {
    console.log(`Successfully fetched financial data for job ${internalJobId || jobId}`);
    
    // Look for invoices in the response
    const invoices = financialData.data || financialData.invoices || [];
    if (invoices.length > 0) {
      console.log(`Found ${invoices.length} invoices in financial data!`);
      
      // Process each invoice
      for (const invoice of invoices) {
        const result = await addInvoiceToAirtable(invoice, job);
        if (result) invoicesFound.push(result);
      }
      
      return invoicesFound;
    } else {
      console.log('No invoices found in financial data');
    }
  }
  
  console.log(`No invoices found for job ${internalJobId || jobId} after trying all methods`);
  return invoicesFound;
}

/**
 * Main function to sync invoices from Fergus to Airtable
 */
async function syncFergusInvoicesToAirtable() {
  try {
    console.log('Starting Fergus invoice sync to Airtable...');
    
    // Step 1: Get invoices directly from the status_board/data endpoint
    const statusBoardInvoices = await fetchInvoicesFromStatusBoard();
    
    // Step 2: If we found invoices, process them
    if (statusBoardInvoices.length > 0) {
      console.log(`Processing ${statusBoardInvoices.length} invoices found in status board data...`);
      
      let syncedCount = 0;
      
      // Process each item individually
      for (const invoice of statusBoardInvoices) {
        try {
          // Check if this is a works order or an actual invoice
          if (invoice._is_works_order) {
            // This is a works order, try to extract invoice data
            console.log(`Processing works order ${invoice.id || invoice.order_id || 'unknown'}...`);
            
            // Create an invoice record from works order data
            const invoiceRecord = {
              invoice_number: invoice.order_number || invoice.id || `WO-${Date.now()}`,
              amount: typeof invoice.total === 'number' && invoice.total > 0 ? parseFloat(invoice.total) : 0.01,
              amount_paid: 0.01, // Small non-zero value for Currency field
              total: typeof invoice.total === 'number' && invoice.total > 0 ? parseFloat(invoice.total) : 0.01,
              status: "Ready to invoice", // Special status for works orders
              date: invoice.created_at || new Date().toISOString(),
              job_number: invoice.job_number || '',
              customer_name: invoice.customer?.name || invoice.customer_name || ''
            };
            
            // Try to get job information if possible
            if (invoice.job_id) {
              try {
                const jobData = await fetchJobWithInvoices(invoice.job_id);
                if (jobData?.result === 'success' && jobData.value?.jobCard?.job) {
                  const job = jobData.value.jobCard.job;
                  
                  // Add job data to invoice record
                  invoiceRecord.job_number = job.internal_id || job.internal_job_id || invoiceRecord.job_number;
                  
                  if (job.site_address) {
                    invoiceRecord.site_address = typeof job.site_address === 'object' 
                      ? formatAddressObject(job.site_address) 
                      : job.site_address;
                      
                    // Extract additional contact details
                    if (typeof job.site_address === 'object') {
                      invoiceRecord.first_name = job.site_address.first_name || '';
                      invoiceRecord.last_name = job.site_address.last_name || '';
                      
                      // Try to get email from contact_items
                      if (Array.isArray(job.site_address.contact_items)) {
                        const siteEmailItem = job.site_address.contact_items.find(item => 
                          item.contact_type === 'email');
                        if (siteEmailItem) {
                          invoiceRecord.site_contact_email = siteEmailItem.contact_val || '';
                        }
                      }
                    }
                  }
                  
                  // Update customer name if available
                  if (job.customer_full_name || job.customer_name) {
                    invoiceRecord.customer_name = job.customer_full_name || job.customer_name;
                  }
                  
                  // Try to get customer email
                  if (job.main_contact && Array.isArray(job.main_contact.contact_items)) {
                    const customerEmailItem = job.main_contact.contact_items.find(item => 
                      item.contact_type === 'email');
                    if (customerEmailItem) {
                      invoiceRecord.customer_email = customerEmailItem.contact_val || '';
                    }
                  }
                  
                  // Add creation date
                  if (job.created_at) {
                    try {
                      invoiceRecord.creation_date = new Date(job.created_at).toISOString().split('T')[0];
                    } catch (err) {
                      // Ignore invalid date
                    }
                  }
                  
                  // Add Xero contact address
                  invoiceRecord.xero_contact_address = job.company_name ? 
                    job.company_name : (invoiceRecord.first_name && invoiceRecord.last_name ? 
                      `${invoiceRecord.first_name} ${invoiceRecord.last_name}` : invoiceRecord.customer_name);
                }
              } catch (error) {
                console.log(`Couldn't fetch additional job data: ${error.message}`);
              }
            }
            
            // Add due date (30 days from now for works orders)
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            invoiceRecord.due_date = dueDate.toISOString().split('T')[0];
            
            // Set done status (always false for works orders)
            invoiceRecord.done = false;
            
            // If we have a description, use it for credit note
            if (invoice.long_description) {
              invoiceRecord.credit_note = invoice.long_description;
            }
            
            const result = await addInvoiceToAirtable(invoiceRecord);
            if (result) syncedCount++;
          } else {
            // This is a regular invoice
            console.log(`Processing invoice ${invoice.invoice_number || invoice.number || invoice.id || 'unknown'}...`);
            const result = await addInvoiceToAirtable(invoice);
            if (result) syncedCount++;
          }
        } catch (error) {
          console.error(`Error processing invoice:`, error.message);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log(`Successfully synced ${syncedCount} invoices to Airtable`);
      return;
    }
    
    // If we didn't find any invoices in the status board, try the other methods
    console.log('No invoices found in status board. Trying other methods...');
    
    // Step 3: Get jobs from both the active jobs endpoints
    const activeJobs = await fetchJobsWithInvoices();
    
    // Step 4: Get jobs from the status_board/data endpoint, which might include different jobs
    const statusBoardJobs = await fetchJobsFromStatusBoard();
    
    // Step 5: Check if financials API is accessible before making multiple failed calls
    let canAccessFinancials = false;
    try {
      console.log('Testing financial API access...');
      const testResponse = await axios.get('https://app.fergus.com/api/v2/finance/invoices', {
        params: { page: 1, per_page: 1 },
        headers: getDefaultHeaders(),
        timeout: 5000 // 5 second timeout
      });
      canAccessFinancials = true;
      console.log('Financial API is accessible!');
    } catch (error) {
      console.log('Financial API is not accessible with current permissions. Skipping direct invoice fetching.');
    }
    
    // Only try to fetch direct invoices if we can access the endpoint
    const directInvoices = canAccessFinancials ? await fetchInvoicesDirectly() : [];
    
    // Step 6: Combine and deduplicate jobs from both sources
    const jobMap = new Map();
    
    [...activeJobs, ...statusBoardJobs].forEach(job => {
      const id = job.id || job.job_id;
      if (id && !jobMap.has(id)) {
        jobMap.set(id, job);
      }
    });
    
    const combinedJobs = Array.from(jobMap.values());
    console.log(`Combined ${combinedJobs.length} unique jobs to check for invoices`);
    
    // Step 7: Prioritize jobs that might have invoices
    const jobsToProcess = prioritizeJobsForInvoiceChecking(combinedJobs);
    
    console.log(`Processing ${jobsToProcess.length} jobs most likely to have invoices...`);
    
    // Step 8: Process each job to find and sync its invoices
    let totalInvoices = 0;
    
    const processedJobs = new Set(); // Track processed jobs to avoid duplicates
    
    for (const job of jobsToProcess) {
      const jobId = job.id || job.job_id;
      // Skip if we've already processed this job
      if (processedJobs.has(jobId)) continue;
      processedJobs.add(jobId);
      
      console.log(`Processing job ${job.internal_id || jobId}...`);
      
      try {
        // Only check for invoices using methods that have worked
        const invoices = await processJobForInvoicesSimplified(job, canAccessFinancials);
        totalInvoices += invoices.length;
      } catch (error) {
        console.error(`Error processing job ${job.internal_id || jobId}:`, error.message);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Step 9: Process any direct invoices (if applicable)
    if (directInvoices.length > 0) {
      for (const invoice of directInvoices) {
        try {
          const result = await addInvoiceToAirtable(invoice);
          if (result) totalInvoices++;
        } catch (error) {
          console.error(`Error adding direct invoice to Airtable:`, error.message);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`Invoice sync completed. Synced ${totalInvoices} invoices to Airtable.`);
    
    if (totalInvoices === 0) {
      console.log('No invoices were found. This could be because:');
      console.log('1. There are genuinely no invoices in the system yet');
      console.log('2. The current user credentials may not have access to invoice data');
      console.log('3. The invoice data may be stored in a different location in the API');
    }
  } catch (error) {
    console.error('Error syncing invoices:', error.message);
  }
}

/**
 * Prioritize jobs for invoice checking based on their status and other factors
 */
function prioritizeJobsForInvoiceChecking(jobs) {
  // If there aren't many jobs, just check them all
  if (jobs.length <= 20) return jobs;
  
  // Log all status values we find
  const statusValues = new Set();
  const jobTypes = new Set();
  
  jobs.forEach(job => {
    const status = job.job_status || job.status_name || job.status || '';
    const type = job.job_type_name || '';
    if (status) statusValues.add(status);
    if (type) jobTypes.add(type);
  });
  
  console.log(`All status values found: ${Array.from(statusValues).join(', ')}`);
  console.log(`All job types found: ${Array.from(jobTypes).join(', ')}`);
  
  // Define keywords that might indicate a job has invoices
  const invoiceKeywords = ['invoice', 'payment', 'paid', 'complete', 'bill'];
  
  // Score each job based on likelihood of having invoices
  const scoredJobs = jobs.map(job => {
    const status = (job.job_status || job.status_name || job.status || '').toLowerCase();
    const type = (job.job_type_name || '').toLowerCase();
    const description = (job.brief_description || '').toLowerCase();
    
    let score = 0;
    
    // Check status
    if (status.includes('invoice')) score += 10;
    if (status.includes('paid')) score += 8;
    if (status.includes('complete')) score += 6;
    if (status.includes('active')) score += 3; // Active jobs might have partial invoices
    
    // Check job type - prioritize service-type jobs that typically get invoiced
    if (type.includes('service')) score += 5;
    if (type.includes('repair')) score += 5;
    if (type.includes('maintenance')) score += 4;
    if (!type.includes('quote')) score += 2; // Quotes often don't have invoices yet
    
    // Check description for keywords
    for (const keyword of invoiceKeywords) {
      if (description.includes(keyword)) score += 3;
    }
    
    // Boost newer jobs slightly (they're more likely to be current)
    if (job.created_at) {
      const age = new Date() - new Date(job.created_at);
      const ageInDays = age / (1000 * 60 * 60 * 24);
      if (ageInDays < 30) score += 2; // Boost jobs from last 30 days
    }
    
    return { job, score };
  });
  
  // Sort by score (descending)
  scoredJobs.sort((a, b) => b.score - a.score);
  
  // Take top 50 highest scoring jobs
  const prioritizedJobs = scoredJobs.slice(0, 50).map(item => item.job);
  
  return prioritizedJobs;
}

/**
 * Simplified version of processJobForInvoices that only uses methods that work
 * and avoids unnecessary API calls to endpoints that return 404
 */
async function processJobForInvoicesSimplified(job, canAccessFinancials = false) {
  const jobId = job.id || job.job_id;
  const internalJobId = job.internal_id || job.internal_job_id || '';
  
  if (!jobId && !internalJobId) {
    console.log('Job has no identifiers, skipping');
    return [];
  }
  
  console.log(`Looking for invoices for job ${internalJobId || jobId}...`);
  
  const invoicesFound = [];
  
  // Check if the job has invoices field directly (from status board data)
  if (job.invoices && Array.isArray(job.invoices) && job.invoices.length > 0) {
    console.log(`Found ${job.invoices.length} invoices directly in job data!`);
    
    // Process each invoice
    for (const invoice of job.invoices) {
      try {
        const result = await addInvoiceToAirtable(invoice, job);
        if (result) invoicesFound.push(result);
      } catch (error) {
        console.error(`Error processing direct invoice:`, error.message);
      }
    }
    
    // If we found invoices directly, return them
    if (invoicesFound.length > 0) return invoicesFound;
  }
  
  // Method 1: Try the extended_json endpoint - this one seems to work
  try {
    // Skip if we already have this data (job came from this endpoint)
    if (!job.already_from_extended_json) {
      const jobData = await fetchJobWithInvoices(jobId);
      if (jobData && jobData.result === 'success') {
        console.log(`Successfully fetched extended data for job ${internalJobId || jobId}`);
        
        // Save the first job data for reference - no need to save all
        if (!global.savedFirstJobData) {
          global.savedFirstJobData = true;
          try {
            const outputDir = path.join(__dirname, 'output');
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(
              path.join(outputDir, `extended-job-sample.json`), 
              JSON.stringify(jobData, null, 2)
            );
          } catch (err) {
            // Ignore errors saving sample file
          }
        }
        
        // Look for invoices in the response - check all possible locations
        let invoices = [];
        
        // Try different possible locations for invoices in the response
        if (jobData.value?.invoices && Array.isArray(jobData.value.invoices)) {
          invoices = jobData.value.invoices;
        } else if (jobData.value?.jobCard?.invoices && Array.isArray(jobData.value.jobCard.invoices)) {
          invoices = jobData.value.jobCard.invoices;
        } else if (jobData.value?.jobCard?.job?.invoices && Array.isArray(jobData.value.jobCard.job.invoices)) {
          invoices = jobData.value.jobCard.job.invoices;
        }
        
        if (invoices.length > 0) {
          console.log(`Found ${invoices.length} invoices in extended data!`);
          
          // Process each invoice
          for (const invoice of invoices) {
            const result = await addInvoiceToAirtable(invoice, jobData.value?.jobCard?.job || job);
            if (result) invoicesFound.push(result);
          }
        } else {
          console.log('No invoices found in extended data');
        }
      }
    }
  } catch (error) {
    console.error(`Error with extended_json endpoint for job ${jobId}:`, error.message);
  }
  
  // If we found invoices with first method, no need to try others
  if (invoicesFound.length > 0) return invoicesFound;
  
  // Method 2: Try job_card endpoint - this one seems to work
  try {
    const jobCardData = await fetchJobCardWithInvoices(jobId);
    if (jobCardData && jobCardData.result === 'success') {
      console.log(`Successfully fetched job card data for job ${internalJobId || jobId}`);
      
      // Look for invoices in the response - check all possible locations
      let invoices = [];
      
      // Try different possible locations for invoices in the response
      if (jobCardData.value?.invoices && Array.isArray(jobCardData.value.invoices)) {
        invoices = jobCardData.value.invoices;
      } else if (jobCardData.value?.job?.invoices && Array.isArray(jobCardData.value.job.invoices)) {
        invoices = jobCardData.value.job.invoices;
      }
      
      if (invoices.length > 0) {
        console.log(`Found ${invoices.length} invoices in job card data!`);
        
        // Process each invoice
        for (const invoice of invoices) {
          const result = await addInvoiceToAirtable(invoice, jobCardData.value?.job || job);
          if (result) invoicesFound.push(result);
        }
      } else {
        console.log('No invoices found in job card data');
      }
    }
  } catch (error) {
    console.error(`Error with job_card endpoint for job ${jobId}:`, error.message);
  }
  
  // If we found invoices with second method, no need to try the third
  if (invoicesFound.length > 0) return invoicesFound;
  
  // Method 3: Try financial invoices - only if we know we can access the endpoint
  if (canAccessFinancials) {
    try {
      // Try the direct financials endpoint for this job
      const financialData = await fetchFinancialInvoices(jobId);
      if (financialData && (financialData.data || financialData.invoices)) {
        console.log(`Successfully fetched financial data for job ${internalJobId || jobId}`);
        
        // Look for invoices in the response
        const invoices = financialData.data || financialData.invoices || [];
        if (invoices.length > 0) {
          console.log(`Found ${invoices.length} invoices in financial data!`);
          
          // Process each invoice
          for (const invoice of invoices) {
            const result = await addInvoiceToAirtable(invoice, job);
            if (result) invoicesFound.push(result);
          }
        } else {
          console.log('No invoices found in financial data');
        }
      }
    } catch (error) {
      // We expect this might fail with 404, so don't log the full error
      console.log(`No financial invoices available for job ${internalJobId || jobId}`);
    }
  }
  
  if (invoicesFound.length === 0) {
    console.log(`No invoices found for job ${internalJobId || jobId} after trying all methods`);
  }
  
  return invoicesFound;
}

// Run the invoice sync if the script is executed directly
if (require.main === module) {
  syncFergusInvoicesToAirtable().catch(console.error);
}

// Export functions
module.exports = {
  syncFergusInvoicesToAirtable,
  fetchJobsWithInvoices,
  fetchCompletedJobs,
  fetchInvoicesDirectly,
  processJobForInvoices,
  addInvoiceToAirtable
}; 