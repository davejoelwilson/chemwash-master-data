const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

/**
 * Authenticate with Fergus and save cookies for API use
 */
async function authenticateFergus() {
  console.log('Authenticating with Fergus...');
  
  const browser = await chromium.launch({ 
    headless: process.env.HEADLESS === 'true',
    slowMo: parseInt(process.env.SLOW_MOTION || 0) 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto('https://app.fergus.com/users/sign_in');
    
    // Check if we're on the login page
    const isLoginPage = await page.locator('form#new_user').count() > 0;
    
    if (isLoginPage) {
      console.log('Filling login credentials...');
      // Fill in credentials and login
      await page.fill('#user_email', process.env.FERGUS_EMAIL);
      await page.fill('#user_password', process.env.FERGUS_PASSWORD);
      await page.click('button[type="submit"]');
      
      // Wait for navigation to complete (dashboard loaded)
      await page.waitForNavigation({ url: /dashboard/ });
    }
    
    // Extract cookies from browser
    const cookies = await context.cookies();
    
    // Save cookies for future use
    const cookiesDir = path.join(__dirname, 'auth');
    await fs.mkdir(cookiesDir, { recursive: true });
    const cookiesPath = path.join(cookiesDir, 'fergus-cookies.json');
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    
    console.log(`Authentication successful! Cookies saved to ${cookiesPath}`);
    return cookies;
  } catch (error) {
    console.error('Authentication failed:', error.message);
    throw new Error('Failed to authenticate with Fergus');
  } finally {
    await browser.close();
  }
}

/**
 * Load saved cookies
 */
async function loadCookies() {
  try {
    const cookiesPath = path.join(__dirname, 'auth', 'fergus-cookies.json');
    const cookieData = await fs.readFile(cookiesPath, 'utf8');
    const cookies = JSON.parse(cookieData);
    console.log('Loaded saved cookies');
    return cookies;
  } catch (error) {
    console.log('No saved cookies found or error loading cookies:', error.message);
    return null;
  }
}

async function main() {
  try {
    // Try to load existing cookies first
    const existingCookies = await loadCookies();
    
    if (existingCookies) {
      console.log('Using existing cookies');
      return existingCookies;
    }
    
    // Authenticate and get new cookies if none exist
    return await authenticateFergus();
  } catch (error) {
    console.error('Error in authentication process:', error.message);
    throw error;
  }
}

// Run directly or export for use in other modules
if (require.main === module) {
  main().catch(console.error);
} else {
  module.exports = { authenticateFergus, loadCookies, main };
} 