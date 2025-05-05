/**
 * This script tests the address extraction functionality without modifying Airtable.
 * It helps verify that we're correctly parsing address information from job data.
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Import the functions from the main file
const { fetchJobById } = require('../direct-fergus-api');

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
 * Main function to test address extraction
 */
async function testAddressExtraction() {
  try {
    console.log('Testing address extraction from Fergus jobs...');
    
    // Test with a specific job ID that we know exists
    const jobId = process.argv[2] || '27432'; // Default to 27432 if no ID provided
    console.log(`Using job ID: ${jobId}`);
    
    // First, try to fetch the job
    console.log('Fetching job data...');
    const job = await fetchJobById(jobId);
    
    if (!job) {
      console.log(`Could not fetch job with ID: ${jobId}`);
      // Try to load from a sample file if we have one
      try {
        const samplePath = path.join(__dirname, 'output', `job-with-invoices-${jobId}.json`);
        const sampleData = JSON.parse(await fs.readFile(samplePath, 'utf8'));
        console.log(`Loaded sample data from file: ${samplePath}`);
        
        // Extract job data from the sample file
        const jobFromSample = sampleData.value?.jobCard?.job;
        if (jobFromSample) {
          analyzeJobAddresses(jobFromSample);
        } else {
          console.log('Sample file does not contain valid job data');
        }
      } catch (err) {
        console.error(`Could not load from sample file either: ${err.message}`);
      }
      return;
    }
    
    // If we got the job, analyze its addresses
    analyzeJobAddresses(job);
    
    // Save the job data for reference
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, `address-test-job-${jobId}.json`),
      JSON.stringify(job, null, 2)
    );
    console.log(`Saved full job data to output/address-test-job-${jobId}.json`);
    
  } catch (error) {
    console.error('Error in address extraction test:', error.message);
  }
}

/**
 * Analyze a job's address information
 */
function analyzeJobAddresses(job) {
  console.log('\n=== JOB INFORMATION ===');
  console.log(`Job ID: ${job.internal_id || job.internal_job_id || job.id}`);
  console.log(`Job Status: ${job.job_status || job.status_name || 'Unknown'}`);
  console.log(`Customer: ${job.customer_full_name || job.customer_name || 'Unknown'}`);
  
  console.log('\n=== SITE ADDRESS ===');
  if (typeof job.site_address === 'object') {
    console.log('Site address is an OBJECT:');
    console.log(JSON.stringify(job.site_address, null, 2));
    
    console.log('\nExtracted site address:');
    console.log(`Street: ${job.site_address.address_1 || ''} ${job.site_address.address_2 || ''}`);
    console.log(`Suburb: ${job.site_address.address_suburb || 'Not available'}`);
    console.log(`City: ${job.site_address.address_city || 'Not available'}`);
    console.log(`Full address: ${formatAddressObject(job.site_address)}`);
  } else if (typeof job.site_address === 'string') {
    console.log('Site address is a STRING:');
    console.log(job.site_address);
    
    // Try to extract suburb and city from address string
    const addressParts = job.site_address.split(',');
    let extractedSuburb = '', extractedCity = '';
    
    if (addressParts.length >= 3) {
      extractedSuburb = addressParts[1].trim();
      const cityPart = addressParts[2].trim();
      extractedCity = cityPart.split(' ')[0] || cityPart;
      
      console.log('\nExtracted parts:');
      console.log(`Street: ${addressParts[0].trim()}`);
      console.log(`Suburb: ${extractedSuburb}`);
      console.log(`City: ${extractedCity}`);
    } else {
      console.log('\nCannot extract parts - address format not recognized');
    }
  } else {
    console.log('Site address not available');
  }
  
  console.log('\n=== CUSTOMER/BILLING ADDRESS ===');
  if (job.customer) {
    // Try billing contact first
    if (job.customer.billing_contact && 
        (job.customer.billing_contact.address_1 || 
         job.customer.billing_contact.address_city)) {
      console.log('Found billing contact address:');
      console.log(JSON.stringify(job.customer.billing_contact, null, 2));
      console.log(`Full address: ${formatAddressObject(job.customer.billing_contact)}`);
    } 
    // Then try postal address
    else if (job.customer.postal_address) {
      console.log('Found postal address:');
      console.log(JSON.stringify(job.customer.postal_address, null, 2));
      console.log(`Full address: ${formatAddressObject(job.customer.postal_address)}`);
    } 
    // Finally try physical address
    else if (job.customer.physical_address) {
      console.log('Found physical address:');
      console.log(JSON.stringify(job.customer.physical_address, null, 2));
      console.log(`Full address: ${formatAddressObject(job.customer.physical_address)}`);
    } else {
      console.log('No billing/postal/physical address found in customer data');
    }
  } else {
    console.log('No customer data available');
  }
}

// Run the test
testAddressExtraction().catch(console.error); 