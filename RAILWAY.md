# Railway Deployment Guide

This guide explains how to deploy the Fergus to Airtable sync script to Railway for automatic syncing.

## What This Does

This sync script:
1. Runs every 15 minutes
2. Checks for recently modified jobs in Fergus
3. Updates the contact information in Airtable for these jobs
4. Works perfectly with your Make.com integration that adds new jobs from Xero

## Setup Steps

1. **Create a Railway Account**
   - Go to [Railway.app](https://railway.app/) and sign up

2. **Create a New Project**
   - Click "New Project"
   - Select "Deploy from GitHub"
   - Connect to GitHub and select your repository

3. **Configure Environment Variables**
   - Go to the "Variables" tab
   - Add the following variables:
     - `AIRTABLE_API_KEY`: Your Airtable API key
     - `AIRTABLE_BASE_ID`: Your Airtable base ID (appjw6JtyNF1ph0Dg)
     - `FERGUS_COOKIES`: Your Fergus cookies for authentication

4. **Deploy the Project**
   - Railway will automatically detect the railway.json configuration
   - It will build and deploy the project

5. **Verify It's Working**
   - Check the "Deployments" tab for logs
   - You should see the script running every 15 minutes

## Maintenance

- **Updating Fergus Cookies**: Fergus cookies will expire eventually (typically after a few weeks). When that happens, you'll need to:
  1. Get new cookies by logging into Fergus in your browser
  2. Update the `FERGUS_COOKIES` environment variable in Railway

- **Checking Logs**: You can view logs in the Railway dashboard to verify the sync is working correctly

## Troubleshooting

- **Script Not Running**: Check that the schedule-sync.js is being executed correctly
- **No Updates**: Make sure your Fergus cookies are valid
- **API Errors**: Verify that your Airtable API key and base ID are correct

## Related Documentation

- [Railway Deployment Docs](https://docs.railway.app/)
- [Airtable API Documentation](https://airtable.com/developers/web/api/introduction) 