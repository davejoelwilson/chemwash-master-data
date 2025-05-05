/**
 * Test script to access Fergus Customer Invoice Report
 * This might help us identify which jobs have invoices/are completed
 */
const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();

// Use cookies from the curl command
const FERGUS_COOKIES = `rpjwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiIiLCJpYXQiOjE3NDM2Njg4MDksImV4cCI6MTgwNjc0MDgwOSwidXNkIjp7ImNvbXBhbnlfZ3VpZCI6IjcwZjA5ZmFmLWNhNGEtNDE2OS04NDU2LTI4ZjYxZDQzOWIwZSIsImVtcGxveWVlX2d1aWQiOiI2NDdmNzM1YS0zOTMxLTQ0ODUtYWRmMy1iMmMxMWM5ZjM1MTEifX0.EGKJ2zgIc54Z1jXttEyUNWMvmZZoRVLJTlqCuiZ77dph3NDFlMb4X3SIaSHdx_kVe3DVkLY26mum-ZAlocvlFTxTI-TDfKs2NfqEvuj-CWVS6FNJHHFbPyQWkTt72X4Ru1jCuzqFQO_CRXmKVoJ64LASrzYAFNR4E0iYYCKPK7T7k9COI9fdaxZN3koSefO3A5r9mBcaTDVVhTy6tQzgjVqv13FLDXe80gXcYTIUttGBMaFVw-7tQypr43QU03Sh8Dqx6bqpRi6mV20fQi87dSg1mX5u91b4mxiXIJTs07g32zvhwtWDprbijzE-Xb1e2_WMWj-flKEDSP9SZIr6xg; _cfuvid=Q.RXVK3djX15k8Zl_uvb2s9ne1JBmqQhP64gKGNiNYE-1745366863555-0.0.1.1-604800000; csrf_rp_cook=a675cd6e7bb052c3cb2a85afbaf63f6e; intercom-device-id-tbx03t1n=2f98c8a5-194e-4e92-ba97-34b11049e67a; __stripe_mid=c7dc23d9-2569-4703-a7bd-9ee15cfba703fd9dc3; __stripe_sid=6fad6d49-ada4-4bdc-9b7e-a45e0717359e18c1a7; rpsession=a%3A4%3A%7Bs%3A10%3A%22session_id%22%3Bs%3A32%3A%2225c73a58473288a42b80ba9772c701ca%22%3Bs%3A10%3A%22ip_address%22%3Bs%3A14%3A%22202.74.193.181%22%3Bs%3A10%3A%22user_agent%22%3Bs%3A117%3A%22Mozilla%2F5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F135.0.0.0%20Safari%2F537.36%22%3Bs%3A13%3A%22last_activity%22%3Bi%3A1746182155%3B%7D27716106354157d20ec4a4cfe38ded69; intercom-session-tbx03t1n=ZllqQnkwTjJpOHFMdU1zUzIrNU4vc2w4Y3ByU1hFQ3RDdjcyRGFBVkpaT2RKdEVtVlpYaXduWWR3V3FsYnBIWUtvT3liNk5pSGFKaExjREJYWm1vbDJxRCs4NDM3d05aWjM1OEhzREhNN2c9LS1FbDBkRW5sencrSjMrR2dta0VjaE5RPT0=--83d3088c094810d1c71a0506204755be1568005b`;

/**
 * Default headers for Fergus API requests
 */
const getDefaultHeaders = () => ({
  'Cookie': FERGUS_COOKIES,
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Origin': 'https://app.fergus.com',
  'Referer': 'https://app.fergus.com/dashboard',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-Device-Type': 'desktop',
  'X-Screen-Height': '900',
  'X-Screen-Width': '1440'
});

/**
 * Try to access the customer invoice report URL
 */
async function fetchCustomerInvoiceReport() {
  try {
    console.log('Attempting to access customer invoice report...');
    
    // This might return HTML rather than JSON since it's a report page
    const response = await axios.get('https://app.fergus.com/reports/customer_invoice_report', {
      headers: getDefaultHeaders()
    });
    
    console.log(`Request status: ${response.status}`);
    console.log(`Response type: ${typeof response.data}`);
    
    // Check if it's HTML or JSON
    const isHTML = typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>');
    console.log(`Is HTML response: ${isHTML}`);
    
    if (isHTML) {
      // Save the HTML response
      await fs.mkdir('output', { recursive: true });
      await fs.writeFile('output/invoice-report.html', response.data);
      console.log('Saved HTML response to output/invoice-report.html');
      
      // Also try the API endpoint for this report
      try {
        console.log('Trying API endpoint for the report...');
        const apiResponse = await axios.get('https://app.fergus.com/api/v2/reports/customer_invoices', {
          headers: getDefaultHeaders()
        });
        
        console.log(`API request status: ${apiResponse.status}`);
        
        await fs.writeFile('output/invoice-report-api.json', JSON.stringify(apiResponse.data, null, 2));
        console.log('Saved API response to output/invoice-report-api.json');
        
        return apiResponse.data;
      } catch (apiError) {
        console.error('Error accessing API endpoint:', apiError.message);
        if (apiError.response) {
          console.error('API response status:', apiError.response.status);
        }
      }
    } else {
      // Save the JSON response
      await fs.writeFile('output/invoice-report.json', JSON.stringify(response.data, null, 2));
      console.log('Saved JSON response to output/invoice-report.json');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching customer invoice report:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    
    return null;
  }
}

// Execute the request
fetchCustomerInvoiceReport().catch(console.error); 