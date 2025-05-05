const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { chromium } = require('playwright');
require('dotenv').config();

/**
 * Fergus API Client for automating interactions with the Fergus job management system.
 * This client handles authentication, API calls, and data processing.
 */
class FergusClient {
  constructor() {
    this.baseUrl = 'https://app.fergus.com';
    this.cookies = null;
    this.isAuthenticated = false;
    this.cookieFile = path.join(__dirname, 'auth-cookies.json');
  }

  /**
   * Initialize the client by loading saved cookies or authenticating
   */
  async initialize() {
    try {
      // Try to load saved cookies
      await this.loadCookies();
      
      // Test if cookies are valid
      const isValid = await this.validateAuthentication();
      
      if (!isValid) {
        console.log('Saved cookies expired or invalid. Authenticating with browser...');
        await this.authenticateWithBrowser();
      } else {
        console.log('Using saved authentication');
      }
    } catch (error) {
      console.log('Error during initialization:', error.message);
      console.log('Authenticating with browser...');
      await this.authenticateWithBrowser();
    }
  }

  /**
   * Load saved cookies from file
   */
  async loadCookies() {
    try {
      const cookieData = await fs.readFile(this.cookieFile, 'utf8');
      this.cookies = JSON.parse(cookieData);
      return true;
    } catch (error) {
      console.log('No saved cookies found or error loading cookies');
      return false;
    }
  }

  /**
   * Save cookies to file
   */
  async saveCookies() {
    try {
      await fs.writeFile(this.cookieFile, JSON.stringify(this.cookies, null, 2));
      console.log('Cookies saved successfully');
    } catch (error) {
      console.error('Error saving cookies:', error.message);
    }
  }

  /**
   * Validate if the current authentication is still valid
   */
  async validateAuthentication() {
    if (!this.cookies) return false;
    
    try {
      // Try to access the dashboard to check if we're still authenticated
      const response = await axios.get(`${this.baseUrl}/dashboard`, {
        headers: {
          Cookie: this.getCookieHeader()
        },
        maxRedirects: 0,
        validateStatus: status => status < 400
      });
      
      this.isAuthenticated = response.status === 200;
      return this.isAuthenticated;
    } catch (error) {
      return false;
    }
  }

  /**
   * Authenticate with browser using Playwright
   */
  async authenticateWithBrowser() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Navigate to login page
      await page.goto(`${this.baseUrl}/users/sign_in`);
      
      // Check if we're on the login page
      const isLoginPage = await page.locator('form#new_user').count() > 0;
      
      if (isLoginPage) {
        // Fill in credentials and login
        await page.fill('#user_email', process.env.FERGUS_EMAIL);
        await page.fill('#user_password', process.env.FERGUS_PASSWORD);
        await page.click('button[type="submit"]');
        
        // Wait for navigation to complete (dashboard loaded)
        await page.waitForNavigation({ url: /dashboard/ });
      }
      
      // Extract cookies from browser
      this.cookies = await context.cookies();
      this.isAuthenticated = true;
      
      // Save cookies for future use
      await this.saveCookies();
      
