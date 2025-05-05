/**
 * This script analyzes a job and outputs its address data in a readable format
 * for debugging purposes. It takes a job ID as a command line argument.
 * 
 * Usage: node test-job-addresses.js [job_id]
 */
const fs = require('fs').promises;
const path = require('path');

// Import functions from the main module
const { fetchJobById } = require('../direct-fergus-api');

/**
 * Format address object into a readable string
 */
function formatAddress(addressObj) {
  if (!addressObj) return 'No address data';
  
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
 * Extract suburb and city from a string address
 */
function extractAddressParts(addressStr) {
  if (!addressStr) return { street: 'N/A', suburb: 'N/A', city: 'N/A' };
  
  const parts = addressStr.split(',');
  
  if (parts.length >= 3) {
    // Format: "Street, Suburb, City Postcode"
    return {
      street: parts[0].trim(),
      suburb: parts[1].trim(),
      city: parts[2].trim().split(' ')[0] || parts[2].trim()
    };
  } else if (parts.length === 2) {
    // Format: "Street, Suburb/City"
    return {
      street: parts[0].trim(),
      suburb: parts[1].trim(),
      city: parts[1].trim() // Same as suburb if no separate city
    };
  } else {
    // Try spaces as separators for addresses without commas
    const spaceParts = addressStr.trim().split(' ');
    let suburb = 'Unknown', city = 'Unknown';
    
    // Look for known suburbs and cities in the string
    const knownSuburbs = ['Ponsonby', 'Mount Albert', 'Te Atatu', 'Glen Eden', 'Henderson', 
                          'Massey', 'Avondale', 'Westmere', 'Freemans Bay', 'Hillsborough'];
    const knownCities = ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga'];
    
    for (const part of spaceParts) {
      if (knownSuburbs.some(s => part.includes(s))) suburb = part;
      if (knownCities.some(c => part.includes(c))) city = part;
    }
    
    return {
      street: addressStr,
      suburb: suburb,
      city: city
    };
  }
}

/**
 * Main function to analyze job address data
 */
async function analyzeJobAddress(jobId) {
  try {
    console.log(`Analyzing address data for job ${jobId}...`);
    
    // Fetch the job data
    let job = null;
    
    try {
      job = await fetchJobById(jobId);
      if (job) {
        console.log(`Successfully fetched job ${job.internal_id || jobId}`);
      }
    } catch (err) {
      console.log(`Error fetching job: ${err.message}`);
    }
    
    // If direct API fetch failed, try loading from file
    if (!job) {
      try {
        console.log('Trying to load from sample file...');
        // Try variations of the file name
        const possiblePaths = [
          path.join(__dirname, 'output', `job-with-invoices-${jobId}.json`),
          path.join(__dirname, 'output', `job-with-invoices-NW-${jobId}.json`),
          path.join(__dirname, 'output', `address-test-job-${jobId}.json`)
        ];
        
        let jobData = null;
        for (const filePath of possiblePaths) {
          try {
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            if (fileExists) {
              const fileData = await fs.readFile(filePath, 'utf8');
              jobData = JSON.parse(fileData);
              console.log(`Loaded data from ${filePath}`);
              break;
            }
          } catch (e) {
            // Continue trying other files
          }
        }
        
        if (jobData) {
          // Extract job from file structure
          job = jobData.value?.jobCard?.job || jobData;
        }
      } catch (err) {
        console.error(`Error loading from file: ${err.message}`);
      }
    }
    
    if (!job) {
      console.log(`Could not find job data for ID: ${jobId}`);
      return;
    }
    
    // Output job details
    console.log('\n======= JOB DETAILS =======');
    console.log(`Job ID: ${job.internal_id || job.internal_job_id || job.id}`);
    console.log(`Description: ${job.brief_description || 'N/A'}`);
    console.log(`Status: ${job.job_status || job.status_name || 'Unknown'}`);
    console.log(`Customer: ${job.customer_full_name || job.customer_name || 'Unknown'}`);
    
    // Analyze site address
    console.log('\n======= SITE ADDRESS =======');
    if (typeof job.site_address === 'object') {
      console.log('Type: OBJECT');
      console.log(`Full address: ${formatAddress(job.site_address)}`);
      console.log(`Street: ${job.site_address.address_1 || 'N/A'} ${job.site_address.address_2 || ''}`);
      console.log(`Suburb: ${job.site_address.address_suburb || 'N/A'}`);
      console.log(`City: ${job.site_address.address_city || 'N/A'}`);
      console.log(`Region: ${job.site_address.address_region || 'N/A'}`);
      console.log(`Postcode: ${job.site_address.address_postcode || 'N/A'}`);
    } else if (typeof job.site_address === 'string') {
      console.log('Type: STRING');
      console.log(`Full address: ${job.site_address}`);
      
      const { street, suburb, city } = extractAddressParts(job.site_address);
      console.log(`Street (extracted): ${street}`);
      console.log(`Suburb (extracted): ${suburb}`);
      console.log(`City (extracted): ${city}`);
    } else {
      console.log('No site address found');
    }
    
    // Analyze customer/billing address
    console.log('\n======= BILLING ADDRESS =======');
    if (job.customer) {
      // Try billing contact first
      if (job.customer.billing_contact && 
          (job.customer.billing_contact.address_1 || 
           job.customer.billing_contact.address_city)) {
        console.log('Source: BILLING CONTACT');
        console.log(`Full address: ${formatAddress(job.customer.billing_contact)}`);
        console.log(`Street: ${job.customer.billing_contact.address_1 || 'N/A'} ${job.customer.billing_contact.address_2 || ''}`);
        console.log(`Suburb: ${job.customer.billing_contact.address_suburb || 'N/A'}`);
        console.log(`City: ${job.customer.billing_contact.address_city || 'N/A'}`);
      } 
      // Then try postal address
      else if (job.customer.postal_address) {
        console.log('Source: POSTAL ADDRESS');
        console.log(`Full address: ${formatAddress(job.customer.postal_address)}`);
        console.log(`Street: ${job.customer.postal_address.address_1 || 'N/A'} ${job.customer.postal_address.address_2 || ''}`);
        console.log(`Suburb: ${job.customer.postal_address.address_suburb || 'N/A'}`);
        console.log(`City: ${job.customer.postal_address.address_city || 'N/A'}`);
      } 
      // Finally try physical address
      else if (job.customer.physical_address) {
        console.log('Source: PHYSICAL ADDRESS');
        console.log(`Full address: ${formatAddress(job.customer.physical_address)}`);
        console.log(`Street: ${job.customer.physical_address.address_1 || 'N/A'} ${job.customer.physical_address.address_2 || ''}`);
        console.log(`Suburb: ${job.customer.physical_address.address_suburb || 'N/A'}`);
        console.log(`City: ${job.customer.physical_address.address_city || 'N/A'}`);
      } else {
        console.log('No billing/postal/physical address found in customer data');
      }
    } else {
      console.log('No customer data available');
    }
    
    console.log('\n======= ADDRESS COMPARISON =======');
    const siteAddressObj = typeof job.site_address === 'object' ? job.site_address : null;
    const siteAddressStr = typeof job.site_address === 'string' ? job.site_address : '';
    
    let billingAddressObj = null;
    if (job.customer) {
      billingAddressObj = job.customer.billing_contact || 
                          job.customer.postal_address || 
                          job.customer.physical_address;
    }
    
    // Compare suburb and city
    let siteSuburb = '', siteCity = '';
    if (siteAddressObj) {
      siteSuburb = siteAddressObj.address_suburb || '';
      siteCity = siteAddressObj.address_city || '';
    } else if (siteAddressStr) {
      const extracted = extractAddressParts(siteAddressStr);
      siteSuburb = extracted.suburb;
      siteCity = extracted.city;
    }
    
    let billingSuburb = '', billingCity = '';
    if (billingAddressObj) {
      billingSuburb = billingAddressObj.address_suburb || '';
      billingCity = billingAddressObj.address_city || '';
    }
    
    console.log('Site vs. Billing:');
    console.log(`Suburb: ${siteSuburb || 'N/A'} vs. ${billingSuburb || 'N/A'}`);
    console.log(`City: ${siteCity || 'N/A'} vs. ${billingCity || 'N/A'}`);
    console.log(`Different? ${(siteSuburb !== billingSuburb || siteCity !== billingCity) ? 'YES' : 'NO'}`);
  } catch (error) {
    console.error(`Error analyzing job: ${error.message}`);
  }
}

// Get job ID from command line
const jobId = process.argv[2];

if (!jobId) {
  console.log('Please provide a job ID as an argument.');
  console.log('Usage: node test-job-addresses.js JOB_ID');
  process.exit(1);
}

// Run the analysis
analyzeJobAddress(jobId).catch(console.error); 