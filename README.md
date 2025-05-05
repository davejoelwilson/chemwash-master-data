# ChemWash Fergus Integration

Data integration between Fergus and Airtable for ChemWash.

## Environment Variables

You need to set these environment variables:

- `AIRTABLE_API_KEY` - Your Airtable API key
- `AIRTABLE_BASE_ID` - Your Airtable base ID
- `AIRTABLE_TABLE_NAME` - Your Airtable table name (defaults to 'Master List Sonya')

## Running Locally

```
npm install
npm run update-batch  # Run with --limit=100
npm run update-all    # Run without limits
```

## Deployment to Railway

1. Create a new project on Railway
2. Connect your GitHub repository
3. Add the environment variables
4. Railway will automatically deploy your app

## Important Note

The Fergus cookies are hardcoded in the script. If they expire, you'll need to update them and redeploy.

## Quick Start

1. Make sure your `.env` file has the necessary credentials:
   ```
   AIRTABLE_API_KEY=your_api_key
   AIRTABLE_BASE_ID=your_base_id
   FERGUS_COOKIE=your_fergus_cookie
   ```

2. Choose how to run the sync:
   - Run all steps: `node run-all-sync.js`
   - Run individual steps:
     - Step 1: `node 1.sync-active-jobs.js`
     - Step 2: `node 2.sync-pipeline-jobs.js`
     - Step 3: `node 3.sync-invoices.js`

## Core Files

- `1.sync-active-jobs.js` - Syncs active jobs (IN PROGRESS, SCHEDULING, PAYMENTS, etc.)
- `2.sync-pipeline-jobs.js` - Syncs jobs from all pipeline stages visible in the board view
- `3.sync-invoices.js` - Syncs invoices for all jobs
- `run-all-sync.js` - Runs all three steps in sequence
- `direct-fergus-api.js` - Core API functionality used by all scripts

## Features

- **Optimized Performance**: All sync scripts use batch processing and parallel requests
- **Upsert Support**: Records are created or updated as needed, never duplicated
- **Incremental Syncing**: Only fetches new data when possible
- **Detailed Logging**: Each sync generates detailed logs and statistics
- **Reliable Error Handling**: Each script handles errors gracefully

## How to Schedule

For automated syncing, you can use the system scheduler:

### macOS/Linux (cron)
```bash
# Run sync every hour
0 * * * * cd /path/to/fergus && node run-all-sync.js >> sync.log 2>&1
```

### Windows (Task Scheduler)
Create a scheduled task that runs `run-all-sync.js` at your desired interval.

## Troubleshooting

If any part of the sync fails:

1. Check the corresponding JSON log file (e.g., `active-jobs-sync-info.json`)
2. Run only the failing component (e.g., `node 2.sync-pipeline-jobs.js`)
3. Check the Fergus cookie is still valid (they expire periodically)

## Development

- Each sync script is independent and can be modified without affecting others
- Add new sync components by creating a new numbered script
- Core API functionality should be added to `direct-fergus-api.js`

## Project Structure

```
.
├── direct-fergus-api.js     # Main API integration and core functions
├── sync-all-fergus-data.js  # Comprehensive sync script for all data
├── test-pipeline-jobs.js    # Test script for pipeline jobs
├── schedule-fergus-sync.js  # Scheduler for automated syncing
├── sync-fergus-invoices.js  # Invoice-specific syncing
├── incremental-sync.js      # Efficient incremental sync script
├── deploy/                  # Deployment configurations
│   ├── docker/              # Docker deployment files
│   └── scripts/             # Deployment scripts (systemd, cron, etc.)
├── docs/                    # Documentation
│   ├── CHANGELOG.md         # Version history and changes
│   ├── fergus-api-documentation.md # API reference
│   ├── invoice-handling.md  # Invoice syncing details
│   └── ...                  # Other documentation files
├── test/                    # Test scripts
├── output/                  # Sample data and debug information
└── tools/                   # Utility and legacy tools
```

## Features

