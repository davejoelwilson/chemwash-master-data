# Fergus API Documentation

This document provides a comprehensive guide to the Fergus API endpoints discovered through exploration. Note that Fergus does not provide public API documentation, so these endpoints have been identified through browser inspection and analysis.

## Authentication

The Fergus API uses cookie-based authentication. Authentication must be obtained by logging into the Fergus application and capturing the session cookies.

**Required Cookies:**
- `_fergus_session`
- Other session-related cookies

**Authentication Method:**
- Use Playwright to automate browser login
- Save session cookies for reuse
- Refresh authentication when cookies expire

## Known Limitations and Workarounds

### Job Status Filtering

**Limitation:** The `status_board/all_active_jobs` endpoint only returns jobs with statuses like "To Price", "Quote Sent", "Active", and "Quote Rejected". It does not include jobs with status "Completed", "Invoiced", or "Paid".

**Workaround:** To retrieve completed jobs, you must use one of these approaches:
1. Fetch specific jobs by ID using the `jobs/extended_json` endpoint
2. Use the `job_card/load_from_job` endpoint with known job IDs
3. Maintain a list of job IDs in your application that need to be synced even after completion

### API Rate Limiting

**Limitation:** The Fergus API appears to have rate limiting, though no specific documentation is available.

**Workaround:**
1. Add delays (300-500ms) between API calls
2. Use batch processing with concurrency limits
3. Implement exponential backoff for retries

### Incomplete API Documentation

**Limitation:** Fergus does not provide public API documentation, making it challenging to know all available endpoints and their parameters.

**Workaround:**
1. Use browser network inspection to discover endpoints
2. Test different parameter combinations
3. Document findings in this document for future reference

## Core API Endpoints

### Job Status Board API

**Endpoint:** `https://app.fergus.com/api/v2/status_board/all_active_jobs`

**Method:** POST

**Request Body:**
```json
{
  "page": 1,
  "page_size": 20,
  "filter": "",
  "selected_group_ids": [],
  "selected_employee_ids": []
}
```

**Response Structure:**
```json
{
  "value": [
    {
      "id": 29615,
      "internal_id": "NW-29615",
      "brief_description": "PONSONBY",
      "job_status": "Quote Sent",
      "customer_full_name": "Chemwash - Glen Eden",
      "site_address": "11 Norfolk Street, Ponsonby, Auckland 1021",
      "created_at": "2023-04-03T21:08:05Z",
      "job_type_name": "Quote",
      // ... additional fields
    }
    // ... additional jobs
  ],
  "paging": {
    "total_pages": 15,
    "current_page": 1
  }
}
```

**Primary Use:** Get a list of all active jobs with pagination support.

> **IMPORTANT LIMITATION:** This endpoint only returns jobs with active statuses like "To Price", "Quote Sent", "Active", and "Quote Rejected". It does NOT return jobs with status "Completed", "Invoiced", or "Paid". To retrieve completed jobs, you must use the Job Card Details API or Extended Job Information API with specific job IDs.

### Job Card Details API

**Endpoint:** `https://app.fergus.com/api/v2/job_card/load_from_job`

**Method:** POST

**Request Body:**
```json
{
  "job_id": 29615
}
```

**Response Structure:**
```json
{
  "value": {
    "job": {
      "id": 29615,
      "internal_id": "NW-29615",
      "description": "PONSONBY",
      // ... additional job fields
    },
    "customer": {
      "id": 25412,
      "full_name": "Chemwash - Glen Eden",
      "email": "westauckland@chemwash.conz",
      "phone": null,
      "mobile": null,
      // ... additional customer fields
    },
    "site": {
      "id": 26778,
      "full_address": "11 Norfolk Street, Ponsonby, Auckland 1021",
      // ... additional site fields
    },
    "quote": {
      "id": 8942,
      "published_at": "2023-04-03T21:09:52.000+13:00",
      // ... additional quote fields
    },
    // ... additional sections
  }
}
```

**Primary Use:** Get comprehensive information about a specific job, including customer details, site information, and associated quotes.

