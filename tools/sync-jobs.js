const { main: authenticate } = require('./authenticate-fergus');
const { FergusAirtableSync } = require('./fergus-airtable-sync');
require('dotenv').config();

async function main() {
  try {
    console.log('Starting Fergus to Airtable sync process...');
    
    // First, get authentication cookies
    console.log('Authenticating with Fergus...');
    const cookies = await authenticate();
    
    if (!cookies) {
      throw new Error('Failed to obtain authentication cookies');
    }
    
    // Initialize sync client
    const syncClient = new FergusAirtableSync();
    syncClient.cookies = cookies;
    
    // Run sync process
    console.log('Starting job sync...');
    await syncClient.syncJobsToAirtable();
    
    console.log('Sync process completed successfully!');
  } catch (error) {
    console.error('Error in sync process:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 