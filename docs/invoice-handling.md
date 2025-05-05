# Invoice Handling in Fergus-Airtable Sync

This document explains the approach and methodology for detecting, extracting, and syncing invoices from Fergus to Airtable.

## Overview

Fergus does not expose invoice data through a simple, direct API endpoint. Instead, invoices must be discovered through a multi-step process that involves:

1. Identifying jobs that have invoices or works orders
2. Extracting invoice and works order IDs
3. Fetching detailed information for each invoice or works order
4. Processing and formatting invoice data for Airtable

## Key Concepts

### Invoice Types in Fergus

- **Customer Invoices**: Finalized invoices sent to customers
- **Works Orders**: Pre-invoice items that are ready to be converted to invoices

### Discovery Methods

We use multiple methods to discover invoices:

#### 1. Status Board Data Endpoint

The most reliable method for finding invoices is through the status board data endpoint:

```javascript
const url = 'https://app.fergus.com/api/v2/status_board/data';
```

This endpoint returns a comprehensive dataset that includes:
- `works_order_ids`: IDs for orders ready to be invoiced
- `customer_invoice_ids`: IDs for finalized customer invoices

These IDs can be found in the `to_invoice` sections of the response.

#### 2. Job Extended Data

Each job may contain invoice information in its extended data:

```javascript
const url = 'https://app.fergus.com/api/v2/jobs/extended_json';
```

This endpoint returns detailed job information that may include associated invoices.

#### 3. Job Card Data

Another source of invoice information is the job card data:

```javascript
const url = 'https://app.fergus.com/api/v2/job_card/load_from_job';
```

This endpoint sometimes includes invoice information not found elsewhere.

## Implementation Strategy

### 1. Prioritize Status Board Data

The most effective approach is to start with the status board data to extract invoice IDs:

```javascript
// Extract invoice-related IDs
if (obj.to_invoice?.sections?.to_invoice?.params) {
  const params = obj.to_invoice.sections.to_invoice.params;
  
  // Extract works_order_ids
  if (Array.isArray(params.works_order_ids)) {
    params.works_order_ids.forEach(id => invoiceData.worksOrderIds.add(id));
  }
  
  // Extract customer_invoice_ids
  if (Array.isArray(params.customer_invoice_ids)) {
    params.customer_invoice_ids.forEach(id => invoiceData.customerInvoiceIds.add(id));
  }
}
```

### 2. Fetch Invoice Details

Once IDs are extracted, fetch detailed invoice information:

```javascript
// For customer invoices
const endpoint = `https://app.fergus.com/api/v2/financials/invoices/${invoiceId}`;

// For works orders
const endpoint = `https://app.fergus.com/api/v2/works_orders/${orderId}`;
```

### 3. Process Invoice Data

Format invoice data for Airtable, handling the different structures from different sources:

```javascript
const invoiceRecord = {
  'Invoice Number': invoice.invoice_number || invoice.number || invoice.id || '',
  'Invoice Reference': invoice.reference || invoice.ref || '',
  'Fergus Site Address': siteAddress,
  'Fergus Job Number': jobNumber,
  'Amount Paid': amount,
  'Invoice Status': status,
  'Customer': customerName,
  'Invoice Date': invoiceDate,
  'Total': total
};
```

### 4. Incremental Sync Considerations

When implementing incremental sync for invoices, it's critical to:

1. **Get detailed job information first** - The basic job data from the status board API lacks complete 
   customer, billing, and site address information required for invoices
2. Always use the `extended_json` endpoint to get complete job data before processing invoices
3. Only check for invoices on jobs with statuses like "Completed", "Invoiced", "Won", or "Paid"
4. Use the job_id (not the internal_job_id) from the detailed job data when requesting invoice information

For example:
```javascript
// First get detailed job data
const detailedJob = await fetchJobById(jobId);
// Then use the job_id to get invoices
const invoices = await syncJobInvoicesToAirtable(detailedJob.job_id);
```

## Handling Works Orders

Works orders are treated as "Ready to invoice" items:

```javascript
// Create an invoice record from works order data
const invoiceRecord = {
  invoice_number: invoice.order_number || invoice.id || `WO-${Date.now()}`,
  amount: typeof invoice.total === 'number' ? invoice.total : 0,
  amount_paid: 0, // Works orders are ready to invoice, so not paid yet
  total: typeof invoice.total === 'number' ? invoice.total : 0,
  status: "Ready to invoice", // Special status for works orders
  date: invoice.created_at || new Date().toISOString()
};
```

## Challenges and Solutions

### Challenge: Invoice Discovery

**Problem**: Invoices are not directly accessible through a single API endpoint.

**Solution**: Use multiple discovery methods, prioritizing the status board data which contains the most comprehensive list of invoice IDs.

### Challenge: Different Data Structures

**Problem**: Invoice data comes in different formats depending on the source endpoint.

**Solution**: Implement robust data extraction that handles different structures:

```javascript
// Handle different possible locations for invoice data
let invoices = [];
if (jobData.value?.invoices) {
  invoices = jobData.value.invoices;
} else if (jobData.value?.jobCard?.invoices) {
  invoices = jobData.value.jobCard.invoices;
}
```

### Challenge: Permissions and Access

**Problem**: Some invoice endpoints may not be accessible depending on user permissions.

**Solution**: Test endpoint accessibility before making multiple calls, and fall back to alternative endpoints:

```javascript
try {
  const testResponse = await axios.get('https://app.fergus.com/api/v2/finance/invoices', {
    params: { page: 1, per_page: 1 },
    headers: getDefaultHeaders(),
    timeout: 5000
  });
  canAccessFinancials = true;
} catch (error) {
  console.log('Financial API is not accessible with current permissions');
}
```

## Airtable Integration

Invoices are synced to the "Invoices" table in Airtable with the following fields:

- Invoice Number
- Invoice Reference
- Fergus Site Address
- Fergus Job Number
- Amount Paid
- Invoice Status
- Customer
- Invoice Date
- Due Date (if available)
- Total
- Items (formatted line items, if available)

## Current Results

The current implementation successfully:
- Identifies 4 works order IDs and 1 customer invoice ID from the Fergus system
- Fetches details for these invoices and works orders
- Processes and syncs the data to Airtable
- Handles both direct invoice data and works order data appropriately 