### Extended Job Information API

**Endpoint:** `https://app.fergus.com/api/v2/jobs/extended_json`

**Method:** GET

**Query Parameters:**
- `internal_job_id`: Internal ID of the job (e.g., "27432")
- `job_id`: Alternative job ID (optional)
- `page`: Additional page context (optional)

**Example:**
```
https://app.fergus.com/api/v2/jobs/extended_json?internal_job_id=27432
```

**Response Structure:**
```json
{
  "result": "success",
  "value": {
    "jobCard": {
      "job": {
        "id": 15946945,
        "status_name": "Completed",
        "job_id": "15946945",
        "customer_id": 5569596,
        "internal_id": "NW-27432",
        "internal_job_id": 27432,
        "brief_description": "Freemans Bay",
        "site_address": {
          "id": 46867565,
          "contact_type": "JOB",
          "address_1": "38 Arthur Street",
          "address_2": "",
          "address_suburb": "Freemans Bay",
          "address_city": "Auckland",
          "address_country": "New Zealand",
          "address_postcode": "1011"
          // ... additional address fields
        },
        // ... additional job fields
      },
      // ... additional sections
    },
    "invoices": [] // Contains invoices if any exist for the job
  }
}
```

**Primary Use:** Get detailed job information including job data, customer details, site information, and invoices if available.

### Customer Invoices API

**Endpoint:** `https://app.fergus.com/api/v2/customer_invoices`

**Method:** GET

**Query Parameters:**
- `page`: Page number for pagination
- `per_page`: Number of results per page

**Response Structure:**
```json
{
  "invoices": [
    {
      "id": 15946945,
      "number": "INV-12345",
      "date": "2023-06-15",
      "status": "Paid",
      "total": 450.0,
      "customer_name": "John Smith",
      // ... additional invoice fields
    },
    // ... additional invoices
  ]
}
```

**Primary Use:** Get a list of customer invoices with pagination.

### Job-Specific Invoice API

**Endpoint:** `https://app.fergus.com/api/v2/customer_invoices/job_card/{invoiceId}`

**Method:** GET

**Example:**
```
https://app.fergus.com/api/v2/customer_invoices/job_card/15946945
```

**Response Structure:**
```json
{
  "invoice": {
    "id": 15946945,
    "number": "INV-12345",
    "date": "2023-06-15",
    "status": "Paid",
    "total": 450.0,
    "customer_name": "John Smith",
    // ... detailed invoice fields
  },
  "job": {
    "id": 15946945,
    "internal_id": "NW-27432",
    // ... job details related to this invoice
  }
}
```

**Primary Use:** Get detailed information about a specific invoice including the associated job.

### Quote Financial Details API

**Endpoint:** `https://app.fergus.com/api/v2/quotes/get_document_totals`

**Method:** POST

**Request Body:**
```json
{
  "quote_id": 8942
}
```

**Response Structure:**
```json
{
  "value": {
    "id": 8942,
    "subtotal": 120.0,
    "total": 138.0,
    "tax": 18.0,
    "line_items": [
      {
        "id": 34829,
        "name": "Brush clean of windows with pure mineral free water (de-Ionised) for a spot free finish",
        "price": 50.0,
        "total": 50.0,
        "tax": 7.5,
        // ... additional line item fields
      },
      {
        "id": 34830,
        "name": "Softwash of house incl external guttering, soffits, walls and foundations",
        "price": 70.0,
        "total": 70.0,
        "tax": 10.5,
        // ... additional line item fields
      }
    ],
    // ... additional financial fields
  }
}
```

**Primary Use:** Get detailed financial information about a specific quote, including line items, pricing, and totals.

## Status Board Endpoints

### Get All Active Jobs
**Endpoint:** `https://app.fergus.com/api/v2/status_board/all_active_jobs`  
**Method:** POST  
**Description:** Returns all active jobs with their current status.  
**Pagination:** Yes, via `page` and `page_size` parameters in request body.  
**Filter Options:** Supports filtering by team/employee IDs.  

