/**
 * Scheduled Fergus to Airtable Sync
 * =================================
 * 
 * This script schedules the Fergus to Airtable sync to run at regular intervals.
 * It uses the node-cron library to schedule the sync to run on a specified schedule.
 * 
 * Installation:
 * 1. Install node-cron: npm install node-cron
 * 2. Make sure your .env file has valid Airtable and Fergus credentials
 * 3. Run this script with: node schedule-fergus-sync.js
 * 
 * Note: This script will keep running in the background until stopped.
 * For more permanent deployment, consider:
 * - Using PM2: pm2 start schedule-fergus-sync.js
 * - Using a system service (systemd on Linux)
 * - Using a scheduled task (cron on Linux, Task Scheduler on Windows)
 */

const cron = require('node-cron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Schedule configuration - edit these values as needed
const config = {
  // Default: Run every day at 1:00 AM
  schedule: process.env.SYNC_SCHEDULE || '0 1 * * *',
  
  // Whether to run immediately on script start
  runOnStart: process.env.RUN_ON_START === 'true' || false,
  
  // Path to the main sync script
  syncScript: path.join(__dirname, 'sync-all-fergus-data.js'),
  
  // Log file path
  logFile: path.join(__dirname, 'fergus-sync-logs.txt')
};

// Function to append to log file
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Log to console
  console.log(logMessage.trim());
  
  // Append to log file
  fs.appendFileSync(config.logFile, logMessage);
}

// Function to run the sync script
function runSync() {
  logToFile('Starting Fergus to Airtable sync...');
  
  try {
    // Execute the sync script and capture output
    const output = execSync(`node "${config.syncScript}"`, { encoding: 'utf8' });
    logToFile('Sync completed successfully!');
    logToFile(`Output: ${output.replace(/\n/g, '\n  ')}`);
  } catch (error) {
    logToFile(`Sync failed with error: ${error.message}`);
    if (error.stdout) {
      logToFile(`stdout: ${error.stdout.replace(/\n/g, '\n  ')}`);
    }
    if (error.stderr) {
      logToFile(`stderr: ${error.stderr.replace(/\n/g, '\n  ')}`);
    }
  }
}

// Initialize log file if it doesn't exist
if (!fs.existsSync(config.logFile)) {
  fs.writeFileSync(config.logFile, '');
}

// Validate the sync script exists
if (!fs.existsSync(config.syncScript)) {
  logToFile(`Error: Sync script not found at ${config.syncScript}`);
  process.exit(1);
}

// Schedule the sync job
logToFile(`Scheduling Fergus to Airtable sync with schedule: ${config.schedule}`);
cron.schedule(config.schedule, runSync);

// Run immediately if configured
if (config.runOnStart) {
  logToFile('Running sync immediately on startup...');
  runSync();
}

logToFile('Scheduler started. Waiting for scheduled execution times...');
logToFile(`Next execution will be at the configured schedule: ${config.schedule}`);

// Keep the process running
process.stdin.resume(); 