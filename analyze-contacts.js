const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Use the same cookies from incremental-sync.js
const FERGUS_COOKIES = `_cfuvid=toxe.5PL2tIbfswmuikIcyOf4anaEczzmXQ0LnPfIME-1743668792085-0.0.1.1-604800000; pscd=partner.fergus.com; intercom-device-id-tbx03t1n=194b1a0c-037b-4e2c-afb0-e8afb2bd699a; rpjwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiIiLCJpYXQiOjE3NDM2Njg4MDksImV4cCI6MTgwNjc0MDgwOSwidXNkIjp7ImNvbXBhbnlfZ3VpZCI6IjcwZjA5ZmFmLWNhNGEtNDE2OS04NDU2LTI4ZjYxZDQzOWIwZSIsImVtcGxveWVlX2d1aWQiOiI2NDdmNzM1YS0zOTMxLTQ0ODUtYWRmMy1iMmMxMWM5ZjM1MTEifX0.EGKJ2zgIc54Z1jXttEyUNWMvmZZoRVLJTlqCuiZ77dph3NDFlMb4X3SIaSHdx_kVe3DVkLY26mum-ZAlocvlFTxTI-TDfKs2NfqEvuj-CWVS6FNJHHFbPyQWkTt72X4Ru1jCuzqFQO_CRXmKVoJ64LASrzYAFNR4E0iYYCKPK7T7k9COI9fdaxZN3koSefO3A5r9mBcaTDVVhTy6tQzgjVqv13FLDXe80gXcYTIUttGBMaFVw-7tQypr43QU03Sh8Dqx6bqpRi6mV20fQi87dSg1mX5u91b4mxiXIJTs07g32zvhwtWDprbijzE-Xb1e2_WMWj-flKEDSP9SZIr6xg; __stripe_mid=d62a3cde-2277-49f8-bd76-0334b5697b77932edc; csrf_rp_cook=aa324e372fec92e54640d7ad5f77d28b; rpsession=a%3A4%3A%7Bs%3A10%3A%22session_id%22%3Bs%3A32%3A%22e0f475bf008003e9232d938a3da7c548%22%3Bs%3A10%3A%22ip_address%22%3Bs%3A13%3A%22202.74.201.65%22%3Bs%3A10%3A%22user_agent%22%3Bs%3A117%3A%22Mozilla%2F5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F134.0.0.0%20Safari%2F537.36%22%3Bs%3A13%3A%22last_activity%22%3Bi%3A1744245283%3B%7D2c0121cf4fb3f53189cf83e6ecf18850; __stripe_sid=c2a6c47f-7b77-4a57-9fca-03a5f5fd5548fa0fa4; intercom-session-tbx03t1n=NTZTalp6YnFjYmpBeWxyUnluN0ZUSW5ETTQxQWdBS05Ld25sL3dEbXMrR2xBUW5nVVlLK2NRQUlIc3drZlpBcmZmVWtLbVI2dFg3a3RSZzZFNW1kTkFveGt5QnhpVXY1WnRWYjVYWUg4QXc9LS16Q1Eybm56UWV5WFd1OTJjanZ5YnpRPT0=--d3fb4859fc7a087676e3f1890ce0b3f6b38033ab`;

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