### Get Status Board Data
**Endpoint:** `https://app.fergus.com/api/v2/status_board/data`  
**Method:** POST  
**Description:** Returns comprehensive status board data including job IDs, works orders, and invoice information.  
**Key Data Points:** 
- Contains job IDs in different status categories
- Includes `to_invoice` sections with `works_order_ids` and `customer_invoice_ids`
- Can be used to identify jobs that need invoicing or have been invoiced

This endpoint is particularly valuable for invoice detection as it exposes IDs that can be used with the invoice-specific endpoints.

## Invoice-Related Endpoints

### Get Customer Invoices
**Endpoint:** `https://app.fergus.com/api/v2/financials/invoices/{invoice_id}`  
**Method:** GET  
**Description:** Returns detailed information about a specific customer invoice.  
**Parameters:** 
- `invoice_id`: The ID of the customer invoice to fetch

### Get Works Orders
**Endpoint:** `https://app.fergus.com/api/v2/works_orders/{order_id}`  
**Method:** GET  
**Description:** Returns detailed information about a works order (which may later become an invoice).  
**Parameters:** 
- `order_id`: The ID of the works order to fetch

### Alternative Invoice Endpoints
The following endpoints may also provide invoice data depending on the user's permissions:

- `https://app.fergus.com/api/v2/finance/invoices`
- `https://app.fergus.com/api/v2/financials/invoices`
- `https://app.fergus.com/api/v2/customer_invoices/{invoice_id}`

### Get Job with Invoice Details
**Endpoint:** `https://app.fergus.com/api/v2/jobs/extended_json`  
**Method:** GET  
**Description:** Returns detailed job information including associated invoices.  
**Parameters:** 
- `job_id`: The ID of the job to fetch

**Note on Invoices:** Invoice accessibility within the API is highly dependent on user permissions. The most reliable method for finding invoices is:
1. Extract invoice IDs from the status board data endpoint
2. Fetch detailed invoice information using those IDs
3. Check job extended data for additional invoice information

## Job Contact Structure

When working with Fergus jobs, it's important to understand the different types of contacts that can be associated with a job:

### 1. Site Contact / Site Address
The site contact represents the person at the physical job location. This is typically where the work will be performed. 

```javascript
const siteContact = job.site_address;
// Properties include: first_name, last_name, address_1, address_2, address_suburb, address_city, etc.
// Contact info is in contact_items array with items like {contact_type: "phone_mob", contact_val: "021123456"}
```

### 2. Main Contact
The main contact is often the primary person to communicate with about the job. This could be a property manager, maintenance supervisor, or the customer themselves.

```javascript
const mainContact = job.main_contact;
// Similar structure with first_name, last_name, position, and contact_items
```

### 3. Billing Contact
The billing contact is the person who will receive invoices and handle payment for the job. 

```javascript
const billingContact = job.billing_contact;
// Similar structure with first_name, last_name, position, and contact_items
```

### Contact Relationships
Be aware that in some cases:
- The site contact and main contact might be the same person (common in residential jobs)
- The billing contact and main contact might be the same person
- All three contacts might be different people (common in commercial/property management jobs)

When syncing to external systems, it's valuable to capture all three contact types to ensure you have complete communication channels for different aspects of the job.

## Usage Examples

### Getting All Active Jobs

```javascript
const axios = require('axios');

async function getAllActiveJobs(cookies, page = 1, pageSize = 20) {
  const response = await axios.post(
    'https://app.fergus.com/api/v2/status_board/all_active_jobs',
    {
      page: page,
      page_size: pageSize,
      filter: "",
      selected_group_ids: [],
      selected_employee_ids: []
    },
    {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );
  
  return response.data.value || [];
}
```

### Getting Job Card Details

```javascript
async function getJobCardDetails(jobId, cookies) {
  const response = await axios.post(
    'https://app.fergus.com/api/v2/job_card/load_from_job',
    {
      job_id: jobId
    },
    {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );
  
  return response.data.value;
}
```

### Getting Detailed Job Information Using Extended JSON