- Comprehensive job data synchronization from all pipeline stages
- Invoice and works order detection and syncing
- Status tracking and history
- Intelligent prioritization of jobs for invoice checking
- Concurrent processing for improved performance
- Automated scheduling with customizable intervals

## Scripts

### 1. Comprehensive Sync (`sync-all-fergus-data.js`)

This script performs a complete synchronization of all jobs from every pipeline stage and all invoices from Fergus to Airtable.

**Best for:**
- Initial data population
- Complete syncing of all pipeline stages
- When you need ALL data including jobs across all statuses

**Usage:**
```
node sync-all-fergus-data.js
```

### 2. Automated Sync Scheduler (`schedule-fergus-sync.js`)

This script schedules the comprehensive sync to run automatically at configured intervals.

**Best for:**
- Setting up automated recurring syncs
- Ensuring regular data updates without manual intervention
- Long-running deployments

**Usage:**
```
# Install dependency first
npm install node-cron

# Run scheduler (stays running until stopped)
node schedule-fergus-sync.js
```

### 3. Pipeline Jobs Sync (`test-pipeline-jobs.js`)

This script focuses specifically on fetching and syncing jobs from all pipeline stages visible in the Fergus status board (PENDING, PRICING, SCHEDULING, etc.).

**Best for:**
- Testing pipeline job fetching
- When you only need jobs from specific pipeline stages
- Troubleshooting pipeline-specific issues

**Usage:**
```
node test-pipeline-jobs.js
```

### 4. Invoice Sync (`sync-fergus-invoices.js`)

This script specifically focuses on finding and syncing invoices and works orders.

**Best for:**
- Ensuring complete invoice data is captured
- Invoice-specific troubleshooting
- When you need detailed invoice information

**Usage:**
```
npm run sync-invoices
```

### 5. Incremental Sync (`incremental-sync.js`)

This script performs an efficient incremental sync, only processing jobs and invoices that have changed since the last run.

**Best for:**
- Daily updates
- Frequent syncs
- Minimizing API usage
- Faster execution

**Usage:**
```
npm start
```

## Setup

1. Create `.env` file with your Airtable credentials:
```
AIRTABLE_API_KEY=key...
AIRTABLE_BASE_ID=app...
```

2. Update the Fergus cookies in the direct-fergus-api.js script when they expire (typically every few weeks).

3. Set up a scheduled task to run the sync:
   - For automated scheduling, use the `schedule-fergus-sync.js` script
   - For manual scheduling, set up a cron job or task scheduler

## Deployment Options

Multiple deployment options are available:

- **Scheduler**: Run `node schedule-fergus-sync.js` with PM2 or as a service
- **Docker**: See `deploy/docker/` and `deploy/RAILWAY.md`
- **Systemd**: See `deploy/scripts/fergus-sync.service`
- **Cron**: See `deploy/scripts/fergus-cron`
- **Windows**: See `deploy/scripts/run-sync.bat`

## Recommended Sync Strategy

For optimal results:
- Run `sync-all-fergus-data.js` daily (e.g., overnight at 2am) using the scheduler
- Alternatively:
  - Run `incremental-sync.js` daily for regular updates
  - Run `sync-fergus-invoices.js` 2-3 times weekly
  - Run `sync-all-fergus-data.js` weekly as a complete refresh

This ensures your Airtable stays in sync with minimal API usage while still maintaining complete data coverage.

## Documentation

See the `docs/` directory for detailed documentation:

- [Changelog](docs/CHANGELOG.md) - Version history and updates
- [API Documentation](docs/fergus-api-documentation.md) - Detailed API reference
- [Invoice Handling](docs/invoice-handling.md) - Guide to invoice detection and syncing

## Troubleshooting

- If you encounter 401 errors, your Fergus cookies have expired and need to be updated
- If you hit rate limits, adjust the concurrency and delay settings in the scripts
- Check `output/` directory for sample data and troubleshooting information
- Look for debug files like `all-pipeline-jobs.json` and `sample-data-response.json` 