const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Store your Fergus cookies here - use the ones from direct-fergus-api.js
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
 * Test different ways to filter jobs by modification date
 */
async function testModifiedJobs() {
  const outputDir = path.join(__dirname, 'output');
  await fs.mkdir(outputDir, { recursive: true });
  
  console.log('Testing different methods to fetch recently modified jobs...');
  
  // Method 1: Try using the filter parameter with date created
  await testFilterWithCreatedDate();
  
  // Method 2: Try using a filter with modified_after field
  await testFilterWithModifiedAfter();
  
  // Method 3: Try using a custom header
  await testWithModifiedSinceHeader();
  
  // Method 4: Get all jobs and check created/updated dates
  await testGetAllAndFilter();
  
  console.log('All tests completed. Check the output directory for results.');
}

/**
 * Test using a filter with created_at field (since we know the sample had May 2nd, 2025)
 */
async function testFilterWithCreatedDate() {
  try {
    console.log('\n--- Testing filter with created_at field ---');
    
    // Reference date: May 2nd, 2025
    const refDate = '2025-05-02';
    
    const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
    
    const response = await axios.post(url, {
      page: 1,
      page_size: 20,
      filter: JSON.stringify({
        created_at: {
          $gte: refDate
        }
      }),
      selected_group_ids: [],
      selected_employee_ids: []
    }, {
      headers: getDefaultHeaders()
    });
    
    const jobs = response.data.value || [];
    console.log(`Found ${jobs.length} jobs created on or after ${refDate}`);
    
    if (jobs.length > 0) {
      // Save the results
      await fs.writeFile(
        path.join(__dirname, 'output', 'jobs-created-after.json'),
        JSON.stringify(response.data, null, 2)
      );
      console.log(`First job sample: ${JSON.stringify(jobs[0].customer_full_name)} - ${jobs[0].internal_id}`);
    }
  } catch (error) {
    console.error('Error in testFilterWithCreatedDate:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Test using a filter with modified_after field
 */
async function testFilterWithModifiedAfter() {
  try {
    console.log('\n--- Testing filter with modified_after field ---');
    
    // Reference date: May 2nd, 2025
    const refDate = '2025-05-02';
    
    const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
    
    // Try different field names that might work for modified date
    const fieldNames = [
      'modified_at', 
      'updated_at', 
      'last_modified',
      'modified_date',
      'last_updated'
    ];
    
    for (const fieldName of fieldNames) {
      console.log(`Trying field name: ${fieldName}`);
      
      const filter = {};
      filter[fieldName] = { $gte: refDate };
      
      const response = await axios.post(url, {
        page: 1,
        page_size: 20,
        filter: JSON.stringify(filter),
        selected_group_ids: [],
        selected_employee_ids: []
      }, {
        headers: getDefaultHeaders()
      });
      
      const jobs = response.data.value || [];
      console.log(`Using ${fieldName}: Found ${jobs.length} jobs`);
      
      if (jobs.length > 0) {
        // Save the results
        await fs.writeFile(
          path.join(__dirname, 'output', `jobs-${fieldName}.json`),
          JSON.stringify(response.data, null, 2)
        );
        console.log(`First job sample: ${JSON.stringify(jobs[0].customer_full_name)} - ${jobs[0].internal_id}`);
      }
      
      // Add a delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('Error in testFilterWithModifiedAfter:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Test using If-Modified-Since header
 */
async function testWithModifiedSinceHeader() {
  try {
    console.log('\n--- Testing with If-Modified-Since header ---');
    
    // Reference date: May 2nd, 2025
    const refDate = new Date('2025-05-02').toUTCString();
    
    const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
    
    const headers = {
      ...getDefaultHeaders(),
      'If-Modified-Since': refDate
    };
    
    const response = await axios.post(url, {
      page: 1,
      page_size: 20,
      filter: "",
      selected_group_ids: [],
      selected_employee_ids: []
    }, { headers });
    
    const jobs = response.data.value || [];
    console.log(`Using If-Modified-Since header: Found ${jobs.length} jobs`);
    
    if (jobs.length > 0) {
      // Save the results
      await fs.writeFile(
        path.join(__dirname, 'output', 'jobs-if-modified-since.json'),
        JSON.stringify(response.data, null, 2)
      );
      console.log(`First job sample: ${JSON.stringify(jobs[0].customer_full_name)} - ${jobs[0].internal_id}`);
    }
  } catch (error) {
    console.error('Error in testWithModifiedSinceHeader:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Get all jobs and filter by May 2nd, 2025 date
 */
async function testGetAllAndFilter() {
  try {
    console.log('\n--- Testing get all jobs and filter by date ---');
    
    // Reference date: May 2nd, 2025
    const refDate = new Date('2025-05-02T00:00:00Z');
    
    const url = 'https://app.fergus.com/api/v2/status_board/all_active_jobs';
    
    const response = await axios.post(url, {
      page: 1,
      page_size: 100, // Get more jobs at once
      filter: "",
      selected_group_ids: [],
      selected_employee_ids: []
    }, {
      headers: getDefaultHeaders()
    });
    
    const allJobs = response.data.value || [];
    console.log(`Found ${allJobs.length} total jobs to analyze`);
    
    // Look for any date fields in the jobs
    const dateFields = new Set();
    const jobsWithDates = [];
    
    for (const job of allJobs) {
      // Collect all fields that look like dates
      Object.entries(job).forEach(([key, value]) => {
        if (typeof value === 'string' && 
            (value.includes('2025-05-02') || value.includes('2025-05-01') || value.includes('2025-05-03'))) {
          dateFields.add(key);
          jobsWithDates.push({
            internal_id: job.internal_id,
            customer_name: job.customer_full_name,
            [key]: value
          });
        }
      });
    }
    
    console.log('Fields containing date values:', Array.from(dateFields));
    console.log(`Found ${jobsWithDates.length} jobs with relevant dates`);
    
    if (jobsWithDates.length > 0) {
      // Save the results
      await fs.writeFile(
        path.join(__dirname, 'output', 'jobs-with-dates.json'),
        JSON.stringify(jobsWithDates, null, 2)
      );
    }
    
    // Look specifically for May 2nd, 2025 in created_at
    const jobsCreatedMay2 = allJobs.filter(job => 
      job.created_at && job.created_at.includes('2025-05-02')
    );
    
    console.log(`Found ${jobsCreatedMay2.length} jobs created on May 2nd, 2025`);
    
    if (jobsCreatedMay2.length > 0) {
      await fs.writeFile(
        path.join(__dirname, 'output', 'jobs-created-may2.json'),
        JSON.stringify(jobsCreatedMay2, null, 2)
      );
      console.log(`Sample job created on May 2: ${jobsCreatedMay2[0].customer_full_name} - ${jobsCreatedMay2[0].internal_id}`);
    }
  } catch (error) {
    console.error('Error in testGetAllAndFilter:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
testModifiedJobs().catch(console.error); 