const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// The specific invoice ID from your curl command
const INVOICE_ID = '15946945';

// Store your Fergus cookies here (using the ones from your curl command)
const FERGUS_COOKIES = `rpjwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiIiLCJpYXQiOjE3NDM2Njg4MDksImV4cCI6MTgwNjc0MDgwOSwidXNkIjp7ImNvbXBhbnlfZ3VpZCI6IjcwZjA5ZmFmLWNhNGEtNDE2OS04NDU2LTI4ZjYxZDQzOWIwZSIsImVtcGxveWVlX2d1aWQiOiI2NDdmNzM1YS0zOTMxLTQ0ODUtYWRmMy1iMmMxMWM5ZjM1MTEifX0.EGKJ2zgIc54Z1jXttEyUNWMvmZZoRVLJTlqCuiZ77dph3NDFlMb4X3SIaSHdx_kVe3DVkLY26mum-ZAlocvlFTxTI-TDfKs2NfqEvuj-CWVS6FNJHHFbPyQWkTt72X4Ru1jCuzqFQO_CRXmKVoJ64LASrzYAFNR4E0iYYCKPK7T7k9COI9fdaxZN3koSefO3A5r9mBcaTDVVhTy6tQzgjVqv13FLDXe80gXcYTIUttGBMaFVw-7tQypr43QU03Sh8Dqx6bqpRi6mV20fQi87dSg1mX5u91b4mxiXIJTs07g32zvhwtWDprbijzE-Xb1e2_WMWj-flKEDSP9SZIr6xg; _cfuvid=Q.RXVK3djX15k8Zl_uvb2s9ne1JBmqQhP64gKGNiNYE-1745366863555-0.0.1.1-604800000; csrf_rp_cook=a675cd6e7bb052c3cb2a85afbaf63f6e; intercom-device-id-tbx03t1n=2f98c8a5-194e-4e92-ba97-34b11049e67a; __stripe_mid=c7dc23d9-2569-4703-a7bd-9ee15cfba703fd9dc3; __stripe_sid=07b95d58-1954-4dc4-ae43-d180b9b9e6703d55af; rpsession=a%3A4%3A%7Bs%3A10%3A%22session_id%22%3Bs%3A32%3A%2225c73a58473288a42b80ba9772c701ca%22%3Bs%3A10%3A%22ip_address%22%3Bs%3A14%3A%22202.74.193.181%22%3Bs%3A10%3A%22user_agent%22%3Bs%3A117%3A%22Mozilla%2F5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F135.0.0.0%20Safari%2F537.36%22%3Bs%3A13%3A%22last_activity%22%3Bi%3A1746177883%3B%7D4a9e24f394b88681b44cf3e2a9cee34e; intercom-session-tbx03t1n=Zm0xbzlyb1ZOTFppUWxkUWRqYjZsL0VoSnAvei93SlZSY2UvQ1ZMZm5tOVQvdk00NjU3Vy8rOEdCZkxEV2ZVdjJ4dW5hQU5zNUxyWW05ZUE0bGpJNnVYeEpNSC9CUnZmVUZoS2JLUlhuTkE9LS16VjBsd0gyeitCMU9rQjNXNmdET0ZRPT0=--486271298e17246dba8abd370f79568d23042470`;

/**
 * Headers based exactly on your curl command
 */
const headers = {
  'Cookie': FERGUS_COOKIES,
  'accept': '*/*',
  'accept-language': 'en-GB,en;q=0.9',
  'priority': 'u=1, i',
  'referer': 'https://app.fergus.com/jobs/view/27432/invoicing/4f247ece-eb59-4754-9bd4-138b86c141af',
  'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'sec-gpc': '1',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'x-device-type': 'desktop',
  'x-screen-height': '900',
  'x-screen-width': '1440'
};

/**
 * Function to fetch a specific invoice using the exact endpoint from the curl command
 */
async function fetchSpecificInvoice(invoiceId) {
  try {
    const url = `https://app.fergus.com/api/v2/customer_invoices/job_card/${invoiceId}`;
    console.log(`Fetching invoice details for ID ${invoiceId} from ${url}`);
    
    const response = await axios.get(url, { headers });
    console.log('Successfully fetched invoice data');
    
    // Save the response to a file
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputFile = path.join(outputDir, `invoice-${invoiceId}.json`);
    await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
    
    console.log(`Invoice data saved to ${outputFile}`);
    
    // Log invoice structure to help with schema documentation
    console.log('\nInvoice Structure:');
    console.log('------------------');
    logObjectStructure(response.data);
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching invoice ${invoiceId}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      // Avoid logging potentially large HTML error responses
      if (typeof error.response.data === 'string' && error.response.data.startsWith('<html')) {
        console.error('Response: HTML error page');
      } else {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
    }
    return null;
  }
}

/**
 * Helper function to log the structure of an object (fields and types)
 */
function logObjectStructure(obj, prefix = '') {
  if (!obj) return;
  
  if (Array.isArray(obj)) {
    console.log(`${prefix} = Array`);
    if (obj.length > 0) {
      logObjectStructure(obj[0], `${prefix}[0]`);
    }
    return;
  }
  
  if (typeof obj === 'object') {
    for (const key in obj) {
      const value = obj[key];
      const type = Array.isArray(value) ? 'Array' : typeof value;
      
      if (type === 'object' && value !== null) {
        console.log(`${prefix}${prefix ? '.' : ''}${key} = Object`);
        logObjectStructure(value, `${prefix}${prefix ? '.' : ''}${key}`);
      } else {
        console.log(`${prefix}${prefix ? '.' : ''}${key} = ${type}`);
      }
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Fetch the specific invoice
    await fetchSpecificInvoice(INVOICE_ID);
  } catch (error) {
    console.error('Error in main process:', error.message);
  }
}

// Run the script
main().catch(console.error); 