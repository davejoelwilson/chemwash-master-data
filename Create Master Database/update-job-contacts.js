/**
 * update-job-contacts.js
 * 
 * This script looks up a job by its NW-number in Airtable and updates
 * the contact information fields using data from Fergus.
 * 
 * Usage: node update-job-contacts.js NW-21491
 */

const api = require('./direct-fergus-api');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Get Airtable base from the API module
const airtableBase = api.airtableBase;

async function updateJobContactsInAirtable(jobId) {
  try {
    console.log(`Looking up job ${jobId} in Airtable...`);
    
    // First, find the record in Airtable using the Job ID
    const records = await airtableBase('Invoices')
      .select({
        filterByFormula: `{Job} = '${jobId}'`
      })
      .firstPage();
    
    if (!records || records.length === 0) {
      console.log(`No records found in Airtable for job ${jobId}`);
      return;
    }
    
    console.log(`Found ${records.length} records in Airtable for job ${jobId}`);
    
    // Remove the "NW-" prefix if present to get the numeric ID for Fergus
    const numericId = jobId.replace('NW-', '');
    
    // Get the detailed job data from Fergus
    console.log(`Fetching detailed job data from Fergus for ${numericId}...`);
    const detailedJob = await api.getDetailedJobData(numericId);
    
    if (!detailedJob) {
      console.log(`No detailed data found in Fergus for job ${jobId}`);
      
      // Try alternative method
      console.log("Trying alternative job data lookup...");
      const jobWithInvoices = await api.fetchJobWithInvoices(numericId, { saveToFile: true });
      
      if (!jobWithInvoices || jobWithInvoices.result !== 'success') {
        console.log(`Could not find job data in Fergus for ${jobId}`);
        return;
      }
      
      const jobData = jobWithInvoices.value?.jobCard?.job;
      if (!jobData) {
        console.log(`No job data available in the response for ${jobId}`);
        return;
      }
      
      // Process with this data instead
      await updateAirtableRecordsWithJobData(records, jobData);
      return;
    }
    
    // Update Airtable records with the contact information
    await updateAirtableRecordsWithJobData(records, detailedJob);
    
  } catch (error) {
    console.error('Error updating job contacts:', error.message);
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

// Main execution - get job ID from command line argument
const jobId = process.argv[2] || 'NW-21491'; // Default to the requested job ID if none provided

// Run the function
updateJobContactsInAirtable(jobId)
  .then(() => console.log('Done!'))
  .catch(err => console.error('Error:', err)); 