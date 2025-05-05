/**
 * batch-update-contacts.js
 * 
 * This script updates contact information for multiple jobs in Airtable
 * by fetching data from Fergus. It can process all jobs or a specific list.
 * 
 * Usage:
 * - Update all jobs: node batch-update-contacts.js
 * - Update specific jobs: node batch-update-contacts.js NW-21491,NW-21492,NW-21493
 */

const api = require('../direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Get Airtable base from the API module
const airtableBase = api.airtableBase;

async function batchUpdateJobContacts(specificJobIds = null) {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '..', 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Fetch all jobs from Airtable or filter by specific IDs
    console.log('Fetching jobs from Airtable...');
    
    let formula = '';
    if (specificJobIds && specificJobIds.length > 0) {
      // Create OR formula for specific job IDs
      const jobIdConditions = specificJobIds.map(id => `{Job}='${id}'`);
      formula = `OR(${jobIdConditions.join(',')})`;
      console.log(`Looking for specific jobs: ${specificJobIds.join(', ')}`);
    }
    
    const records = await airtableBase('Invoices')
      .select({
        filterByFormula: formula
      })
      .all();
    
    if (!records || records.length === 0) {
      console.log('No records found in Airtable');
      return;
    }
    
    console.log(`Found ${records.length} records in Airtable`);
    
    // Group records by Job ID
    const recordsByJobId = {};
    records.forEach(record => {
      const jobId = record.get('Job');
      if (!jobId) return;
      
      if (!recordsByJobId[jobId]) {
        recordsByJobId[jobId] = [];
      }
      recordsByJobId[jobId].push(record);
    });
    
    const jobIds = Object.keys(recordsByJobId);
    console.log(`Found ${jobIds.length} unique job IDs to process`);
    
    // Process each job ID
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < jobIds.length; i++) {
      const jobId = jobIds[i];
      console.log(`\nProcessing job ${i+1}/${jobIds.length}: ${jobId}`);
      
      try {
        // Remove the "NW-" prefix if present to get the numeric ID for Fergus
        const numericId = jobId.replace('NW-', '');
        
        // Get the detailed job data from Fergus
        console.log(`Fetching detailed job data from Fergus for ${numericId}...`);
        let jobData = await api.getDetailedJobData(numericId);
        
        if (!jobData) {
          console.log(`No detailed data found in Fergus for job ${jobId}`);
          
          // Try alternative method
          console.log("Trying alternative job data lookup...");
          const jobWithInvoices = await api.fetchJobWithInvoices(numericId);
          
          if (!jobWithInvoices || jobWithInvoices.result !== 'success') {
            console.log(`Could not find job data in Fergus for ${jobId}`);
            failCount++;
            continue;
          }
          
          jobData = jobWithInvoices.value?.jobCard?.job;
          if (!jobData) {
            console.log(`No job data available in the response for ${jobId}`);
            failCount++;
            continue;
          }
        }
        
        // Save the job data to a file for reference
        const filename = `job-data-${jobId}.json`;
        const filePath = path.join(outputDir, filename);
        await fs.writeFile(filePath, JSON.stringify(jobData, null, 2));
        
        // Update Airtable records with the contact information
        await updateAirtableRecordsWithJobData(recordsByJobId[jobId], jobData);
        successCount++;
        
        // Add a delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`\nBatch update completed!`);
    console.log(`Successfully updated ${successCount} jobs out of ${jobIds.length}`);
    if (failCount > 0) {
      console.log(`Failed to update ${failCount} jobs`);
    }
    
  } catch (error) {
    console.error('Error in batch update process:', error.message);
  }
}

async function updateAirtableRecordsWithJobData(records, jobData) {
  // Extract contact information
  
  // 1. Site Contact
  let siteContactName = '';
  let siteContactEmail = '';
  let siteContactPhone = '';
  
  if (typeof jobData.site_address === 'object' && jobData.site_address) {
    // Extract contact name from site address
    const firstName = jobData.site_address.first_name || '';
    const lastName = jobData.site_address.last_name || '';
    siteContactName = [firstName, lastName].filter(Boolean).join(' ');
    
    // Extract contact items (email, phone) if available
    if (Array.isArray(jobData.site_address.contact_items)) {
      jobData.site_address.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          siteContactEmail = item.contact_val || '';
        } else if (item.contact_type === 'phone') {
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
  
  // 2. Main Contact
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
        if (item.contact_type === 'email') {
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
  
  // 3. Billing Contact
  let billingContactName = '';
  let billingContactEmail = '';
  let billingContactPhone = '';
  
  if (jobData.billing_contact) {
    const billingContact = jobData.billing_contact;
    
    // Extract contact name
    const firstName = billingContact.first_name || '';
    const lastName = billingContact.last_name || '';
    billingContactName = [firstName, lastName].filter(Boolean).join(' ');
    
    // Extract contact items (email, phone) if available
    if (Array.isArray(billingContact.contact_items)) {
      billingContact.contact_items.forEach(item => {
        if (item.contact_type === 'email') {
          billingContactEmail = item.contact_val || '';
        } else if (item.contact_type === 'phone' || item.contact_type === 'phone_mob') {
          // If we already have a phone number, add this as a secondary one
          if (billingContactPhone) {
            billingContactPhone += `, ${item.contact_val}`;
          } else {
            billingContactPhone = item.contact_val || '';
          }
        }
      });
    }
  }
  
  // Prepare the update object with all contact fields
  const updateFields = {
    'Site Contact Name': siteContactName,
    'Site Contact Email': siteContactEmail,
    'Site Contact Phone': siteContactPhone,
    'Main Contact Name': mainContactName,
    'Main Contact Email': mainContactEmail,
    'Main Contact Phone': mainContactPhone,
    'Billing Contact Name': billingContactName,
    'Billing Contact Email': billingContactEmail,
    'Billing Contact Phone': billingContactPhone
  };
  
  console.log('Updating records with the following contact information:');
  console.log(JSON.stringify(updateFields, null, 2));
  
  // Update each matching record in Airtable
  let updatedCount = 0;
  
  for (const record of records) {
    try {
      await airtableBase('Invoices').update(record.id, updateFields);
      updatedCount++;
      console.log(`Updated record ${record.id}`);
    } catch (error) {
      console.error(`Error updating record ${record.id}:`, error.message);
    }
  }
  
  console.log(`Successfully updated ${updatedCount} of ${records.length} records`);
}

// Main execution
// Get job IDs from command line argument or run for all jobs
const jobsArg = process.argv[2];
const specificJobIds = jobsArg ? jobsArg.split(',') : null;

// Run the function
batchUpdateJobContacts(specificJobIds)
  .then(() => console.log('Batch update process completed!'))
  .catch(err => console.error('Error in batch update process:', err)); 