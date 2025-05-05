const { fetchJobWithInvoices, syncJobInvoicesToAirtable } = require('./direct-fergus-api');

// Test parameters - these are from the curl command and Postman screenshots
const INTERNAL_JOB_ID = '27432';
const JOB_ID = '17721721';

// Optional page parameter - uncomment if needed
// const pageParam = 'invoicing/4f247ece-eb59-4754-9bd4-138b86c141af';

async function main() {
  try {
    // Test both approaches to see which one works
    console.log('===== APPROACH 1: Using internal_job_id =====');
    console.log(`Testing job invoice fetch for internal job ID: ${INTERNAL_JOB_ID}`);
    
    const jobData1 = await fetchJobWithInvoices(INTERNAL_JOB_ID);
    
    if (jobData1 && jobData1.result === 'success') {
      console.log('✅ Successfully fetched job data using internal_job_id');
      printJobInfo(jobData1);
    } else {
      console.log('❌ Failed to fetch job data using internal_job_id');
    }
    
    console.log('\n===== APPROACH 2: Using job_id =====');
    console.log(`Testing job invoice fetch for job ID: ${JOB_ID}`);
    
    const jobData2 = await fetchJobWithInvoices(JOB_ID, { useJobId: true });
    
    if (jobData2 && jobData2.result === 'success') {
      console.log('✅ Successfully fetched job data using job_id');
      printJobInfo(jobData2);
    } else {
      console.log('❌ Failed to fetch job data using job_id');
    }
    
    // Option 2: Uncomment to also sync to Airtable
    // console.log('\nSyncing invoices to Airtable...');
    // await syncJobInvoicesToAirtable(JOB_ID);
    // console.log('Sync complete');
    
  } catch (error) {
    console.error('Error in test:', error.message);
  }
}

// Helper function to print job information
function printJobInfo(jobData) {
  // Extract the job info from the response structure
  const jobInfo = jobData.value?.jobCard?.job;
  
  if (!jobInfo) {
    console.log('Job data structure is not as expected');
    console.log('Raw data:', JSON.stringify(jobData).substring(0, 200) + '...');
    return;
  }
  
  console.log('\nJob Information:');
  console.log(`  Internal ID: ${jobInfo.internal_id || jobInfo.internal_job_id || 'N/A'}`);
  console.log(`  Job ID: ${jobInfo.job_id || jobInfo.id || 'N/A'}`);
  console.log(`  Status: ${jobInfo.status_name || 'N/A'}`);
  console.log(`  Description: ${jobInfo.brief_description || 'N/A'}`);
  
  // Check for invoices
  const invoices = jobData.value?.invoices || [];
  
  if (invoices.length > 0) {
    console.log(`\nFound ${invoices.length} invoices:`);
    invoices.forEach((invoice, index) => {
      console.log(`\nInvoice ${index + 1}:`);
      console.log(`  Number: ${invoice.number || 'N/A'}`);
      console.log(`  Date: ${invoice.date || 'N/A'}`);
      console.log(`  Status: ${invoice.status || 'N/A'}`);
      console.log(`  Total: $${invoice.total || 0}`);
    });
  } else {
    console.log('\nNo invoices found in the job data');
  }
}

// Run the test script
main().catch(console.error); 