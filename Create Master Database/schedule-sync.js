/**
 * schedule-sync.js
 * 
 * This script schedules the recent-jobs-sync.js file to run every 15 minutes.
 * It's designed to be started once and keep running, performing regular syncs.
 * 
 * Usage:
 * - node schedule-sync.js
 * - To run once for testing: node schedule-sync.js --once
 * - For production: NODE_ENV=production node schedule-sync.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Constants
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const SYNC_SCRIPT_PATH = path.join(__dirname, 'recent-jobs-sync.js');
const LOG_DIR = path.join(__dirname, '..', 'logs');

// Check if we should run just once (for testing)
const runOnce = process.argv.includes('--once');

// Check if we're running on Railway
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.RAILWAY_SERVICE_ID;

// Always set production mode when running on Railway
if (isRailway && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
  console.log('Running on Railway - setting NODE_ENV=production');
}

// Log the current environment
console.log(`Current NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`Running on Railway: ${isRailway ? 'Yes' : 'No'}`);

/**
 * Runs the sync script as a child process
 */
async function runSyncScript() {
  try {
    // Create logs directory if it doesn't exist
    await fs.mkdir(LOG_DIR, { recursive: true });
    
    // Create log file name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(LOG_DIR, `sync-${timestamp}.log`);
    
    // Open log file for writing
    const logStream = fs.createWriteStream(logFile);
    
    console.log(`Running sync script at ${new Date().toISOString()}`);
    console.log(`Logging output to ${logFile}`);
    
    // Set environment variables for the child process
    const env = {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || (isRailway ? 'production' : 'development')
    };
    
    // Spawn the sync script as a child process
    const syncProcess = spawn('node', [SYNC_SCRIPT_PATH], {
      stdio: ['ignore', 'pipe', 'pipe'], // Redirect stdout and stderr
      env
    });
    
    // Pipe output to console and log file
    syncProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      logStream.write(output);
    });
    
    syncProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(output);
      logStream.write(output);
    });
    
    // Handle process completion
    return new Promise((resolve, reject) => {
      syncProcess.on('close', (code) => {
        console.log(`Sync process exited with code ${code}`);
        logStream.end();
        resolve(code);
      });
      
      syncProcess.on('error', (error) => {
        console.error(`Error starting sync process: ${error.message}`);
        logStream.end();
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Error in runSyncScript: ${error.message}`);
    return 1;
  }
}

/**
 * Main scheduler function
 */
async function startScheduler() {
  console.log('=== Fergus to Airtable Contact Sync Scheduler ===');
  console.log(`Sync interval: ${SYNC_INTERVAL_MS / 1000 / 60} minutes`);
  
  if (runOnce) {
    console.log('Running once for testing...');
    await runSyncScript();
    console.log('Test run completed.');
    return;
  }
  
  // Run immediately on start
  await runSyncScript();
  
  // Then set up the interval timer
  console.log(`Scheduling next sync in ${SYNC_INTERVAL_MS / 1000 / 60} minutes...`);
  
  // Set up interval to run the sync periodically
  setInterval(async () => {
    try {
      await runSyncScript();
      console.log(`Scheduling next sync in ${SYNC_INTERVAL_MS / 1000 / 60} minutes...`);
    } catch (error) {
      console.error(`Error running scheduled sync: ${error.message}`);
    }
  }, SYNC_INTERVAL_MS);
  
  console.log('Scheduler is running. Press Ctrl+C to stop.');
}

// Start the scheduler when run directly
if (require.main === module) {
  startScheduler()
    .catch(error => {
      console.error(`Error in scheduler: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runSyncScript }; 