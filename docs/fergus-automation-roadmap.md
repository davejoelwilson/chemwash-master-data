# Fergus Automation Roadmap

## Project Overview

This roadmap outlines our approach to automating interactions with the Fergus job management system. By combining API access with browser automation, we can create efficient workflows that save time and reduce manual effort.

## Current Findings

### Application Structure
- Fergus is a web-based job management platform with a React frontend
- Authentication is handled via session cookies
- The application uses a combination of REST APIs and standard web forms

### Available API Endpoints

We have discovered several useful API endpoints:

1. **Job Status Board API**
   - Endpoint: `https://app.fergus.com/api/v2/status_board/all_active_jobs`
   - Method: POST
   - Purpose: Get a list of all jobs with a specific status
   - Supports: Pagination, status filtering

2. **Job Card API**
   - Endpoint: `https://app.fergus.com/api/v2/job_card/load_from_job`
   - Method: POST
   - Purpose: Get detailed information about a specific job
   - Provides: Customer info, site details, associated quote/invoice

3. **Extended Job Information API**
   - Endpoint: `https://app.fergus.com/api/v2/jobs/extended_json`
   - Method: GET
   - Purpose: Alternative method to get detailed job information

4. **Quote Financial Details API**
   - Endpoint: `https://app.fergus.com/api/v2/quotes/get_document_totals`
   - Method: POST
   - Purpose: Get financial information for a specific quote
   - Provides: Line items, pricing, tax calculations, totals

## Hybrid Automation Strategy

Our approach combines two complementary methods:

### 1. Browser Automation (Playwright)
- **Best for:** Authentication, complex interactions, actions that don't have API endpoints
- **Advantages:** Can perform any action a human can, bypasses API limitations
- **Disadvantages:** Slower, more fragile, requires more maintenance

### 2. Direct API Integration
- **Best for:** Data retrieval, reporting, status updates, batch operations
- **Advantages:** Faster, more reliable, better structured data
- **Disadvantages:** Limited to available API endpoints, requires authentication management

## Implementation Roadmap

### Phase 1: Foundation (Current)
- ✅ Set up browser automation framework with Playwright
- ✅ Document UI structure and navigation patterns
- ✅ Implement authentication and session management
- ✅ Discover and document available API endpoints
- ✅ Create a reusable client for API interactions

### Phase 2: Core Workflows
- ✅ Quote Follow-Up System
  - ✅ Identify quotes that need follow-up
  - ✅ Extract customer contact information
  - ✅ Generate follow-up reports
- 🔄 Job Status Tracking
  - Track job progression through various stages
  - Generate status reports and identify bottlenecks
- 🔄 Customer Information Extraction
  - Batch export customer data for CRM integration
  - Update customer information from external sources

### Phase 3: Advanced Features
- 🔲 Document Management
  - Automate quote/invoice generation
  - Extract and process document content
- 🔲 Task Scheduling
  - Set up recurring jobs based on templates
  - Schedule follow-ups and maintenance tasks
- 🔲 Data Analysis & Reporting
  - Generate business performance reports
  - Analyze job profitability and efficiency

## Technical Design

### Component Architecture

1. **Authentication Manager**
   - Handles login via browser automation
   - Manages session cookies
   - Detects and handles session expiration

2. **API Client**
   - Makes authenticated API requests
   - Handles pagination and rate limiting
   - Normalizes and validates response data

3. **Browser Automation Engine**
   - Performs actions not available via API
   - Captures data from UI when needed
   - Fallback for complex operations

4. **Task Scheduler**
   - Manages recurring automation tasks
   - Handles retry logic and error recovery
   - Maintains execution logs

### Data Flow

```
User Request → Task Scheduler → Authentication Manager → API Client/Browser Automation → Data Processing → Output
```

## Immediate Next Steps

1. **Enhance API Client**
   - Add support for all discovered endpoints
   - Implement rate limiting and retry logic
   - Add comprehensive error handling

2. **Build Quote Follow-Up Workflow**
   - Create a script for generating weekly follow-up lists
   - Format output for easy integration with communication tools
   - Add customizable filtering options

3. **Implement Job Data Export**
   - Build functionality to export job data for reporting
   - Add filtering by date, status, and customer
   - Format data for spreadsheet import

4. **Documentation and Testing**
   - Create comprehensive API documentation
   - Develop test cases for each workflow
   - Create user guides for automation scripts

## Challenges and Considerations

- **Session Management**: Authentication cookies expire and need refreshing
- **Rate Limiting**: Need to avoid hitting API rate limits
- **Error Handling**: Robust error handling required for production use
- **Data Validation**: Validate and sanitize data from the API
- **UI Changes**: Browser automation needs to adapt to UI changes
- **Security**: Secure storage of authentication credentials 