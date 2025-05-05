# Create Master Database

This folder contains scripts for creating and maintaining a master database in Airtable by syncing data from Fergus.

## Customer Data Structure

The ChemWash business data contains two key customer types that have different contact structures:

### Consumer Customers
- These are individuals getting their own homes washed
- The customer name, site address, and billing address are typically the same
- Example: John Meyer at 37 Gilfillan Street
- In this case, the site contact and main contact are usually the same person
- Contact emails and phone numbers are consistent across contacts

### Commercial/Property Management Customers
- These are businesses (like Ray White) managing properties for their clients
- The customer name is the business (e.g., "Ray White Yellow Group Property Management Limited")
- The site contact is often the tenant or property occupant (different person)
- The main contact is typically the property manager
- Multiple email addresses and phone numbers may be present
- The site address (property being washed) differs from the business address
- In these cases, you're essentially dealing with the "customer's customer"

This distinction affects how contact data should be structured in Airtable, as you'll need to accommodate both scenarios.

## Available Scripts

### 1. Automated Sync Scripts (NEW)

These scripts allow you to automatically keep your Airtable updated with the latest data from Fergus without manual intervention.

#### recent-jobs-sync.js

This script checks for recently modified jobs in Fergus and updates their contact information in Airtable. It's designed to run periodically (e.g., every 15 minutes) to keep your data synchronized.

**Usage:**
```
# Run with default 15-minute window
node recent-jobs-sync.js

# Or specify a custom time window (e.g., 60 minutes)
node recent-jobs-sync.js 60
```

The script will:
- Fetch jobs modified in the last X minutes from Fergus
- Check if each job exists in Airtable
- Update the contact information for matching records
- Skip jobs that don't exist in Airtable
- Log the results to the console

#### schedule-sync.js

This script automatically runs the recent-jobs-sync.js script every 15 minutes to ensure your Airtable stays up-to-date with Fergus.

**Usage:**
```
# Start the scheduled sync
node schedule-sync.js

# Press Ctrl+C to stop the scheduler
```

The script will:
- Run the sync immediately on startup
- Schedule automatic runs every 15 minutes
- Log all output to the logs directory
- Continue running until manually stopped

This is perfect for integrating with the Make.com scenario you described. Make.com adds new jobs/invoices to Airtable, and this script fills in the contact details from Fergus automatically.

### 2. update-airtable-row.js

This script updates or creates (upsert) a row in Airtable with job and contact information from Fergus. It finds existing records by job ID and updates them, or creates a new record if none exists.

**Usage:**
```
# Update/create a single job
node update-airtable-row.js NW-21255
```

The script will:
- Fetch detailed job data from Fergus
- Extract all contact information (site, main, billing)
- Check if a record with the job ID already exists in Airtable
- Update the existing record or create a new one
- Display a summary of the process

This is the recommended script for manually updating Airtable with the latest data from Fergus. It prevents duplicate records and keeps your Airtable data in sync.

### 3. fetch-job-data.js

This script fetches data from Fergus for one or more jobs, without making any changes to Airtable. Use this to verify what data is available in Fergus.

**Usage:**
```
# Fetch a single job
node fetch-job-data.js NW-21491

# Fetch multiple jobs
node fetch-job-data.js NW-21491,NW-21492,NW-21493
```

The script will:
- Fetch detailed job data from Fergus
- Save the complete JSON data to `output/job-data-NW-21491.json`
- Display a summary of the contact information in the console

### 4. check-airtable-data.js

This script checks what data is already in Airtable for a specific job or invoice. Use this to see the current state before making updates.

**Usage:**
```
# Search by job number
node check-airtable-data.js job NW-21491

# Search by invoice number
node check-airtable-data.js invoice INV-34111
```

The script will:
- Search Airtable for matching records
- Save the Airtable data to `output/airtable-job-NW-21491.json`
- Display a summary of the fields in each matching record

### 5. batch-update-contacts.js

This script updates contact information for multiple jobs at once. It can process all jobs in your Airtable or a specific list of job numbers.

**Usage:**
```
# Update all jobs in the Airtable
node batch-update-contacts.js

# Update specific jobs only
node batch-update-contacts.js NW-21491,NW-21492,NW-21493
```

The script will:
- Fetch records from Airtable (all or specific jobs)
- Group records by Job ID
- For each job, fetch detailed data from Fergus
- Update all matching records with contact information
- Save job data JSON files to the output directory
- Display a summary of successful and failed updates

### 6. fergus-data-only.js

This standalone script fetches data directly from Fergus without requiring Airtable credentials. Use this for testing what data is available before setting up the Airtable connection.

**Usage:**
```
node fergus-data-only.js NW-21255
```

The script will:
- Connect directly to the Fergus API
- Save the complete job data to the output directory
- Display a summary of all contact information

## Requirements

All scripts require:
- A valid `.env` file with Airtable and Fergus credentials (except fergus-data-only.js)
- The `direct-fergus-api.js` module (with up-to-date Fergus cookies)
- Node.js installed

Make sure your Airtable has the required contact fields added to the table before running the update scripts.

## Recommended Workflow

1. **Initial Setup:**
   - Use `fergus-data-only.js` or `fetch-job-data.js` to check what data is available in Fergus for a job
   - Use `check-airtable-data.js` to see what's currently in your Airtable
   - Update your Airtable schema if needed to accommodate both consumer and commercial customer types

2. **One-Time Bulk Update:**
   - Use `batch-update-contacts.js` to update all existing jobs in Airtable with contact information

3. **Automated Integration:**
   - Setup your Make.com scenario to add new invoices from Xero to Airtable
   - Run the `schedule-sync.js` script to automatically fill in contact details for new jobs every 15 minutes

This setup ensures that all new invoices in Xero will be added to Airtable via Make.com, and the contact details will be automatically filled in from Fergus shortly afterward.

## Airtable Field Recommendations

When designing your Airtable structure, consider including:

1. **Job Information**
   - Job ID (NW-xxxxx)
   - Job Type
   - Job Status
   - Invoice Number

2. **Site Information**
   - Site Address (full address of the property being serviced)
   - Site Contact Name
   - Site Contact Email(s)
   - Site Contact Phone(s)

3. **Customer Information**
   - Customer Name (individual or business name)
   - Customer Type (consumer/commercial)
   - Billing Address
   - Main Contact Name
   - Main Contact Email(s)
   - Main Contact Phone(s)

This structure will handle both consumer cases (where site = customer) and commercial cases (where the property management company is the customer but the site is elsewhere). 