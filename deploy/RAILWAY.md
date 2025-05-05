# Deploying to Railway

This guide explains how to deploy the Fergus-to-Airtable sync service on Railway.

## Prerequisites

1. A [Railway](https://railway.app/) account
2. Your Airtable API key and Base ID
3. Updated Fergus cookies in the incremental-sync.js file

## Deployment Steps

### 1. Fork or Clone this Repository

First, fork or clone this repository to your GitHub account.

### 2. Connect to Railway

1. Log in to your Railway account
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Find and select your forked/cloned repository
5. Railway will automatically detect the Dockerfile

### 3. Configure Environment Variables

Add the following environment variables in Railway:

- `AIRTABLE_API_KEY`: Your Airtable API key
- `AIRTABLE_BASE_ID`: Your Airtable base ID
- `DOCKER_ENV`: Set to `true`
- `TZ`: Set to your timezone (e.g., `Pacific/Auckland`)

### 4. Deploy

Click "Deploy" and Railway will build and deploy your Docker container.

## Monitoring

- Railway provides logs for your container
- The sync runs at 2 AM daily
- There's also a 5-minute sync for testing that you can remove in production

## Persistent Storage

The sync state is stored in Railway's persistent volume, so it will remember the last sync time even if the container restarts.

## Troubleshooting

1. **Sync not working?** Check the logs in Railway
2. **Fergus API errors?** Your cookies might have expired - update them in the code and redeploy
3. **Container restarts?** Check for any errors in the logs

## Maintenance

The Fergus cookies typically expire every few weeks. When they do:

1. Get new cookies from the Fergus web interface
2. Update them in the incremental-sync.js file
3. Commit and push the changes
4. Railway will automatically redeploy with the new cookies 