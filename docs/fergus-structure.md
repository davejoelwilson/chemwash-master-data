# Fergus App Structure Documentation

This document outlines the core structure and static elements of the Fergus application that would be useful for automation workflows.

## Login Page

- **URL**: `https://app.fergus.com/auth/login`
- **Elements**:
  - Username field: `input[placeholder*="username" i]`
  - Password field: `input[placeholder*="password" i]`
  - Login button: `button:has-text("LOGIN")`
  - "Remember me" checkbox
  - "Forgot password?" link

## Main Dashboard

- **URL**: `https://app.fergus.com/dashboard`

### Main Navigation (Top Bar)

- **Selector**: `nav` or top-level navigation elements
- **Static Links**:
  - New Job: `/jobs/newjob`
  - Home: `/dashboard`
  - Customers: `/customers`
  - Sites: `/sites`
  - Health & Safety: `/safety/meetings`
  - Calendar: `/calendar`
  - Map: `/location/map`
  - Supplier Docs: `/received_merchant_documents/process_documents`

### Status Board Section

- **Selector**: `.dashboard-status-board` or similar
- **Title**: "STATUS BOARD"
- **Filter**: "Filter by User or Group" dropdown
- **Static Status Columns**:
  - PENDING
  - PRICING
  - SCHEDULING
  - IN PROGRESS
  - BACK COSTING
  - INVOICING
  - PAYMENTS

### Job List Section

- **Selector**: Job list table or similar
- **Title**: "Job List"
- **Search**: Search job list input field
- **Table Structure**:
  - JOB TYPE (column)
  - JOB STATUS (column)
  - JOB (column) - contains job numbers with pattern "NW-#####"
  - CUSTOMER (column)
  - SITE ADDRESS (column)
  - TITLE (column)
  - CREATED (column)
- **Common Job Status Values**:
  - QUOTE
  - TO PRICE
  - QUOTE SENT
  - ACTIVE

### Quick Actions Panel

- **Selector**: `.dashboard-quick-action-panel` or similar
- **Static Options**:
  - Create job: `/jobs/newjob`
  - Create job from work order: `/jobs/work_order_to_job`
  - Create quote/estimate: `/jobs/quick/quote`
  - Create invoice: `/jobs/quick/invoice`
  - Add customer: Likely `/customers/new`
  - Schedule event: Likely calendar-related

### Enquiries Section

- **Selector**: Enquiries panel or similar
- **Title**: "ENQUIRIES"

### Tasks Section

- **Selector**: Tasks panel or similar
- **Title**: "TASKS"
- **Options**:
  - "View all tasks" link
  - "Add Task" button
  - Task checkboxes with "Mark as done" option

### Footer Elements

- Pagination controls
- Items per page selector
- Page information (e.g., "Showing 1-10 of 3338")
- "Terms of Service" and "Privacy Policy" links

## Common UI Patterns

### Buttons
- Primary action buttons (blue/purple)
- Secondary buttons
- Status indicator buttons (color-coded)

### Forms
- Input fields
- Dropdowns
- Checkboxes

### Data Display
- Tables with sortable columns
- Cards/panels for grouped information
- Status indicators using colors

## Data Structure and Entity Relationships

### Job Data Structure

Jobs are the central entity in Fergus. They have these key properties:

- **id**: Numeric ID used for API calls (e.g., `15946945`)
- **internal_id**: Formatted job number visible to users (e.g., `NW-27432`)
- **internal_job_id**: Numeric version of the internal ID (e.g., `27432`)
- **job_status** or **status_name**: Current status of the job (e.g., `Quote Sent`, `Completed`)
- **job_type_name**: Type of job (e.g., `Quote`, `Maintenance`)
- **brief_description**: Short description of the job
- **site_address**: Either a string address or a structured address object
- **customer_id**: Reference to the associated customer
- **customer_full_name**: Full name of the customer

### Invoice Data Structure

Invoices are associated with jobs and contain:

- **id**: Numeric ID for the invoice
- **number** or **invoice_number**: Formatted invoice number (e.g., `INV-12345`)
- **date** or **invoice_date**: The date the invoice was created
- **status**: Invoice status (e.g., `Paid`, `Pending`)
- **total**: Total amount of the invoice
- **customer_name**: Customer associated with the invoice
- **job_number** or **job.number**: Reference to the associated job

### Key Entity Relationships

1. **Job to Customer**: Many-to-one
   - A job belongs to one customer
   - A customer can have many jobs

2. **Job to Site**: Many-to-one
   - A job is associated with one site address
   - A site can have multiple jobs

3. **Job to Invoice**: One-to-many
   - A job can have multiple invoices
   - Each invoice belongs to exactly one job

4. **Job to Quote**: One-to-one
   - A job typically has one associated quote
   - Quotes are referenced by their ID in the job data

## API Integration Notes

When building integrations with Fergus:

1. **Job Identification**: 
   - Always store both the `internal_id` (e.g., `NW-27432`) and the numeric `id` (e.g., `15946945`)
   - Different API endpoints require different ID formats

2. **Status Tracking**:
   - Job statuses change as work progresses
   - Common statuses: `Quote`, `To Price`, `Quote Sent`, `Won`, `In Progress`, `Completed`
   - Status changes are critical events to track for workflow automation

3. **Invoice Creation**:
   - Invoices are typically created after a job is completed
   - Jobs without invoices won't have invoice data in the API response
   - Check job status to determine if invoices may exist

4. **Address Handling**:
   - Address data can appear in different formats (string vs. object)
   - When handling site_address as an object, combine fields like `address_1`, `address_suburb`, `address_city` to display the full address

## Automation Workflow Notes

For building automation workflows, these are the key sections to interact with:

1. **Navigation** - Use the top navigation bar links to move between major sections
2. **Quick Actions** - For creating new jobs, quotes, etc.
3. **Job List** - For finding and managing existing jobs
4. **Status Board** - For overview of job statuses
5. **Tasks** - For managing and tracking tasks

Common selectors for automation:
- Navigation links: `nav a`, `.sidebar a`, `header a`
- Action buttons: `button[type="submit"]`, `.btn`, `[role="button"]`
- Table rows: `table tr`, `.job-list-row`
- Form elements: `input`, `select`, `textarea` 