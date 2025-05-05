/**
 * create-airtable-row.js
 * 
 * This script creates a new row in Airtable with job and contact information from Fergus.
 * Usage: node create-airtable-row.js JOB_NUMBER
 * Example: node create-airtable-row.js NW-21418
 */

require('dotenv').config({ path: '../.env' });
const Airtable = require('airtable');
const axios = require('axios');

// Configure Airtable
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Master List Sonya';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Error: Missing Airtable credentials in .env file');
  process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const table = base(AIRTABLE_TABLE_NAME);

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
 * Fetch job data from Fergus
 */
async function fetchJobData(jobId) {
  try {
    // Remove the "NW-" prefix if present to get the numeric ID for Fergus
    const numericId = jobId.replace('NW-', '');
    const url = 'https://app.fergus.com/api/v2/jobs/extended_json';
    
    console.log(`Fetching job ${numericId} with invoices...`);
    
    // First try with job_id approach
    let response = await axios.get(url, { 
      params: {
        internal_job_id: '', 
        job_id: numericId,
        page: ''
      },
      headers: getDefaultHeaders()
    }).catch(() => null);
    
    // If that fails, try using internal_job_id
    if (!response || !response.data || response.data.result !== 'success') {
      response = await axios.get(url, { 
        params: {
          internal_job_id: numericId,
          job_id: '',
          page: ''
        },
        headers: getDefaultHeaders()
      });
    }
    
    if (!response || !response.data || response.data.result !== 'success') {
      console.error(`Could not fetch data for job ${jobId}`);
      return null;
    }
    
    // Extract the job data
    const jobData = response.data.value?.jobCard?.job;
    
    // Add additional data
    if (jobData) {
      // Make sure site_address is included
      if (!jobData.site_address && response.data.value?.siteContact) {
        jobData.site_address = response.data.value.siteContact;
      }
      
      // Make sure invoices are included
      if (!jobData.invoices && response.data.value?.invoices) {
        jobData.invoices = response.data.value.invoices;
      }
    }
    
    return jobData;
  } catch (error) {
    console.error(`Error fetching job data for ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Extract contact information from job data
 */
function extractContactInfo(jobData, originalJobId) {
  const contactInfo = {};
  
  // Job ID - use the original job ID to maintain consistency
  contactInfo.jobId = originalJobId;
  
  // Site Contact
  if (typeof jobData.site_address === 'object' && jobData.site_address) {
    const firstName = jobData.site_address.first_name || '';
    const lastName = jobData.site_address.last_name || '';
    contactInfo.siteContactName = `${firstName} ${lastName}`.trim();
    
    if (Array.isArray(jobData.site_address.contact_items)) {
      const emails = jobData.site_address.contact_items
        .filter(item => item.contact_type === 'email')
        .map(item => item.contact_val);
      
      const phones = jobData.site_address.contact_items
        .filter(item => item.contact_type === 'phone')
        .map(item => item.contact_val);
      
      contactInfo.siteContactEmail = emails.length > 0 ? emails[0] : '';
      contactInfo.siteContactPhone = phones.length > 0 ? phones[0] : '';
    }
  }
  
  // Main Contact
  if (jobData.main_contact) {
    const firstName = jobData.main_contact.first_name || '';
    const lastName = jobData.main_contact.last_name || '';
    contactInfo.mainContactName = `${firstName} ${lastName}`.trim();
    
    if (Array.isArray(jobData.main_contact.contact_items)) {
      const emails = jobData.main_contact.contact_items
        .filter(item => item.contact_type === 'email')
        .map(item => item.contact_val);
      
      const phones = jobData.main_contact.contact_items
        .filter(item => item.contact_type === 'phone' || item.contact_type === 'phone_mob')
        .map(item => item.contact_val);
      
      contactInfo.mainContactEmail = emails.length > 0 ? emails[0] : '';
      contactInfo.mainContactPhone = phones.length > 0 ? phones[0] : '';
    }
  }
  
  // Billing Contact
  if (jobData.billing_contact) {
    const firstName = jobData.billing_contact.first_name || '';
    const lastName = jobData.billing_contact.last_name || '';
    contactInfo.billingContactName = `${firstName} ${lastName}`.trim();
    
    if (Array.isArray(jobData.billing_contact.contact_items)) {
      const emails = jobData.billing_contact.contact_items
        .filter(item => item.contact_type === 'email')
        .map(item => item.contact_val);
      
      const phones = jobData.billing_contact.contact_items
        .filter(item => item.contact_type === 'phone' || item.contact_type === 'phone_mob')
        .map(item => item.contact_val);
      
      contactInfo.billingContactEmail = emails.length > 0 ? emails[0] : '';
      contactInfo.billingContactPhone = phones.length > 0 ? phones[0] : '';
    }
  }
  
  // Invoice Info (if available)
  if (jobData.invoices && jobData.invoices.length > 0) {
    const invoice = jobData.invoices[0]; // Get the first invoice
    contactInfo.invoiceNumber = invoice.invoice_number || '';
    contactInfo.invoiceStatus = invoice.status || '';
    contactInfo.invoiceTotal = invoice.total || 0;
  }
  
  return contactInfo;
}

/**
 * Create new record in Airtable
 */
async function createAirtableRecord(contactInfo) {
  try {
    console.log(`Creating new Airtable record for job ${contactInfo.jobId}...`);
    
    return new Promise((resolve, reject) => {
      // Map contact info to Airtable field names
      const fields = {
        'Job': contactInfo.jobId,
        'Site Contact Name': contactInfo.siteContactName,
        'Site Contact Email': contactInfo.siteContactEmail,
        'Site Contact Phone': contactInfo.siteContactPhone,
        'Main Contact Name': contactInfo.mainContactName,
        'Main Contact Email': contactInfo.mainContactEmail,
        'Main Contact Phone': contactInfo.mainContactPhone,
        'Billing Contact Name': contactInfo.billingContactName,
        'Billing Contact Email': contactInfo.billingContactEmail,
        'Billing Contact Phone': contactInfo.billingContactPhone,
      };
      
      // Add invoice fields if available
      if (contactInfo.invoiceNumber) {
        fields['Invoice'] = contactInfo.invoiceNumber;
      }
      
      // Only include fields that have values
      const cleanFields = Object.entries(fields)
        .filter(([key, value]) => value !== undefined && value !== null && value !== '')
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      
      table.create(cleanFields, (err, record) => {
        if (err) {
          console.error('Error creating record:', err);
          reject(err);
          return;
        }
        
        console.log(`✅ Successfully created Airtable record for ${contactInfo.jobId}`);
        resolve(record);
      });
    });
  } catch (error) {
    console.error(`Error creating Airtable record: ${error.message}`);
    return null;
  }
}

/**
 * Main function to process a job
 */
async function processJob(jobId) {
  try {
    console.log(`Processing job: ${jobId}`);
    
    // Step 1: Fetch job data from Fergus
    const jobData = await fetchJobData(jobId);
    if (!jobData) {
      console.error(`❌ Failed to fetch data for job ${jobId}`);
      return false;
    }
    
    // Step 2: Extract contact information
    const contactInfo = extractContactInfo(jobData, jobId);
    console.log('Extracted contact info:');
    console.log(JSON.stringify(contactInfo, null, 2));
    
    // Step 3: Create a new record in Airtable
    const newRecord = await createAirtableRecord(contactInfo);
    if (!newRecord) {
      console.error(`❌ Failed to create Airtable record for job ${jobId}`);
      return false;
    }
    
    console.log(`✅ Successfully processed job ${jobId}`);
    return true;
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error.message);
    return false;
  }
}

// Main execution
const jobId = process.argv[2];

if (!jobId) {
  console.log('Please provide a job ID');
  console.log('Usage: node create-airtable-row.js NW-21255');
  process.exit(1);
}

// Run the function
processJob(jobId)
  .then(success => {
    if (success) {
      console.log('✅ Process completed successfully');
    } else {
      console.log('❌ Process completed with errors');
    }
  })
  .catch(err => console.error('Error in main process:', err)); 