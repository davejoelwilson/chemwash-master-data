/**
 * This script adds the new address-related fields to the Airtable table.
 * Run this script before running the main sync to make sure the fields exist.
 */
require('dotenv').config();
const Airtable = require('airtable');

// Initialize Airtable
const airtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

/**
 * Main function to add fields to Airtable
 */
async function addFieldsToAirtable() {
  try {
    console.log('Checking current Airtable schema...');
    
    // Get a sample record to see what fields already exist
    const sampleRecords = await airtableBase('Jobs')
      .select({ maxRecords: 1 })
      .firstPage();
    
    if (!sampleRecords || sampleRecords.length === 0) {
      console.log('No records found in the Jobs table. Create at least one record first.');
      return;
    }
    
    const existingFields = Object.keys(sampleRecords[0].fields);
    console.log(`Found ${existingFields.length} existing fields:`);
    console.log(existingFields);
    
    // Check which fields we need to add
    const newFields = [
      'Suburb',
      'City', 
      'Billing Address'
    ];
    
    const missingFields = newFields.filter(field => !existingFields.includes(field));
    
    if (missingFields.length === 0) {
      console.log('All required fields already exist in the table!');
      return;
    }
    
    console.log(`Need to add ${missingFields.length} missing fields: ${missingFields.join(', ')}`);
    
    // Note: Unfortunately, the Airtable API doesn't allow adding fields programmatically
    // You need to use the Airtable web interface to add these fields
    
    console.log('\nPlease add the following fields to your Airtable table manually:');
    missingFields.forEach(field => {
      console.log(`- ${field} (Text type)`);
    });
    
    console.log('\nInstructions to add fields in Airtable:');
    console.log('1. Go to your Airtable base in the web browser');
    console.log('2. Click on the "+" icon at the end of the column headers');
    console.log('3. Name the field as shown above');
    console.log('4. Select "Single line text" as the field type');
    console.log('5. Repeat for each missing field');
    console.log('\nAfter adding the fields, run the main sync script again.');
    
    // Create a test record to verify fields (optional)
    if (process.argv.includes('--create-test')) {
      console.log('\nCreating a test record to verify fields...');
      
      const testRecord = {
        'Job ID': 'TEST-' + Date.now(),
        'Customer Name': 'Test Customer',
        'Description': 'Test Description',
        'Job Type': 'Test',
        'Job Status': 'Test',
        'Site Address': '123 Test St, Test Suburb, Test City',
      };
      
      // Add the new fields if they exist
      missingFields.forEach(field => {
        if (field === 'Suburb') testRecord['Suburb'] = 'Test Suburb';
        if (field === 'City') testRecord['City'] = 'Test City';
        if (field === 'Billing Address') testRecord['Billing Address'] = '456 Billing St, Billing Suburb, Billing City';
      });
      
      try {
        const result = await airtableBase('Jobs').create(testRecord);
        console.log('Test record created with ID:', result.id);
        console.log('Fields in test record:', Object.keys(result.fields));
      } catch (error) {
        if (error.message.includes('Unknown field name')) {
          console.log('Failed to create test record - fields do not exist yet');
          console.log('Please add the fields in Airtable first');
        } else {
          console.error('Error creating test record:', error.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
addFieldsToAirtable().catch(console.error); 