      console.log('Authentication successful');
    } catch (error) {
      console.error('Authentication failed:', error.message);
      throw new Error('Failed to authenticate with Fergus');
    } finally {
      await browser.close();
    }
  }

  /**
   * Get cookie header string from cookie objects
   */
  getCookieHeader() {
    if (!this.cookies) return '';
    return this.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  }

  /**
   * Make an API request with authentication
   */
  async apiRequest(endpoint, method = 'GET', data = null, additionalHeaders = {}) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Call initialize() first.');
    }

    const url = `${this.baseUrl}/api/v2/${endpoint}`;
    const headers = {
      'Cookie': this.getCookieHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...additionalHeaders
    };

    try {
      const config = { 
        method, 
        url, 
        headers,
        validateStatus: status => status < 500
      };
      
      if (data) {
        if (method.toUpperCase() === 'GET') {
          config.params = data;
        } else {
          config.data = data;
        }
      }
      
      const response = await axios(config);
      
      // Check if we're redirected to login (session expired)
      if (response.status === 302 || response.data?.redirect_to?.includes('sign_in')) {
        console.log('Session expired. Re-authenticating...');
        await this.authenticateWithBrowser();
        // Retry the request
        return this.apiRequest(endpoint, method, data, additionalHeaders);
      }
      
      if (response.status >= 400) {
        throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(response.data)}`);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Error in API request to ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all jobs with a specific status
   */
  async getAllJobsWithStatus(status, page = 1, perPage = 100) {
    const formattedStatus = status.toLowerCase();
    
    const data = {
      page,
      query: { status: formattedStatus },
      per_page: perPage,
      sort: { manual: "desc" }
    };
    
    const response = await this.apiRequest('status_board/all_active_jobs', 'POST', data);
    
    // Check if we need to paginate
    if (response.recordsTotal > perPage * page) {
      console.log(`Fetching next page (${page + 1}/${Math.ceil(response.recordsTotal / perPage)})`);
      const nextPageJobs = await this.getAllJobsWithStatus(status, page + 1, perPage);
      return [...response.data, ...nextPageJobs];
    }
    
    return response.data || [];
  }

  /**
   * Get job card details
   */
  async getJobCard(jobId) {
    const data = {
      id: jobId
    };
    
    return await this.apiRequest('job_card/load_from_job', 'POST', data);
  }

  /**
   * Get extended job information
   */
  async getExtendedJobInfo(jobId) {
    return await this.apiRequest(`jobs/extended_json?job_id=${jobId}`, 'GET');
  }

  /**
   * Get quote financial details
   */
  async getQuoteFinancials(quoteId) {
    const data = {
      id: quoteId
    };
    
    return await this.apiRequest('quotes/get_document_totals', 'POST', data);
  }

  /**
   * Export all quote follow ups that need attention
   * Options:
   * - sentDaysAgo: Only include quotes sent X days ago
   * - onlyNotAccepted: Only include quotes that haven't been accepted
   */
  async exportQuoteFollowUps(options = {}) {
    const { sentDaysAgo, onlyNotAccepted = true } = options;
    
    // Get all jobs with Quote Sent status
    console.log('Fetching all jobs with "Quote Sent" status...');
    const jobs = await this.getAllJobsWithStatus('Quote Sent');
    console.log(`Found ${jobs.length} jobs with "Quote Sent" status`);
    
    // Process each job
    const followUpList = [];
    let processedCount = 0;
    
    for (const job of jobs) {
      processedCount++;
      console.log(`Processing job ${processedCount}/${jobs.length}: ${job.internal_id}`);
      
      try {
        // Get detailed job information
        const jobDetails = await this.getJobCard(job.id);
        
        if (!jobDetails?.value?.quote?.id) {
          console.log(`No quote found for job ${job.internal_id}`);
          continue;
        }
        
        const quoteId = jobDetails.value.quote.id;
        const quoteSentDate = new Date(jobDetails.value.quote.published_at);
        
        // Filter by sent date if specified
        if (sentDaysAgo) {
          const today = new Date();
          const targetDate = new Date();
          targetDate.setDate(today.getDate() - sentDaysAgo);
          
          // Check if the quote was sent on the target date
          if (quoteSentDate.toDateString() !== targetDate.toDateString()) {
            continue;
          }
        }
        
        // Get quote financials
        const quoteFinancials = await this.getQuoteFinancials(quoteId);
        
        // Extract customer contact information
        const customer = jobDetails.value.customer || {};
        const contactEmail = customer.email || 'No email';
        const contactPhone = customer.mobile || customer.phone || 'No phone';
        
        // Create follow-up entry
        followUpList.push({
          jobNumber: job.internal_id,
          customerName: job.customer_full_name,
          siteAddress: job.site_address,
          quoteSentDate: jobDetails.value.quote.published_at,
          description: job.description,
          contactEmail,
          contactPhone,
          followUpStatus: "Pending",
          jobLink: `https://app.fergus.com/jobs/view/${job.id}`,
          quoteTotal: quoteFinancials.value.total,
          services: quoteFinancials.value.line_items.map(item => item.name)
        });
        
        // Add a delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing job ${job.internal_id}:`, error.message);
      }
    }
    
    // Save the results to a file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputFile = path.join(outputDir, `quote-followups-${timestamp}.json`);
    await fs.writeFile(outputFile, JSON.stringify(followUpList, null, 2));
    
    console.log(`Exported ${followUpList.length} quotes for follow-up to ${outputFile}`);
    return followUpList;
  }
}

// Example usage
async function main() {
  const client = new FergusClient();
  await client.initialize();
  
  // Export quote follow-ups for quotes sent 7 days ago
  await client.exportQuoteFollowUps({ sentDaysAgo: 7 });
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { FergusClient }; 