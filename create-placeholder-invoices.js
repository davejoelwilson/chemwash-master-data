/**
 * create-placeholder-invoices.js
 * ==============================
 * 
 * Creates placeholder invoices for specified jobs or for all jobs with a given status.
 * This is useful when the direct fetching of invoices is not working.
 */

// Import required libraries
require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Initialize Airtable with API key from .env file
const airtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

/**
 * Get Fergus cookies directly from direct-fergus-api.js
 */
const getFergusCookies = async () => {
  try {
    // Read the direct-fergus-api.js file
    const apiFilePath = path.join(__dirname, 'direct-fergus-api.js');
    const apiFileContent = await fs.readFile(apiFilePath, 'utf-8');
    
    // Extract the cookies using regex
    const cookieRegex = /const FERGUS_COOKIES = `([^`]+)`/;
    const match = apiFileContent.match(cookieRegex);
    
    if (match && match[1]) {
      return match[1];
    } else {
      throw new Error('Could not extract Fergus cookies from direct-fergus-api.js');
    }
  } catch (error) {
    console.error('Error getting Fergus cookies:', error.message);
    throw error;
  }
};

/**
 * Default headers for Fergus API requests
 */
const getDefaultHeaders = (cookies) => ({
  'Cookie': cookies,
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
 * Search for a job by its NW number using the search_as_model endpoint
 */
async function searchJobByNWNumber(nwNumber, cookies) {
  try {
    // Make sure the NW number is properly formatted (e.g., "nw-29613")
    const formattedNwNumber = nwNumber.toLowerCase().startsWith('nw-') 
      ? nwNumber.toLowerCase() 
      : `nw-${nwNumber.replace(/^NW-/i, '')}`;
    
    console.log(`Searching for job with NW number: ${formattedNwNumber}`);
    
    // Use the search_as_model endpoint to find the job
    const url = 'https://app.fergus.com/api/v2/search_as_model';
    const response = await axios.post(url, {
      search_term: formattedNwNumber,
      result_type: ["job"]
    }, {
      headers: getDefaultHeaders(cookies)
    });
    
    // Check if job was found
    if (response.data.result === 'success' && 
        response.data.value && 
        response.data.value.job && 
        response.data.value.job.length > 0) {
      console.log(`Found job with NW number ${formattedNwNumber}`);
      
      // Save the job data to a file for debugging
      await fs.writeFile(
        path.join(__dirname, `job-search-${formattedNwNumber}.json`),
        JSON.stringify(response.data, null, 2)
      );
      
      // Return the first match
      return response.data.value.job[0];
    }
    
    console.log(`No job found with NW number ${formattedNwNumber}`);
    return null;
  } catch (error) {
    console.error(`Error searching for job ${nwNumber}:`, error.message);
    if (error.response) {
      console.error('API response status:', error.response.status);
      console.error('API response data:', JSON.stringify(error.response.data).substring(0, 500) + '...');
    }
    return null;
  }
}

/**
 * Create placeholder invoices from existing Airtable invoices that don't have Fergus job data
 */
async function createPlaceholdersFromAirtable() {
  try {
    console.log('Looking up Fergus job details for existing Airtable invoices...');
    
    // Get Fergus cookies for authentication
    const cookies = await getFergusCookies();
    
    // Get all existing invoices from Airtable
    const invoices = await airtableBase('Invoices')
      .select({
        fields: ['Invoice Number', 'Fergus Job Number', 'Invoice Status', 'Amount Paid', 'Total']
      })
      .all();
    
    console.log(`Found ${invoices.length} invoices in Airtable`);
    
    // Find invoices with Fergus Job Number but without additional job data
    const invoicesToProcess = invoices.filter(record => {
      const fields = record.fields;
      return fields['Fergus Job Number'] && 
             (!fields['Description'] || !fields['Customer'] || !fields['Site Address']);
    });
    
    console.log(`Found ${invoicesToProcess.length} invoices that need additional job details`);
    
    // Process each invoice in sequence
    for (const record of invoicesToProcess) {
      try {
        const nwNumber = record.fields['Fergus Job Number'];
        
        // Lookup job details from Fergus
        const jobDetails = await searchJobByNWNumber(nwNumber, cookies);
        
        if (jobDetails) {
          // Prepare update with job details
          const updateFields = {
            'Customer': jobDetails.customer_name || jobDetails.customer_full_name || '',
            'Description': jobDetails.brief_description || '',
            'Site Address': jobDetails.site_visit_title || 
                           (typeof jobDetails.site_address === 'string' ? jobDetails.site_address : 'Unknown'),
            'Job Status': jobDetails.job_status_name || ''
          };
          
          // Update the invoice record
          await airtableBase('Invoices').update(record.id, updateFields);
          console.log(`Updated invoice for job ${nwNumber} with details`);
        } else {
          console.log(`Could not find job details for ${nwNumber}`);
        }
        
        // Add delay to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing invoice:`, error.message);
      }
    }
    
    console.log(`Completed processing ${invoicesToProcess.length} invoices`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Get existing invoices from Airtable
 */
async function getExistingInvoices() {
  try {
    // Get all invoices from the Invoices table
    const records = await airtableBase('Invoices')
      .select({
        fields: ['Invoice Number', 'Fergus Job Number', 'Invoice Status', 'Total', 'Amount Paid']
      })
      .all();
    
    console.log(`Found ${records.length} invoices in Airtable.`);
    
    // Map of job numbers to invoice numbers
    const jobToInvoiceMap = new Map();
    const invoiceNumbers = new Set();
    
    records.forEach(record => {
      const fields = record.fields;
      if (fields['Fergus Job Number']) {
        jobToInvoiceMap.set(fields['Fergus Job Number'], fields['Invoice Number']);
      }
      if (fields['Invoice Number']) {
        invoiceNumbers.add(fields['Invoice Number']);
      }
    });
    
    return {
      records,
      jobToInvoiceMap,
      invoiceNumbers
    };
  } catch (error) {
    console.error('Error getting existing invoices:', error.message);
    return {
      records: [],
      jobToInvoiceMap: new Map(),
      invoiceNumbers: new Set()
    };
  }
}

/**
 * Fetch active jobs with specific statuses
 */
async function fetchActiveJobsWithStatus(statusFilters, pageSize = 20, maxPages = 5) {
  console.log(`Fetching active jobs with statuses: ${statusFilters.join(', ')}...`);
  const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
  
  // Get cookies for authentication
  const cookies = await getFergusCookies();
  
  let allJobs = [];
  let currentPage = 1;
  
  try {
    // Fetch jobs using pagination
    while (currentPage <= maxPages) {
      console.log(`Fetching active jobs page ${currentPage}...`);
      
      const response = await axios.post(url, {
        page: currentPage,
        page_size: pageSize,
        filter: "",
        selected_group_ids: [],
        selected_employee_ids: []
      }, {
        headers: getDefaultHeaders(cookies)
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
    
    console.log(`Fetched a total of ${allJobs.length} jobs`);
    
    // Log a sample of statuses to understand what we're working with
    const statusCounts = {};
    allJobs.forEach(job => {
      const status = job.job_status || job.status_name || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('Job status distribution:');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`  ${status}: ${count} jobs`);
      });
    
    // Filter jobs by the provided statuses
    const filteredJobs = statusFilters.length > 0 
      ? allJobs.filter(job => {
        const status = (job.job_status || job.status_name || '').toLowerCase();
        return statusFilters.some(filter => status.includes(filter.toLowerCase()));
      })
      : allJobs;
    
    console.log(`Found ${filteredJobs.length} jobs matching the specified statuses`);
    
    // If no filtered jobs, take most recent jobs
    if (filteredJobs.length === 0 && allJobs.length > 0) {
      console.log('No jobs with specified statuses found. Taking 20 most recent jobs.');
      
      // Sort by created date (newest first) and take 20
      const recentJobs = [...allJobs]
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        })
        .slice(0, 20);
      
      console.log(`Selected ${recentJobs.length} most recent jobs`);
      return recentJobs;
    }
    
    return filteredJobs;
  } catch (error) {
    console.error('Error fetching jobs:', error.message);
    if (error.response) {
      console.error('API response status:', error.response.status);
      console.error('API response data:', JSON.stringify(error.response.data).substring(0, 500) + '...');
    }
    throw error;
  }
}

/**
 * Create placeholder invoices for jobs
 */
async function createPlaceholderInvoices(jobs, options = {}) {
  const {
    dueInDays = 30,     // Days until payment is due
    startAmount = 0.01, // Starting amount for placeholder invoices
    status = 'Ready to invoice'  // Status to assign to placeholder invoices
  } = options;
  
  console.log(`Creating placeholder invoices for ${jobs.length} jobs...`);
  
  // Get existing invoices 
  const { jobToInvoiceMap, invoiceNumbers } = await getExistingInvoices();
  
  console.log(`Found ${jobToInvoiceMap.size} jobs with existing invoices`);
  
  // Create placeholder invoices for each job
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + dueInDays);
  
  const createdInvoices = [];
  const errors = [];
  
  for (const job of jobs) {
    try {
      const jobId = job.internal_id || job.internal_job_id || job.public_internal_job_id;
      const customerName = job.customer_full_name || job.customer_name || 'Unknown Customer';
      
      // Skip if job already has an invoice
      if (jobToInvoiceMap.has(jobId)) {
        console.log(`Job ${jobId} already has invoice ${jobToInvoiceMap.get(jobId)}, skipping`);
        continue;
      }
      
      // Generate a unique invoice number
      let invoiceNumber;
      do {
        invoiceNumber = `WO-${Date.now()}`;
        // Wait a millisecond to ensure uniqueness
        await new Promise(resolve => setTimeout(resolve, 1));
      } while (invoiceNumbers.has(invoiceNumber));
      
      // Create invoice record
      const record = {
        'Invoice Number': invoiceNumber,
        'Invoice Date': today.toISOString().split('T')[0],
        'Due Date': dueDate.toISOString().split('T')[0],
        'Total': startAmount,
        'Amount Paid': 0,
        'Invoice Status': status,
        'Fergus Job Number': jobId,
        'Customer': customerName,
        'Description': job.brief_description || '',
        'Site Address': typeof job.site_address === 'string' ? job.site_address : (job.site_visit_title || 'Unknown')
      };
      
      // Create in Airtable
      const result = await airtableBase('Invoices').create(record);
      
      console.log(`Created placeholder invoice ${invoiceNumber} for job ${jobId}`);
      createdInvoices.push({ 
        invoiceNumber, 
        jobId, 
        customer: customerName, 
        recordId: result.id 
      });
      
      // Add delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error creating invoice for job:`, error.message);
      errors.push({ jobId: job.internal_id || job.internal_job_id, error: error.message });
    }
  }
  
  // Save results
  const results = {
    createdInvoices,
    errors,
    summary: {
      totalJobs: jobs.length,
      createdInvoices: createdInvoices.length,
      errors: errors.length,
      jobsWithExistingInvoices: jobToInvoiceMap.size
    }
  };
  
  await fs.writeFile(
    path.join(__dirname, 'placeholder-invoices-results.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`Created ${createdInvoices.length} placeholder invoices`);
  console.log(`Encountered ${errors.length} errors`);
  return results;
}

/**
 * Main function to run the script with command line arguments
 */
async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    // Check if we should process existing Airtable invoices
    if (args.includes('--update-existing')) {
      await createPlaceholdersFromAirtable();
      return;
    }
    
    // Filter out flags
    const statusFilters = args.filter(arg => !arg.startsWith('--'));
    const filterList = statusFilters.length > 0 ? statusFilters : ['Quote Sent', 'Active'];
    
    console.log(`Will create placeholder invoices for jobs with statuses: ${filterList.join(', ')}`);
    
    // Fetch jobs with the specified statuses
    const jobs = await fetchActiveJobsWithStatus(filterList);
    
    // Limit to 10 jobs in one run for safety (can change this if needed)
    const jobsToProcess = jobs.slice(0, 10);
    
    if (jobsToProcess.length === 0) {
      console.log('No jobs found to create placeholder invoices for');
      return;
    }
    
    console.log(`Processing ${jobsToProcess.length} out of ${jobs.length} jobs`);
    
    // Create placeholder invoices
    const result = await createPlaceholderInvoices(jobsToProcess, {
      dueInDays: 30,
      startAmount: 0.01,
      status: 'Ready to invoice'
    });
    
    console.log('Completed successfully!');
    console.log(`Created ${result.summary.createdInvoices} placeholder invoices`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if directly called
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  fetchActiveJobsWithStatus, 
  createPlaceholderInvoices,
  searchJobByNWNumber,
  createPlaceholdersFromAirtable
}; 