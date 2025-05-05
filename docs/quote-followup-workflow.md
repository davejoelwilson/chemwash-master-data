# Quote Follow-Up Workflow

## Overview

This document outlines an automated quote follow-up system for Fergus that minimizes manual effort and ensures consistent follow-up with potential customers. By leveraging the Fergus API, we can automatically identify quotes that need follow-up and prepare the necessary information for the follow-up process.

## Business Value

- **Save time**: Eliminates the need to manually search through quotes and click through multiple screens
- **Increase conversion rate**: Consistent follow-up leads to higher quote acceptance rates
- **Improve customer experience**: Timely follow-up creates a professional impression
- **Better tracking**: Maintain a record of all follow-up activities

## Technical Implementation

The quote follow-up workflow uses the Fergus API to:

1. Fetch all jobs with "Quote Sent" status
2. Get detailed information for each job (customer, site, quote details)
3. Filter quotes based on when they were sent (e.g., 7 days ago for weekly follow-up)
4. Extract contact information and relevant details
5. Export the data in a format suitable for follow-up actions

## API Endpoints Used

### 1. Job Status Board API
**Endpoint:** `https://app.fergus.com/api/v2/status_board/all_active_jobs`

**Purpose:** Get a list of all jobs with "Quote Sent" status

**Key Data:**
- Basic job information
- Status and dates
- Customer name 
- Site address

### 2. Job Card API
**Endpoint:** `https://app.fergus.com/api/v2/job_card/load_from_job`

**Purpose:** Get comprehensive customer and job details for a specific job

**Key Data:**
- Customer contact information (email, phone)
- Quote date information (when sent, due date)
- Site details
- Contact preferences

### 3. Quote Financials API
**Endpoint:** `https://app.fergus.com/api/v2/quotes/get_document_totals`

**Purpose:** Get detailed financial information about a quote

**Key Data:**
- Quote total amount
- Individual line items (services/products quoted)
- Pricing details

## Full Data Collection Process

1. **Get All Quote Sent Jobs:**
   ```javascript
   const jobs = await client.getAllJobsWithStatus('Quote Sent');
   ```

2. **For Each Job, Get Full Details:**
   ```javascript
   for (const job of jobs) {
     // Get customer and quote details
     const jobDetails = await client.getJobCard(job.id);
     
     // Get financial details
     const quoteId = jobDetails.value.quote_id;
     const quoteFinancials = await client.getQuoteFinancials(quoteId);
     
     // Combined data for follow-up
     const followUpData = {
       jobNumber: job.internal_id,
       customerName: job.customer_full_name,
       contactEmail: extractEmail(jobDetails),
       contactPhone: extractPhone(jobDetails),
       quoteDate: jobDetails.value.quote.published_at,
       quoteTotal: quoteFinancials.value.total,
       services: quoteFinancials.value.line_items.map(item => item.name)
     };
   }
   ```

## Follow-Up Process

### Automated Part (API Client)

1. **Daily Check**: Run the script to identify quotes needing follow-up
2. **Data Preparation**: Extract and format customer and quote information
3. **Export**: Generate a JSON file with all necessary follow-up information

### Manual Follow-Up Actions

1. **Review Export**: Check the generated follow-up list
2. **Contact Customers**: Use the extracted information to contact customers
3. **Update Status**: Record the outcome of follow-up attempts

## Implementation Example

```javascript
// Run the quote follow-up workflow
const client = new FergusClient();
await client.initialize();

// Weekly follow-up (quotes sent 7 days ago)
const followUpData = await client.exportQuoteFollowUps({ 
  sentDaysAgo: 7,
  onlyNotAccepted: true
});

// Now you can:
// 1. Import this data into a CRM
// 2. Use it for email campaigns
// 3. Create task lists for sales team
// 4. Generate follow-up phone call lists
```

## Example Output Data

```json
[
  {
    "jobNumber": "NW-29615",
    "customerName": "Chemwash - Glen Eden",
    "siteAddress": "11 Norfolk Street, Ponsonby, Auckland 1021",
    "quoteSentDate": "2025-04-03T21:09:52Z",
    "description": "PONSONBY",
    "contactEmail": "westauckland@chemwash.conz",
    "contactPhone": "No phone",
    "followUpStatus": "Pending",
    "jobLink": "https://app.fergus.com/jobs/view/29615",
    "quoteTotal": 138,
    "services": [
      "Brush clean of windows with pure mineral free water (de-Ionised) for a spot free finish",
      "Softwash of house incl external guttering, soffits, walls and foundations"
    ]
  }
]
```

## Integration Options

This data can be integrated with various systems:

1. **Email System**: Trigger automated follow-up emails
2. **CRM**: Create follow-up tasks in your CRM
3. **Spreadsheet**: Export to a Google Sheet for manual follow-up
4. **Airtable**: Use as a simple workflow management tool
5. **Custom Dashboard**: Build a follow-up dashboard for your team

## Advanced Features

With the complete quote information available, your follow-up can include:

1. **Personalized Messaging**: "I'm following up on our quote of $138 for window cleaning at your Ponsonby property"
2. **Priority-Based Follow-Up**: Focus on higher value quotes first
3. **Service-Specific Templates**: Different follow-up approaches based on service type
4. **Time-Based Escalation**: Different messaging based on quote age

## Schedule & Automation

For optimal results, configure the script to run:

- **Daily**: Identify quotes from exactly 7 days ago
- **Weekly**: Generate a comprehensive follow-up list for the week
- **Monthly**: Analyze follow-up performance metrics

## Security Considerations

- Store API credentials securely (use environment variables)
- Implement proper session management for authentication
- Regularly rotate credentials
- Limit API call frequency to avoid rate limiting 