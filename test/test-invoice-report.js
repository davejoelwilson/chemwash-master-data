/**
 * Test script to access the Fergus Customer Invoice Report endpoint
 */
const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();

// Store your Fergus cookies here - using same cookies from direct-fergus-api.js
const FERGUS_COOKIES = require('../direct-fergus-api').FERGUS_COOKIES;

/**
 * Default headers for Fergus API requests
 */
const getDefaultHeaders = () => ({
  'Cookie': FERGUS_COOKIES,
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Accept-Language': 'en-GB,en;q=0.7',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Origin': 'https://app.fergus.com',
  'Referer': 'https://app.fergus.com/dashboard',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
});

/**
 * Try to access customer invoice report
 */
async function fetchCustomerInvoiceReport() {
  try {
    console.log('Attempting to access customer invoice report...');
    
    // Try a simple GET request first
    const response = await axios.get('https://app.fergus.com/reports/customer_invoice_report', {
      headers: getDefaultHeaders()
    });
    
    console.log('GET Request Status:', response.status);
    
    // Save the response to examine its structure
    await fs.mkdir('output', { recursive: true });
    await fs.writeFile('output/invoice-report-response.json', JSON.stringify(response.data, null, 2));
    console.log('Saved response to output/invoice-report-response.json');
    
    // If it's HTML instead of JSON, it's probably a web page
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      console.log('Response appears to be HTML page instead of API data');
      
      // Try a different approach - look for API endpoints that might be called by the page
      console.log('Trying alternative API endpoints...');
      
      // Try a data endpoint
      const dataResponse = await axios.get('https://app.fergus.com/api/v2/reports/customer_invoices', {
        headers: getDefaultHeaders()
      });
      
      console.log('Data API Request Status:', dataResponse.status);
      await fs.writeFile('output/invoice-report-data.json', JSON.stringify(dataResponse.data, null, 2));
      console.log('Saved data response to output/invoice-report-data.json');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching customer invoice report:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
      
      // Save error response data
      try {
        await fs.mkdir('output', { recursive: true });
        await fs.writeFile('output/invoice-report-error.json', JSON.stringify(error.response.data, null, 2));
        console.log('Saved error response to output/invoice-report-error.json');
      } catch (writeError) {
        console.error('Error saving response data:', writeError.message);
      }
    }
    
    // Try some alternative invoice endpoints if the main one fails
    console.log('Trying alternative invoice endpoints...');
    
    try {
      // Try customer_invoices endpoint
      const invoicesResponse = await axios.get('https://app.fergus.com/api/v2/customer_invoices', {
        params: {
          page: 1,
          per_page: 20
        },
        headers: getDefaultHeaders()
      });
      
      console.log('Customer Invoices API Request Status:', invoicesResponse.status);
      await fs.writeFile('output/customer-invoices.json', JSON.stringify(invoicesResponse.data, null, 2));
      console.log('Saved customer invoices to output/customer-invoices.json');
      
      return invoicesResponse.data;
    } catch (altError) {
      console.error('Error with alternative endpoint:', altError.message);
      return null;
    }
  }
}

// Run the test
fetchCustomerInvoiceReport()
  .then(() => console.log('Test completed'))
  .catch(console.error); 