async function main() {
  try {
    // Define an array of job IDs to check
    const jobIds = [
      'NW-29742',  // The job we already checked
      'NW-24912',  // One of the jobs from our previous conversation
      'NW-29906'   // The job we saw earlier with billing contact
    ];
    
    for (const jobInternalId of jobIds) {
      const jobId = jobInternalId.replace('NW-', '');
      
      console.log(`\n\n==== CHECKING JOB: ${jobInternalId} ====`);
      console.log(`Fetching specific job: ${jobInternalId}`);
      
      // Get detailed job info directly using the job ID
      const detailResponse = await axios.get('https://app.fergus.com/api/v2/jobs/extended_json', {
        params: {
          job_id: '',
          internal_job_id: jobId,
          page: ''
        },
        headers: getDefaultHeaders()
      });
      
      // Extract relevant contact info
      const jobData = detailResponse.data.value?.jobCard?.job;
      if (!jobData) {
        console.log('Job data not found');
        continue;
      }
      
      console.log(`\nJob found: ${jobData.internal_id}`);
      console.log(`Description: ${jobData.brief_description}`);
      console.log(`Status: ${jobData.status_name}`);
      
      console.log('\nContact Information Summary:');
      
      // Site address/contact
      if (jobData.site_address) {
        console.log('\n1. Site Contact:');
        console.log(`- First Name: ${jobData.site_address.first_name || 'N/A'}`);
        console.log(`- Last Name: ${jobData.site_address.last_name || 'N/A'}`);
        console.log(`- Full Address: ${formatAddress(jobData.site_address)}`);
        
        if (Array.isArray(jobData.site_address.contact_items)) {
          jobData.site_address.contact_items.forEach(item => {
            console.log(`- ${item.contact_type}: ${item.contact_val}`);
          });
        }
      }
      
      // Main contact
      if (jobData.main_contact) {
        console.log('\n2. Main Contact:');
        console.log(`- First Name: ${jobData.main_contact.first_name || 'N/A'}`);
        console.log(`- Last Name: ${jobData.main_contact.last_name || 'N/A'}`);
        console.log(`- Position: ${jobData.main_contact.position || 'N/A'}`);
        
        if (Array.isArray(jobData.main_contact.contact_items)) {
          jobData.main_contact.contact_items.forEach(item => {
            console.log(`- ${item.contact_type}: ${item.contact_val}`);
          });
        }
      }
      
      // Billing contact
      if (jobData.billing_contact) {
        console.log('\n3. Billing Contact:');
        console.log(`- First Name: ${jobData.billing_contact.first_name || 'N/A'}`);
        console.log(`- Last Name: ${jobData.billing_contact.last_name || 'N/A'}`);
        console.log(`- Position: ${jobData.billing_contact.position || 'N/A'}`);
        console.log(`- Full Address: ${formatAddress(jobData.billing_contact)}`);
        
        if (Array.isArray(jobData.billing_contact.contact_items)) {
          jobData.billing_contact.contact_items.forEach(item => {
            console.log(`- ${item.contact_type}: ${item.contact_val}`);
          });
        }
      }
      
      // Customer details from job
      console.log('\n4. Customer Details:');
      console.log(`- Customer Name: ${jobData.customer_name || 'N/A'}`);
      console.log(`- Customer ID: ${jobData.customer_id || 'N/A'}`);
      
      // Check if main contact and billing contact are the same
      if (jobData.main_contact && jobData.billing_contact) {
        const mainContactId = jobData.main_contact.id;
        const billingContactId = jobData.billing_contact.id;
        console.log(`\nAre main contact and billing contact the same? ${mainContactId === billingContactId ? 'YES' : 'NO'}`);
      }
      
      // Check if site contact is the same as main or billing
      if (jobData.site_address && (jobData.main_contact || jobData.billing_contact)) {
        console.log('\nSite contact vs other contacts:');
        
        if (jobData.main_contact) {
          const siteFirstName = jobData.site_address.first_name || '';
          const siteLastName = jobData.site_address.last_name || '';
          const mainFirstName = jobData.main_contact.first_name || '';
          const mainLastName = jobData.main_contact.last_name || '';
          
          const siteNameMatches = 
            siteFirstName && mainFirstName && 
            siteFirstName.toLowerCase() === mainFirstName.toLowerCase() &&
            siteLastName.toLowerCase() === mainLastName.toLowerCase();
          
          console.log(`- Site contact name matches main contact name: ${siteNameMatches}`);
        }
        
        if (jobData.billing_contact) {
          const siteFirstName = jobData.site_address.first_name || '';
          const siteLastName = jobData.site_address.last_name || '';
          const billingFirstName = jobData.billing_contact.first_name || '';
          const billingLastName = jobData.billing_contact.last_name || '';
          
          const siteNameMatches = 
            siteFirstName && billingFirstName && 
            siteFirstName.toLowerCase() === billingFirstName.toLowerCase() &&
            siteLastName.toLowerCase() === billingLastName.toLowerCase();
          
          console.log(`- Site contact name matches billing contact name: ${siteNameMatches}`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Helper function to format an address object to string
function formatAddress(address) {
  if (!address) return 'N/A';
  
  const parts = [
    address.address_1,
    address.address_2,
    address.address_suburb,
    address.address_city,
    address.address_region,
    address.address_country,
    address.address_postcode
  ].filter(Boolean);
  
  return parts.join(', ') || 'N/A';
}

main().catch(console.error); 