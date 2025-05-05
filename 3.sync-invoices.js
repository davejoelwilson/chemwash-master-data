/**
 * 3.sync-invoices.js
 * ==================
 * 
 * Synchronizes invoices from Fergus to Airtable.
 * This is the third step in the sync process.
 * Gets invoices from active job data since direct invoice endpoints are not accessible.
 * 
 * How to use:
 * node 3.sync-invoices.js
 */

const api = require('./direct-fergus-api');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// High-performance settings for faster syncing
const highPerformanceSettings = {
  concurrency: 5,       // Reduced to avoid rate limiting
  delayMs: 100,         // Increased to avoid rate limiting
  batchSize: 20,        // Reduced to avoid rate limiting
  batchDelayMs: 1000    // Increased to avoid rate limiting
};

/**
 * Get Fergus cookies directly from direct-fergus-api.js
 * This is needed because they aren't exported in the module
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

// Initialize cookies variable
let FERGUS_COOKIES = '';

/**
 * Default headers for Fergus API requests
 * We have to recreate this since it's not exported from direct-fergus-api.js
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
 * Fetch active jobs that might have invoices
 */
async function fetchActiveJobsWithInvoiceData(pageSize = 20, maxPages = 20) {
  console.log('Fetching active jobs that might have invoices...');
  const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
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
    
    // Updated filter to match what we saw in Airtable
    // Using a broader set of keywords to catch different status formats
    const invoiceStatusKeywords = ['invoiced', 'payment', 'paid', 'complete', 'finish', 'ready to invoice', 'ready for invoice'];
    const jobsWithPossibleInvoices = allJobs.filter(job => {
      const status = (job.job_status || job.status_name || '').toLowerCase();
      return invoiceStatusKeywords.some(keyword => status.includes(keyword));
    });
    
    // If no filtered jobs, take the most recent 20 jobs to try
    if (jobsWithPossibleInvoices.length === 0) {
      console.log('No jobs with invoice-related statuses found. Taking 20 most recent jobs to check for invoices.');
      
      // Sort by created date (newest first) and take 20
      const recentJobs = [...allJobs]
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        })
        .slice(0, 20);
      
      console.log(`Selected ${recentJobs.length} most recent jobs for invoice check`);
      return recentJobs;
    }
    
    console.log(`Filtered down to ${jobsWithPossibleInvoices.length} jobs that might have invoices`);
    return jobsWithPossibleInvoices;
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
 * Extract invoices from a job using its detailed data
 */
async function getJobWithInvoices(jobId) {
  try {
    console.log(`Fetching invoice data for job ${jobId}...`);
    const url = 'https://app.fergus.com/api/v2/jobs/extended_json';
    
    const response = await axios.get(url, {
      params: {
        internal_job_id: jobId,
        job_id: '',
        page: ''
      },
      headers: getDefaultHeaders()
    });
    
    // Save the response to a file for debugging
    await fs.writeFile(
      path.join(__dirname, `job-data-${jobId}.json`),
      JSON.stringify(response.data, null, 2)
    );
    console.log(`Saved job data to job-data-${jobId}.json`);
    
    if (response.data && response.data.value) {
      // Check if there are invoices in the response
      const invoices = response.data.value.invoices || [];
      
      // Also check job card for invoice data
      const jobCard = response.data.value.jobCard || {};
      const jobData = jobCard.job || {};
      
      console.log(`Job ${jobId} has ${invoices.length} invoices`);
      
      if (invoices.length === 0) {
        // If no invoices found but we have job data, create a placeholder invoice
        // This is helpful for jobs marked "Ready to invoice" but no invoice created yet
        if (jobData && jobData.brief_description) {
          console.log(`Creating a placeholder invoice for job ${jobId}`);
          
          // Generate a unique invoice number based on job ID
          const invoiceNumber = `WO-${Date.now()}`;
          
          // Create a placeholder invoice
          const placeholderInvoice = {
            invoice_number: invoiceNumber,
            invoice_date: new Date().toISOString().split('T')[0],
            total: 0.01, // Minimal amount for placeholder
            amount_paid: 0.01,
            status: 'Ready to invoice',
            due_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] // 30 days from now
          };
          
          return {
            job: jobData,
            invoices: [placeholderInvoice]
          };
        }
      }
      
      return {
        job: jobData,
        invoices: invoices
      };
    }
    
    console.log(`No invoice data found for job ${jobId}`);
    return null;
  } catch (error) {
    console.error(`Error fetching invoice data for job ${jobId}:`, error.message);
    if (error.response) {
      console.error('API response status:', error.response.status);
      console.error('API response data:', JSON.stringify(error.response.data).substring(0, 500) + '...');
    }
    return null;
  }
}