```javascript
async function getDetailedJobInfo(internalJobId, cookies) {
  // You can use either internal_job_id or job_id
  const response = await axios.get(
    'https://app.fergus.com/api/v2/jobs/extended_json',
    {
      params: {
        internal_job_id: internalJobId,
        job_id: '',
        page: ''
      },
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );
  
  if (response.data.result === 'success') {
    return response.data.value;
  }
  
  return null;
}
```

### Getting Invoices for a Specific Job

```javascript
async function getInvoicesByJobId(invoiceId, cookies) {
  const response = await axios.get(
    `https://app.fergus.com/api/v2/customer_invoices/job_card/${invoiceId}`,
    {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );
  
  return response.data;
}
```

### Getting All Customer Invoices

```javascript
async function getAllCustomerInvoices(cookies, page = 1, perPage = 20) {
  const response = await axios.get(
    'https://app.fergus.com/api/v2/customer_invoices',
    {
      params: {
        page: page,
        per_page: perPage
      },
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );
  
  return response.data.invoices || [];
}
```

### Getting Quote Financials

```javascript
async function getQuoteFinancials(quoteId, cookies) {
  const response = await axios.post(
    'https://app.fergus.com/api/v2/quotes/get_document_totals',
    {
      quote_id: quoteId
    },
    {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );
  
  return response.data.value;
}
```

## API Usage Patterns

### Comprehensive Job and Invoice Sync Workflow

This workflow syncs jobs and their related invoices from Fergus to an external system:

```javascript
async function syncJobsAndInvoices(cookies) {
  // Step 1: Get all active jobs
  const jobs = await getAllActiveJobs(cookies);
  console.log(`Found ${jobs.length} active jobs`);
  
  // Step 2: Also fetch specific completed jobs by ID
  // This is necessary because the all_active_jobs endpoint doesn't return completed jobs
  const completedJobIds = ['17646922', '15946945']; // Add your completed job IDs here
  const completedJobs = [];
  
  for (const jobId of completedJobIds) {
    const job = await getJobDetails(jobId, cookies);
    if (job) {
      completedJobs.push(job);
    }
  }
  
  // Step 3: Process all jobs (both active and completed)
  const allJobs = [...jobs, ...completedJobs];
  console.log(`Processing a total of ${allJobs.length} jobs`);
  
  // Step 4: For each job, get detailed information and sync
  // ...rest of processing...
}

// New function to get completed jobs by ID
async function getJobDetails(jobId, cookies) {
  // Try the extended_json endpoint first
  const response = await axios.get(
    'https://app.fergus.com/api/v2/jobs/extended_json',
    {
      params: {
        job_id: jobId,
        internal_job_id: '',
        page: ''
      },
      headers: { 'Cookie': cookies, 'Content-Type': 'application/json' }
    }
  );
  
  if (response.data?.result === 'success') {
    return response.data.value?.jobCard?.job || null;
  }
  
  // Fallback to the job_card endpoint
  const jobCardResponse = await axios.post(
    'https://app.fergus.com/api/v2/job_card/load_from_job',
    { job_id: jobId },
    { headers: { 'Cookie': cookies, 'Content-Type': 'application/json' } }
  );
  
  return jobCardResponse.data?.value?.job || null;
}
```

### Incremental Sync Workflow

This optimized workflow syncs only jobs and invoices that have changed since the last run:

```javascript
async function incrementalSync() {
  // Step 1: Get the last sync time
  const lastSync = await getLastSyncTime();
  
  // Step 2: Get jobs modified since last sync using If-Modified-Since header
  const modifiedJobs = await fetchRecentlyModifiedJobs(lastSync);
  
  // Step 3: Get jobs created since last sync using created_at filter
  const newJobs = await fetchJobsCreatedSince(lastSync);
  
  // Step 4: Combine and remove duplicates
  const allJobs = [...modifiedJobs];
  for (const job of newJobs) {
    if (!allJobs.some(j => j.internal_id === job.internal_id)) {
      allJobs.push(job);
    }
  }
  
  // Step 5: For each job, get detailed information
  // This step is CRITICAL - the data from status_board API lacks complete information
  for (const job of allJobs) {
    // Get job ID
    const jobId = job.id || job.job_id || job.internal_id.replace('NW-', '');
    
    // Get detailed job information using extended_json endpoint
    const detailedJob = await fetchJobById(jobId);
    
    // Process and sync job with complete information
    await addJobToAirtable(job, detailedJob);
  }
  
  // Step 6: Check for invoices on jobs with specific statuses
  const invoiceStatusJobs = allJobs.filter(job => 
    ['Completed', 'Invoiced', 'Won', 'Paid'].includes(job.job_status)
  );
  
  // Step 7: Sync invoices for relevant jobs
  for (const job of invoiceStatusJobs) {
    await syncJobInvoicesToAirtable(job.id);
  }
  
  // Step 8: Save current time as last sync time
  await saveLastSyncTime();
}

// Function to fetch jobs with If-Modified-Since header
async function fetchRecentlyModifiedJobs(sinceDate) {
  const headers = {
    ...defaultHeaders,
    'If-Modified-Since': new Date(sinceDate).toUTCString()
  };
  
  // Use the status_board/all_active_jobs endpoint with the modified header
  const response = await axios.post(url, { /* pagination params */ }, { headers });
  return response.data.value || [];
}
```

This incremental approach is significantly more efficient than full sync for frequent operations.

### Quote Follow-Up Workflow

This workflow combines multiple API endpoints to create a list of quotes that need follow-up:

1. Use the Job Status Board API to get all jobs with "Quote Sent" status
2. For each job, use the Job Card API to get detailed customer information
3. Use the Quote Financial Details API to get the quote value and services
4. Combine the data to create a comprehensive follow-up list

```javascript
async function generateQuoteFollowUpList(cookies) {
  // Get all jobs with "Quote Sent" status
  const jobs = await getAllActiveJobs(cookies);
  
  // Process each job
  const followUpList = [];
  for (const job of jobs) {
    // Get detailed job information
    const jobDetails = await getJobCardDetails(job.id, cookies);
    
    // Get quote financials
    const quoteId = jobDetails.quote.id;
    const quoteFinancials = await getQuoteFinancials(quoteId, cookies);
    
    // Create follow-up entry
    followUpList.push({
      jobNumber: job.internal_id,
      customerName: job.customer_full_name,
      siteAddress: job.site_address,
      quoteSentDate: jobDetails.quote.published_at,
      description: job.description,
      contactEmail: jobDetails.customer.email,
      contactPhone: jobDetails.customer.mobile || jobDetails.customer.phone || "No phone",
      followUpStatus: "Pending",
      jobLink: `https://app.fergus.com/jobs/view/${job.id}`,
      quoteTotal: quoteFinancials.total,
      services: quoteFinancials.line_items.map(item => item.name)
    });
  }
  
  return followUpList;
}
```

## Best Practices

### Authentication Management

- Store session cookies securely
- Implement automatic re-authentication when cookies expire
- Use Playwright for the initial authentication process

```javascript
async function refreshAuthentication() {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://app.fergus.com/users/sign_in');
  await page.fill('#user_email', process.env.FERGUS_EMAIL);
  await page.fill('#user_password', process.env.FERGUS_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  
  const cookies = await context.cookies();
  await browser.close();
  
  // Save cookies for later use
  return cookies;
}
```

### Rate Limiting

To avoid being blocked or throttled:

- Add delays between consecutive API calls
- Limit parallel requests
- Implement exponential backoff for retries

```javascript
async function delayedApiCall(apiFunction, ...args) {
  // Add delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    return await apiFunction(...args);
  } catch (error) {
    if (error.response && error.response.status === 429) {
      // Exponential backoff for rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
      return delayedApiCall(apiFunction, ...args);
    }
    throw error;
  }
}
```

### Error Handling

Implement robust error handling for API failures:

- Retry on temporary failures
- Gracefully handle authentication failures
- Log detailed error information

### Data Processing

- Validate and sanitize data from the API
- Implement caching for frequently accessed data
- Process data in batches for large operations 