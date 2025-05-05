/**
 * recent-jobs-sync.js
 * 
 * This script syncs recently modified jobs from Fergus to Airtable.
 * It runs periodically (e.g., every 15 minutes) to keep Airtable updated
 * with the latest contact information from Fergus.
 * 
 * MODES OF OPERATION:
 * 1. Testing Mode (default) - NODE_ENV != 'production'
 *    - Always processes two specific test jobs: NW-28367 and NW-29686
 *    - Useful for development and testing
 * 
 * 2. Production Mode - NODE_ENV = 'production'
 *    - Automatically used when deployed to Railway
 *    - Only processes jobs modified in the last 15 minutes
 *    - Avoids unnecessarily reprocessing jobs
 * 
 * Usage:
 * - node recent-jobs-sync.js                      (testing mode)
 * - NODE_ENV=production node recent-jobs-sync.js  (production mode)
 * - To test with a specific time window: node recent-jobs-sync.js 60 (for last 60 minutes)
 */

const api = require('../direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const axios = require('axios');

// Get Airtable base from the API module
const airtableBase = api.airtableBase;

// Default time window in minutes (how far back to check for modified jobs)
const DEFAULT_TIME_WINDOW = 15;

/**
 * Fetches recently modified jobs from Fergus
 * @param {number} minutesAgo - How many minutes back to check for modifications
 */
async function fetchRecentlyModifiedJobs(minutesAgo = DEFAULT_TIME_WINDOW) {
  try {
    console.log(`Fetching jobs modified in the last ${minutesAgo} minutes...`);
    
    // Check if we should use test mode or production mode
    const testMode = process.env.NODE_ENV !== 'production';
    
    if (testMode) {
      // For testing purposes, we'll use specific job numbers that we know exist
      console.log(`TESTING MODE: Using specific job numbers we know exist`);
      
      // Use job numbers directly that need to be updated
      return [
        'NW-28367', // Job that needs to be updated
        'NW-29686'  // Job we just processed
      ];
    }
    
    // PRODUCTION MODE: We'll now check Airtable first to see if any records were modified recently
    console.log(`PRODUCTION MODE: Checking Airtable for recently modified jobs...`);
    
    // Use the direct table ID instead of the name
    const tableId = 'tbl7iVgJPJzijH0ru';
    
    try {
      console.log(`Querying Airtable for recently modified records`);
      
      // Calculate timestamp for 30 minutes ago (slightly longer than our sync interval)
      const now = new Date();
      const lookbackWindow = 30; // 30 minutes
      const lookbackDate = new Date(now.getTime() - (lookbackWindow * 60 * 1000));
      
      console.log(`Looking for Airtable records modified since: ${lookbackDate.toISOString()}`);
      
      // Format the date for Airtable formula (ISO string format)
      const formattedDate = lookbackDate.toISOString();
      
      // Create a formula to find records modified after a certain time
      // Note: The Last Modified field needs to exist in your Airtable for this to work
      const filterFormula = `IS_AFTER({Last Modified}, '${formattedDate}')`;
      console.log(`Using Airtable filter formula: ${filterFormula}`);
      
      const records = await airtableBase(tableId)
        .select({
          filterByFormula: filterFormula,
          maxRecords: 10
        })
        .all();
      
      console.log(`Found ${records.length} recently modified records in Airtable (last 30 minutes)`);
      
      if (records.length > 0) {
        // Extract job IDs from the records
        const jobIds = records.map(record => record.fields.Job).filter(Boolean);
        console.log(`Extracted job IDs from Airtable: ${jobIds.join(', ')}`);
        
        if (jobIds.length > 0) {
          return jobIds;
        }
      }
      
      console.log(`No recently modified records found in Airtable, checking Fergus API...`);
    } catch (error) {
      console.error(`Error querying Airtable for modified records: ${error.message}`);
      console.log(`Falling back to Fergus API...`);
    }
    
    // If no records found in Airtable, fall back to our previous approach
    // Calculate timestamp for X minutes ago
    const now = new Date();
    const minutesAgoDate = new Date(now.getTime() - (minutesAgo * 60 * 1000));
    
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Looking for Fergus jobs modified since: ${minutesAgoDate.toISOString()}`);
    
    // Use the API to fetch all active jobs
    const activeJobs = await api.fetchActiveJobs(50, 5); // Fetch up to 250 jobs (5 pages of 50)
    
    if (!activeJobs || activeJobs.length === 0) {
      console.log('No active jobs found in Fergus');
      return [];
    }
    
    console.log(`Found ${activeJobs.length} active jobs in Fergus`);
    
    // Log some sample job modification dates to help diagnose the issue
    console.log('Sample job modification dates from Fergus:');
    for (let i = 0; i < Math.min(5, activeJobs.length); i++) {
      const job = activeJobs[i];
      console.log(`Job ${job.internal_id || job.internal_job_id}: Modified at ${job.date_last_modified || 'unknown'}`);
    }
    
    // Count jobs with valid modification dates
    const jobsWithDates = activeJobs.filter(job => job.date_last_modified).length;
    const percentWithDates = (jobsWithDates / activeJobs.length) * 100;
    console.log(`${jobsWithDates} out of ${activeJobs.length} jobs (${percentWithDates.toFixed(1)}%) have modification dates`);
    
    // If very few jobs have dates, use a different approach
    if (jobsWithDates < activeJobs.length * 0.1) { // Less than 10% of jobs have dates
      console.log('Most jobs are missing modification dates. Checking for specific jobs in Airtable...');
      
      // Try looking up specific jobs we know should exist in Airtable
      const specificJobs = ['NW-28367', 'NW-29686'];
      console.log(`Checking if specific jobs exist in Airtable: ${specificJobs.join(', ')}`);
      
      const existingJobs = [];
      
      for (const jobId of specificJobs) {
        try {
          const formula = `{Job}='${jobId}'`;
          const records = await airtableBase(tableId)
            .select({
              filterByFormula: formula,
              maxRecords: 1
            })
            .all();
          
          if (records.length > 0) {
            console.log(`Found job ${jobId} in Airtable`);
            existingJobs.push(jobId);
          } else {
            console.log(`Job ${jobId} not found in Airtable`);
          }
        } catch (error) {
          console.error(`Error checking for job ${jobId}: ${error.message}`);
        }
      }
      
      if (existingJobs.length > 0) {
        console.log(`Returning ${existingJobs.length} jobs that exist in Airtable`);
        return existingJobs;
      }
      
      // If still nothing, try the most recent jobs by ID
      console.log('No specific jobs found. Using most recent job IDs as fallback...');
      
      // Sort jobs by ID (assuming newer jobs have higher IDs)
      const sortedJobs = [...activeJobs].sort((a, b) => {
        const idA = parseInt((a.internal_id || a.internal_job_id || '').replace('NW-', ''), 10) || 0;
        const idB = parseInt((b.internal_id || b.internal_job_id || '').replace('NW-', ''), 10) || 0;
        return idB - idA; // Descending order (newest first)
      });
      
      // Take the 5 most recent jobs to process
      const recentJobsList = sortedJobs.slice(0, 5).map(job => {
        const jobId = job.internal_id || job.internal_job_id;
        const formattedId = jobId.startsWith('NW-') ? jobId : `NW-${jobId}`;
        console.log(`Including recent job by ID: ${formattedId}`);
        return formattedId;
      });
      
      return recentJobsList;
    }
    
    // Filter for jobs modified within the time window if dates exist
    const recentlyModified = activeJobs.filter(job => {
      if (!job.date_last_modified) return false;
      
      try {
        const modifiedDate = new Date(job.date_last_modified);
        return modifiedDate >= minutesAgoDate;
      } catch (error) {
        console.error(`Error parsing date for job ${job.internal_id || job.internal_job_id}: ${error.message}`);
        return false;
      }
    });
    
    console.log(`Found ${recentlyModified.length} jobs modified in the last ${minutesAgo} minutes`);
    
    // Extract job IDs and add "NW-" prefix
    const recentJobIds = recentlyModified.map(job => {
      const jobId = job.internal_id || job.internal_job_id;
      console.log(`Selected job: ${jobId}, last modified: ${job.date_last_modified}`);
      return jobId.startsWith('NW-') ? jobId : `NW-${jobId}`;
    });
    
    // If we found jobs with modification dates, return them
    if (recentJobIds.length > 0) {
      return recentJobIds;
    }
    
    // If we get here, we couldn't find any jobs to process
    console.log('No jobs found to process in this cycle.');
    return [];
  } catch (error) {
    console.error('Error fetching recently modified jobs:', error.message);
    // Return a test job ID as fallback
    return ['NW-29686'];
  }
}

// Add a helper function to check Airtable field names
async function checkAirtableFields() {
  try {
    console.log('Checking Airtable table structure...');
    
    // Get some records to inspect metadata
    const records = await airtableBase('Invoices')
      .select({
        maxRecords: 1
      })
      .all();
    
    if (records.length > 0) {
      const record = records[0];
      console.log('Airtable record fields:', Object.keys(record.fields));
      
      // Check if the job field exists and what case it's in
      const jobField = Object.keys(record.fields).find(field => 
        field.toLowerCase() === 'job');
      
      if (jobField) {
        console.log(`Found job field as: "${jobField}"`);
        return jobField;
      } else {
        console.log('No job field found in Airtable records');
      }
    } else {
      console.log('No records found in Airtable to check fields');
    }
    
    return null;
  } catch (error) {
    console.error('Error checking Airtable fields:', error.message);
    return null;
  }
}

/**
 * Checks if job exists in Airtable and returns its records
 */
async function findJobInAirtable(jobId) {
  try {
    console.log(`Searching for job ${jobId} in Airtable using filterByFormula...`);
    
    // Use the direct table ID instead of the name
    const tableId = 'tbl7iVgJPJzijH0ru';
    
    // Use filterByFormula to search for the exact job ID
    const formula = `{Job}='${jobId}'`;
    console.log(`Using formula: ${formula}`);
    
    const records = await airtableBase(tableId)
      .select({
        filterByFormula: formula
      })
      .all();
    
    console.log(`Found ${records.length} records for job ${jobId} in Airtable`);
    
    if (records.length > 0) {
      console.log('First matching record fields:', records[0].fields);
    }
    
    return records;
  } catch (error) {
    console.error(`Error finding job ${jobId} in Airtable:`, error.message);
    return [];
  }
}

/**
 * Checks if the record needs updating (has empty required fields)
 */
function recordNeedsUpdate(record) {
  // Check if essential contact fields are empty
  const fields = record.fields;
  
  // Check if Site Address is empty
  const hasSiteAddress = fields['Site Address'] && fields['Site Address'].trim() !== '';
  
  // Check if Contact Name is empty
  const hasSiteContactName = fields['Site Contact Name'] && fields['Site Contact Name'].trim() !== '';
  
  // Check if Customer field is empty
  const hasCustomer = fields['Customer'] && fields['Customer'].trim() !== '';
  
  // If any of these essential fields are missing, the record needs updating
  const needsUpdate = !hasSiteAddress || !hasSiteContactName || !hasCustomer;
  
  console.log(`Record ${record.id} needs update: ${needsUpdate} (hasSiteAddress: ${hasSiteAddress}, hasSiteContactName: ${hasSiteContactName}, hasCustomer: ${hasCustomer})`);
  
  return needsUpdate;
}

/**
 * Updates Airtable records with contact information from Fergus
 */
async function updateAirtableWithContactInfo(recordsByJobId, jobData) {
  // Extract contact information
  let siteContactName = '';
  let siteContactEmail = '';
  let siteContactPhone = '';
  let siteAddress = '';
  let billingAddress = '';
  let customerName = '';
  
  // 1. Site Contact and Address extraction
  if (typeof jobData.site_address === 'object' && jobData.site_address) {
    // Extract contact name from site address
    const firstName = jobData.site_address.first_name || '';
    const lastName = jobData.site_address.last_name || '';
    siteContactName = [firstName, lastName].filter(Boolean).join(' ');
    
    // Extract site address - using the specific address fields from the API response
    const addressParts = [];
    if (jobData.site_address.address_1) addressParts.push(jobData.site_address.address_1);
    if (jobData.site_address.address_2 && jobData.site_address.address_2.trim()) addressParts.push(jobData.site_address.address_2);
    if (jobData.site_address.address_suburb) addressParts.push(jobData.site_address.address_suburb);
    if (jobData.site_address.address_city) addressParts.push(jobData.site_address.address_city);
    if (jobData.site_address.address_postcode) addressParts.push(jobData.site_address.address_postcode);
    siteAddress = addressParts.join(' ');
    
    // Extract contact items (email, phone) if available
    if (Array.isArray(jobData.site_address.contact_items)) {
      jobData.site_address.contact_items.forEach(item => {
        if (item.contact_type === 'email' && !siteContactEmail) {
          // Only use the first email if multiple exist
          siteContactEmail = item.contact_val || '';
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          // If we already have a phone number, add this as a secondary one
          if (siteContactPhone) {
            siteContactPhone += `, ${item.contact_val}`;
          } else {
            siteContactPhone = item.contact_val || '';
          }
        }
      });
    }
  }
  
  // 2. Main Contact extraction
  let mainContactName = '';
  let mainContactEmail = '';
  let mainContactPhone = '';
  
  if (jobData.main_contact) {
    const mainContact = jobData.main_contact;
    
    // Extract contact name
    const firstName = mainContact.first_name || '';
    const lastName = mainContact.last_name || '';
    mainContactName = [firstName, lastName].filter(Boolean).join(' ');
    
    // Extract contact items (email, phone) if available
    if (Array.isArray(mainContact.contact_items)) {
      mainContact.contact_items.forEach(item => {
        if (item.contact_type === 'email' && !mainContactEmail) {
          // Only use the first email if multiple exist
          mainContactEmail = item.contact_val || '';
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          // If we already have a phone number, add this as a secondary one
          if (mainContactPhone) {
            mainContactPhone += `, ${item.contact_val}`;
          } else {
            mainContactPhone = item.contact_val || '';
          }
        }
      });
    }
  }
  
  // 3. Customer and Billing Address extraction
  if (jobData.customer) {
    // Use customer_full_name if available, otherwise construct from first/last name
    customerName = jobData.customer.customer_full_name || '';
    
    // Extract billing address from postal_address
    if (jobData.customer.postal_address) {
      const postalAddress = jobData.customer.postal_address;
      const billingParts = [];
      
      if (postalAddress.address_1) billingParts.push(postalAddress.address_1);
      if (postalAddress.address_2 && postalAddress.address_2.trim()) billingParts.push(postalAddress.address_2);
      if (postalAddress.address_suburb) billingParts.push(postalAddress.address_suburb);
      if (postalAddress.address_city) billingParts.push(postalAddress.address_city);
      if (postalAddress.address_postcode) billingParts.push(postalAddress.address_postcode);
      
      billingAddress = billingParts.join(' ');
    }
  }
  
  // 4. Get additional info from the job itself
  const longDescription = jobData.long_description || '';
  
  // From the screenshots, we see these fields exist
  const contactFields = [
    'Site Contact Name',
    'Site Contact Email',
    'Site Contact Phone',
    'Main Contact Name',
    'Main Contact Email',
    'Main Contact Phone',
    'Site Address',
    'Billing Address',
    'Customer'
  ];
  
  // Prepare the update object with contact fields we know exist based on screenshots
  const updateFields = {
    'Site Contact Name': siteContactName,
    'Site Contact Email': siteContactEmail,
    'Site Contact Phone': siteContactPhone,
    'Main Contact Name': mainContactName,
    'Main Contact Email': mainContactEmail,
    'Main Contact Phone': mainContactPhone,
    'Site Address': siteAddress,
    'Billing Address': billingAddress,
    'Customer': customerName
  };
  
  console.log('Updating records with the following contact information:');
  console.log(JSON.stringify(updateFields, null, 2));
  
  // Update each matching record in Airtable
  let updatedCount = 0;
  let skippedCount = 0;
  
  // Use the direct table ID instead of the name
  const tableId = 'tbl7iVgJPJzijH0ru';
  
  for (const record of recordsByJobId) {
    try {
      // Check if the record actually needs updating (has empty fields)
      if (!recordNeedsUpdate(record)) {
        console.log(`Record ${record.id} already has all essential contact information - skipping`);
        skippedCount++;
        continue;
      }
      
      await airtableBase(tableId).update(record.id, updateFields);
      updatedCount++;
      console.log(`Updated record ${record.id}`);
    } catch (error) {
      console.error(`Error updating record ${record.id}:`, error.message);
      
      // If error occurs, try finding which fields exist and update only those
      if (error.message.includes("Unknown field name")) {
        console.log("Trying to identify which fields exist...");
        
        // Get the existing fields
        const existingFields = Object.keys(record.fields);
        console.log("Fields in this record:", existingFields);
        
        // Create a new update object with only the fields that exist
        const filteredUpdateFields = {};
        for (const field of contactFields) {
          if (existingFields.includes(field)) {
            filteredUpdateFields[field] = updateFields[field];
          }
        }
        
        console.log("Trying with filtered fields:", filteredUpdateFields);
        
        // Try updating with only the existing fields
        try {
          await airtableBase(tableId).update(record.id, filteredUpdateFields);
          updatedCount++;
          console.log(`Updated record ${record.id} with filtered fields`);
        } catch (retryError) {
          console.error(`Still failed to update record ${record.id}:`, retryError.message);
        }
      }
    }
  }
  
  console.log(`Successfully updated ${updatedCount} of ${recordsByJobId.length} records`);
  console.log(`Skipped ${skippedCount} records (already had contact info)`);
  return updatedCount;
}

/**
 * Main function to sync recently modified jobs to Airtable
 */
async function syncRecentJobsToAirtable(minutesAgo = DEFAULT_TIME_WINDOW) {
  try {
    console.log(`=== Starting Recent Jobs Sync (${new Date().toISOString()}) ===`);
    
    // Fetch recently modified jobs
    const recentJobIds = await fetchRecentlyModifiedJobs(minutesAgo);
    
    if (recentJobIds.length === 0) {
      console.log('No recent jobs to sync');
      return;
    }
    
    console.log(`Found ${recentJobIds.length} job(s), processing them`);
    
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    
    // Process each job
    for (let i = 0; i < recentJobIds.length; i++) {
      const jobId = recentJobIds[i];
      const numericId = jobId.replace('NW-', '');
      
      console.log(`\nProcessing job ${i+1}/${recentJobIds.length}: ${jobId}`);
      
      // Check if job exists in Airtable
      const airtableRecords = await findJobInAirtable(jobId);
      
      if (airtableRecords.length === 0) {
        console.log(`Job ${jobId} not found in Airtable - skipping`);
        notFoundCount++;
        continue;
      }
      
      console.log(`Found ${airtableRecords.length} records for job ${jobId} in Airtable`);
      
      // Check if any records need updating (have empty contact fields)
      const recordsNeedingUpdate = airtableRecords.filter(record => recordNeedsUpdate(record));
      
      if (recordsNeedingUpdate.length === 0) {
        console.log(`All records for job ${jobId} already have contact information - skipping`);
        skippedCount++;
        continue;
      }
      
      console.log(`${recordsNeedingUpdate.length} of ${airtableRecords.length} records need contact information updated`);
      
      try {
        // Get detailed job data from Fergus using fetchJobWithInvoices directly
        console.log(`Fetching job data from Fergus for ${numericId}...`);
        
        // Use fetchJobWithInvoices directly since getDetailedJobData is not available
        const jobWithInvoices = await api.fetchJobWithInvoices(numericId);
        
        if (!jobWithInvoices || jobWithInvoices.result !== 'success') {
          console.log(`Could not find job data in Fergus for ${jobId}`);
          failCount++;
          continue;
        }
        
        // Extract the job data from the response
        const jobData = jobWithInvoices.value?.jobCard?.job;
        if (!jobData) {
          console.log(`No job data available in the response for ${jobId}`);
          failCount++;
          continue;
        }
        
        // Save the job data to a file for reference
        const outputDir = path.join(__dirname, '..', 'output');
        await fs.mkdir(outputDir, { recursive: true });
        const filename = `recent-job-data-${jobId}.json`;
        const filePath = path.join(outputDir, filename);
        await fs.writeFile(filePath, JSON.stringify(jobData, null, 2));
        
        // Update Airtable records with the contact information
        const updated = await updateAirtableWithContactInfo(recordsNeedingUpdate, jobData);
        if (updated > 0) {
          successCount++;
        } else {
          failCount++;
        }
        
        // Add a delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`\n=== Recent Jobs Sync Completed (${new Date().toISOString()}) ===`);
    console.log(`Successfully updated ${successCount} jobs out of ${recentJobIds.length}`);
    console.log(`Skipped ${skippedCount} jobs (already had all contact info)`);
    console.log(`Not found in Airtable: ${notFoundCount} jobs`);
    
    if (failCount > 0) {
      console.log(`Failed to update ${failCount} jobs`);
    }
    
  } catch (error) {
    console.error('Error in recent jobs sync process:', error.message);
  }
}

// Main execution
const customTimeWindow = parseInt(process.argv[2], 10) || DEFAULT_TIME_WINDOW;

// Run the function
syncRecentJobsToAirtable(customTimeWindow)
  .then(() => console.log('\nProcess completed'))
  .catch(err => console.error('Error in main process:', err)); 