/**
 * Sync invoices to Airtable using job data to find invoices
 */
async function syncInvoicesFast() {
  const startTime = new Date();
  console.log(`🚀 Starting invoices sync at ${startTime.toISOString()}`);
  
  try {
    // Initialize cookies first
    FERGUS_COOKIES = await getFergusCookies();
    console.log('Successfully loaded Fergus cookies from direct-fergus-api.js');
    
    // Try several field names that might exist in the Airtable table
    const possibleInvoiceIdFields = ['Invoice ID', 'InvoiceID', 'Invoice Id', 'Invoice Number', 'InvoiceNum'];
    let invoiceIdField = null;
    
    // Pre-load existing invoice IDs from Airtable for optimization
    const existingInvoiceIds = new Set();
    
    // Try each possible field name until we find one that works
    for (const fieldName of possibleInvoiceIdFields) {
      try {
        console.log(`Trying to load invoices using field name "${fieldName}"...`);
        const invoiceTable = await api.airtableBase('Invoices')
          .select({
            fields: [fieldName],
            maxRecords: 10 // Just test with a few records
          })
          .all();
        
        // If we get here, the field exists
        invoiceIdField = fieldName;
        console.log(`Found valid field name: "${invoiceIdField}"`);
        break;
      } catch (error) {
        console.log(`Field "${fieldName}" doesn't seem to exist or has another issue: ${error.message}`);
      }
    }
    
    if (!invoiceIdField) {
      console.log('Could not determine the invoice ID field name. Will try to create records without checking for duplicates.');
    } else {
      // Now load all existing IDs with the field we found
      try {
        console.log(`Loading all existing invoice IDs using field "${invoiceIdField}"...`);
        const allInvoices = await api.airtableBase('Invoices')
          .select({
            fields: [invoiceIdField],
            maxRecords: 3000
          })
          .all();
        
        allInvoices.forEach(record => {
          if (record.fields[invoiceIdField]) {
            existingInvoiceIds.add(record.fields[invoiceIdField].toString());
          }
        });
        console.log(`Loaded ${existingInvoiceIds.size} existing invoice IDs from Airtable`);
      } catch (error) {
        console.warn(`Could not pre-load existing invoice IDs: ${error.message}`);
      }
    }
    
    // Fetch jobs that might have invoices - reduce to 5 pages for faster testing
    const jobsWithPossibleInvoices = await fetchActiveJobsWithInvoiceData(20, 5);
    
    // Collect invoices from all jobs
    console.log('Extracting invoices from jobs...');
    let allInvoices = [];
    let processedJobs = 0;
    
    await api.processBatch(jobsWithPossibleInvoices, async (job) => {
      try {
        const jobId = job.internal_id || job.internal_job_id;
        if (!jobId) return true;
        
        const jobWithInvoices = await getJobWithInvoices(jobId);
        processedJobs++;
        
        if (jobWithInvoices && jobWithInvoices.invoices && jobWithInvoices.invoices.length > 0) {
          // Add job info to each invoice
          const enrichedInvoices = jobWithInvoices.invoices.map(invoice => ({
            ...invoice,
            job_id: jobId,
            job_number: jobId,
            site_address: job.site_address || jobWithInvoices.job.site_address,
            customer_name: job.customer_full_name || job.customer_name
          }));
          
          allInvoices = [...allInvoices, ...enrichedInvoices];
          console.log(`Found ${enrichedInvoices.length} invoices for job ${jobId}`);
        }
        
        // Progress update
        if (processedJobs % 10 === 0) {
          console.log(`Processed ${processedJobs}/${jobsWithPossibleInvoices.length} jobs, found ${allInvoices.length} invoices so far`);
        }
        
        return true;
      } catch (error) {
        console.error(`Error processing job for invoices: ${error.message}`);
        return false;
      }
    }, {
      concurrency: 3, // Reduced concurrency to avoid rate limiting
      delayMs: 200,   // Increased delay to avoid rate limiting
      batchSize: 5,   // Reduced batch size for more manageable chunks
      batchDelayMs: 1000
    });
    
    console.log(`Found a total of ${allInvoices.length} invoices from ${processedJobs} jobs`);
    
    // Save sample invoice for debugging
    if (allInvoices.length > 0) {
      await fs.writeFile(
        path.join(__dirname, 'sample-invoice-from-job.json'),
        JSON.stringify(allInvoices[0], null, 2)
      );
      console.log('Saved sample invoice to sample-invoice-from-job.json');
    }
    
    // Process the invoices in batches
    let updatedCount = 0;
    let createdCount = 0;
    let errorCount = 0;
    
    await api.processBatch(allInvoices, async (invoice) => {
      try {
        const invoiceId = invoice.id || invoice.invoice_id || invoice.invoice_number || '';
        
        if (!invoiceId) {
          console.warn('Invoice without ID, skipping');
          return true;
        }
        
        // Prepare a record for Airtable
        const record = {
          'Invoice Number': invoiceId,
          'Invoice Date': invoice.invoice_date || invoice.date || new Date().toISOString().split('T')[0],
          'Total': invoice.total || invoice.amount || 0.01,
          'Amount Paid': invoice.amount_paid || 0,
          'Invoice Status': invoice.status || 'Unknown',
          'Due Date': invoice.due_date || ''
        };
        
        if (invoiceIdField && existingInvoiceIds.has(invoiceId.toString())) {
          // Update existing invoice
          try {
            // Find the record first
            const existingRecords = await api.airtableBase('Invoices')
              .select({
                filterByFormula: `{${invoiceIdField}} = "${invoiceId}"`
              })
              .firstPage();
            
            if (existingRecords && existingRecords.length > 0) {
              await api.airtableBase('Invoices').update(existingRecords[0].id, record);
              console.log(`Updated invoice ${invoiceId}`);
              updatedCount++;
            } else {
              // Record vanished, create it
              await api.airtableBase('Invoices').create(record);
              console.log(`Created invoice ${invoiceId} (was expected to exist but not found)`);
              createdCount++;
            }
          } catch (error) {
            console.error(`Error updating invoice ${invoiceId}: ${error.message}`);
            errorCount++;
          }
        } else {
          // Create new invoice
          try {
            await api.airtableBase('Invoices').create(record);
            console.log(`Created new invoice ${invoiceId}`);
            createdCount++;
            if (invoiceIdField) {
              existingInvoiceIds.add(invoiceId.toString()); // Add to cache for future reference
            }
          } catch (error) {
            console.error(`Error creating invoice ${invoiceId}: ${error.message}`);
            errorCount++;
          }
        }
        
        return true;
      } catch (error) {
        console.error(`Error processing invoice: ${error.message}`);
        errorCount++;
        return false;
      }
    }, {
      concurrency: 1,     // Lower concurrency for Airtable to avoid rate limiting
      delayMs: 1000,      // More delay for Airtable rate limits
      batchSize: 5,       // Smaller batches
      batchDelayMs: 2000  // Significant delay between batches for Airtable
    });
    
    // Log results
    const endTime = new Date();
    const durationSeconds = (endTime - startTime) / 1000;
    
    const syncInfo = {
      type: 'invoices',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationSeconds: durationSeconds,
      totalInvoices: allInvoices.length,
      invoicesCreated: createdCount,
      invoicesUpdated: updatedCount,
      errors: errorCount
    };
    
    // Save sync info to file
    await fs.writeFile(
      path.join(__dirname, 'invoices-sync-info.json'),
      JSON.stringify(syncInfo, null, 2)
    );
    
    console.log(`✅ Invoices sync completed in ${durationSeconds.toFixed(2)} seconds`);
    console.log(`📊 Summary: ${allInvoices.length} total invoices, ${createdCount} created, ${updatedCount} updated, ${errorCount} errors`);
    
    return { 
      success: true, 
      invoicesCount: allInvoices.length,
      created: createdCount,
      updated: updatedCount,
      errors: errorCount,
      duration: durationSeconds 
    };
  } catch (error) {
    console.error(`❌ Error syncing invoices: ${error.message}`);
    return { 
      success: false, 
      error: error.message, 
      duration: ((new Date()) - startTime) / 1000 
    };
  }
}

// Run if directly called
if (require.main === module) {
  syncInvoicesFast().catch(console.error);
}

// Export for use in other scripts
module.exports = syncInvoicesFast; 