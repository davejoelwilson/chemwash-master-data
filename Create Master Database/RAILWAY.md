# Railway Deployment Guide for Contact Sync

This guide shows how to deploy the Fergus to Airtable contact sync script to Railway for automatic syncing.

## How This Works

1. The `recent-jobs-sync.js` script checks for jobs modified in the last 15 minutes
2. For each job, it checks if existing Airtable records need contact information
3. If contact fields are empty (Site Address, Contact Name, etc.), it fetches and updates them
4. The `schedule-sync.js` script runs this process every 15 minutes automatically

## IMPORTANT: Incremental Sync Only

When deployed to Railway, the script will automatically run in **production mode**, which means:

- It will **ONLY** process jobs modified in the last 15 minutes
- It will **NOT** run a full sync of all jobs
- It will only update records that have missing contact information
- This ensures efficient operation without duplicating work

## What You Need

- A Railway account (free or paid)
- Your Airtable API key
- Your Airtable base ID (appjw6JtyNF1ph0Dg)
- Fergus cookies for authentication

## Setup Steps

1. **Create a Railway Account**
   - Sign up at [railway.app](https://railway.app/)

2. **Create a New Project**
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Connect to your GitHub account and select this repository

3. **Configure Environment Variables**
   - Go to the "Variables" tab in your Railway project
   - Add these variables:
     ```
     AIRTABLE_API_KEY=your_airtable_api_key_here
     AIRTABLE_BASE_ID=appjw6JtyNF1ph0Dg
     ```
   - The Fergus cookies are already in the code, but you may need to update them periodically

4. **Set Up the Service**
   - Go to the "Settings" tab
   - Set the start command to: `node Create\ Master\ Database/schedule-sync.js`
   - Set the root directory to `/`

5. **Deploy**
   - Railway will automatically deploy your project
   - The script will detect it's running on Railway and set NODE_ENV=production
   - Only jobs modified in the last 15 minutes will be synced

## Testing Your Deployment

To test that everything is set up correctly:

1. Go to the "Deployments" tab in Railway
2. Click on your latest deployment
3. Check the logs to ensure the sync script is running
4. Look for "PRODUCTION MODE: Looking for jobs modified in the last 15 minutes"
5. This confirms it's only syncing recent changes, not everything

## Updating Fergus Cookies

Fergus cookies expire every few weeks. When that happens:

1. Log into Fergus in your browser
2. Use Developer Tools to copy the cookies (see direct-fergus-api.js for instructions)
3. Update the `FERGUS_COOKIES` constant in `direct-fergus-api.js`
4. Commit and push the changes to GitHub
5. Railway will automatically redeploy with the new cookies

## Monitoring and Logs

- Railway provides real-time logs of your application
- The sync script creates detailed logs in the `/logs` directory
- Each sync run is recorded with timestamp, success/failure info, and more

## Troubleshooting

- **Script Not Running**: Check Railway logs for errors
- **Authentication Errors**: Your Fergus cookies may have expired
- **Airtable Errors**: Verify your API key and base ID are correct
- **No Updates**: Check if records already have contact info or if no jobs were modified recently 