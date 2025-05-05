const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);
}

// Configuration - now using environment variables
const config = {
  headless: process.env.HEADLESS === 'true',
  slowMotion: parseInt(process.env.SLOW_MOTION || '50', 10),
  saveAuthState: true, // Save login state for future runs
  credentials: {
    email: process.env.FERGUS_EMAIL,
    password: process.env.FERGUS_PASSWORD
  }
};

/**
 * Extracts essential structure information from a page
 * @param {Page} page - Playwright page object
 * @param {string} pageName - Name of the page for logging
 * @returns {Promise<object>} Page structure information
 */
async function capturePageStructure(page, pageName) {
  console.log(`Analyzing structure of ${pageName} page...`);
  
  // Extract page structure using page.evaluate
  return await page.evaluate(() => {
    // This function runs in browser context
    
    // Helper function to extract text content safely
    const getText = (el) => el ? el.textContent.trim() : '';
    
    // Get page title and URL
    const basicInfo = {
      title: document.title,
      url: window.location.href,
    };
    
    // Extract main navigation elements
    const navigation = [];
    document.querySelectorAll('nav a, header a, [role="navigation"] a').forEach(link => {
      if (link.innerText.trim()) {
        navigation.push({
          text: link.innerText.trim(),
          href: link.getAttribute('href'),
          id: link.id || null,
          class: link.className || null
        });
      }
    });
    
    // Extract section headers and UI regions
    const sections = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"], .section-title, .panel-title').forEach(heading => {
      sections.push({
        text: heading.innerText.trim(),
        level: heading.tagName ? heading.tagName.replace('H', '') : null,
        id: heading.id || null,
        class: heading.className || null
      });
    });
    
    // Extract form elements
    const forms = [];
    document.querySelectorAll('form').forEach(form => {
      const formFields = [];
      form.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(field => {
        formFields.push({
          type: field.type || field.tagName.toLowerCase(),
          id: field.id || null,
          name: field.name || null,
          placeholder: field.placeholder || null,
          label: field.labels && field.labels[0] ? field.labels[0].textContent.trim() : null,
          class: field.className || null
        });
      });
      
      forms.push({
        id: form.id || null,
        class: form.className || null,
        action: form.action || null,
        method: form.method || null,
        fields: formFields
      });
    });
    
    // Extract buttons
    const buttons = [];
    document.querySelectorAll('button, [role="button"], a.btn, .button, input[type="submit"]').forEach(button => {
      buttons.push({
        text: button.innerText.trim(),
        type: button.type || null,
        id: button.id || null,
        class: button.className || null,
        disabled: button.disabled || false
      });
    });
    
    // Extract tables
    const tables = [];
    document.querySelectorAll('table').forEach(table => {
      const headers = [];
      table.querySelectorAll('th').forEach(th => {
        headers.push(th.innerText.trim());
      });
      
      tables.push({
        id: table.id || null,
        class: table.className || null,
        headers,
        rowCount: table.querySelectorAll('tbody tr').length
      });
    });
    
    // Extract UI panels and cards
    const panels = [];
    document.querySelectorAll('.panel, .card, .box, section, [role="region"]').forEach(panel => {
      const title = panel.querySelector('h1, h2, h3, h4, .title, .header')?.innerText.trim() || null;
      
      panels.push({
        title,
        id: panel.id || null,
        class: panel.className || null
      });
    });
    
    // Return the complete structure
    return {
      basicInfo,
      navigation,
      sections,
      forms,
      buttons,
      tables,
      panels
    };
  });
}

async function automateFergus() {
  console.log('Starting Fergus structure analysis...');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: config.headless,
    slowMo: config.slowMotion
  });
  
  // Check if we have saved authentication state
  const authPath = path.join(outputDir, 'auth-state.json');
  let context;
  if (config.saveAuthState && fs.existsSync(authPath)) {
    console.log('Using saved authentication state...');
    context = await browser.newContext({ storageState: authPath });
  } else {
    context = await browser.newContext();
  }
  
  const page = await context.newPage();

  try {
    // Create a timestamp for this session
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionDir = path.join(outputDir, `structure-${timestamp}`);
    fs.mkdirSync(sessionDir, { recursive: true });
    
    // Step 1: Analyze Login Page
    console.log('Navigating to login page...');
    await page.goto('https://app.fergus.com/auth/login');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot and save HTML
    const loginScreenshot = path.join(sessionDir, 'login-page.png');
    await page.screenshot({ path: loginScreenshot, fullPage: true });
    
    // Capture login page structure
    const loginStructure = await capturePageStructure(page, 'login');
    fs.writeFileSync(
      path.join(sessionDir, 'login-structure.json'), 
      JSON.stringify(loginStructure, null, 2)
    );
    console.log('✓ Login page structure captured');
    
    // Step 2: Login to the application
    console.log('Logging in...');
    
    // Check if credentials are set
    if (!config.credentials.email || !config.credentials.password) {
      throw new Error('Login credentials not set in .env file');
    }
    
    // Fill login details - target the username field
    await page.fill('input[placeholder*="username" i]', config.credentials.email);
    await page.fill('input[placeholder*="password" i]', config.credentials.password);
    
    // Click login button
    await page.click('button:has-text("LOGIN")');
    
    // Wait for login to complete
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Extra time for dashboard to load
    
    // Verify we're logged in
    const loginSuccessful = await page.evaluate(() => {
      return !document.querySelector('input[placeholder*="username" i]') && 
             !document.title.toLowerCase().includes('login');
    });
    
    if (!loginSuccessful) {
      throw new Error('Login failed - please check your credentials');
    }
    
    console.log('Login successful!');
    
    // Save authentication state if enabled
    if (config.saveAuthState) {
      await context.storageState({ path: authPath });
      console.log('Authentication state saved for future use');
    }
    
    // Step 3: Analyze Dashboard
    console.log('Analyzing dashboard...');
    const dashboardScreenshot = path.join(sessionDir, 'dashboard.png');
    await page.screenshot({ path: dashboardScreenshot, fullPage: true });
    
    // Capture dashboard structure
    const dashboardStructure = await capturePageStructure(page, 'dashboard');
    fs.writeFileSync(
      path.join(sessionDir, 'dashboard-structure.json'), 
      JSON.stringify(dashboardStructure, null, 2)
    );
    console.log('✓ Dashboard structure captured');
    
    // Step 4: Navigate to key pages and capture structure
    // Array of key pages to analyze
    const keyPages = [
      { name: 'new-job', url: '/jobs/newjob' },
      { name: 'customers', url: '/customers' },
      { name: 'calendar', url: '/calendar' },
      { name: 'sites', url: '/sites' }
    ];
    
    for (const page_info of keyPages) {
      try {
        console.log(`Navigating to ${page_info.name} page...`);
        await page.goto(`https://app.fergus.com${page_info.url}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Take screenshot
        const pageScreenshot = path.join(sessionDir, `${page_info.name}.png`);
        await page.screenshot({ path: pageScreenshot, fullPage: true });
        
        // Capture page structure
        const pageStructure = await capturePageStructure(page, page_info.name);
        fs.writeFileSync(
          path.join(sessionDir, `${page_info.name}-structure.json`), 
          JSON.stringify(pageStructure, null, 2)
        );
        console.log(`✓ ${page_info.name} page structure captured`);
      } catch (error) {
        console.error(`Error analyzing ${page_info.name} page:`, error.message);
        // Continue with other pages even if one fails
      }
    }
    
    // Step 5: Create a summary of all structures
    const structureSummary = {
      timestamp,
      pages: [
        { name: 'login', structure: loginStructure },
        { name: 'dashboard', structure: dashboardStructure }
      ]
    };
    
    // Add successful key pages to summary
    for (const page_info of keyPages) {
      const structurePath = path.join(sessionDir, `${page_info.name}-structure.json`);
      if (fs.existsSync(structurePath)) {
        const structure = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
        structureSummary.pages.push({ name: page_info.name, structure });
      }
    }
    
    // Save summary
    fs.writeFileSync(
      path.join(sessionDir, 'structure-summary.json'),
      JSON.stringify(structureSummary, null, 2)
    );
    
    // Create a more readable MD file with structure highlights
    let mdContent = `# Fergus App Structure Analysis\n\n`;
    mdContent += `Generated on: ${new Date().toLocaleString()}\n\n`;
    
    for (const page of structureSummary.pages) {
      mdContent += `## ${page.name.toUpperCase()} Page\n\n`;
      
      // Basic info
      mdContent += `- **URL**: ${page.structure.basicInfo?.url || 'N/A'}\n`;
      mdContent += `- **Title**: ${page.structure.basicInfo?.title || 'N/A'}\n\n`;
      
      // Navigation elements
      if (page.structure.navigation && page.structure.navigation.length > 0) {
        mdContent += `### Navigation\n\n`;
        page.structure.navigation.forEach(nav => {
          mdContent += `- ${nav.text} (${nav.href || 'No href'})\n`;
        });
        mdContent += `\n`;
      }
      
      // Sections
      if (page.structure.sections && page.structure.sections.length > 0) {
        mdContent += `### Sections\n\n`;
        page.structure.sections.forEach(section => {
          mdContent += `- ${section.text} (Level: ${section.level || 'N/A'})\n`;
        });
        mdContent += `\n`;
      }
      
      // Forms summary
      if (page.structure.forms && page.structure.forms.length > 0) {
        mdContent += `### Forms\n\n`;
        page.structure.forms.forEach((form, index) => {
          mdContent += `#### Form ${index + 1}\n`;
          mdContent += `- Action: ${form.action || 'N/A'}\n`;
          mdContent += `- Method: ${form.method || 'N/A'}\n`;
          mdContent += `- Fields: ${form.fields.length}\n`;
          
          // List a sample of fields
          const sampleSize = Math.min(form.fields.length, 5);
          if (sampleSize > 0) {
            mdContent += `- Sample fields:\n`;
            for (let i = 0; i < sampleSize; i++) {
              const field = form.fields[i];
              mdContent += `  - ${field.type} ${field.name ? `name="${field.name}"` : ''} ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}\n`;
            }
          }
          
          mdContent += `\n`;
        });
      }
      
      // Tables summary
      if (page.structure.tables && page.structure.tables.length > 0) {
        mdContent += `### Tables\n\n`;
        page.structure.tables.forEach((table, index) => {
          mdContent += `#### Table ${index + 1}\n`;
          mdContent += `- Columns: ${table.headers.join(', ')}\n`;
          mdContent += `- Row count: ${table.rowCount}\n\n`;
        });
      }
    }
    
    // Save MD file
    fs.writeFileSync(path.join(sessionDir, 'structure-summary.md'), mdContent);
    
    console.log(`\nStructure analysis completed! Results saved to ${sessionDir}`);
    console.log('Key files:');
    console.log(`- structure-summary.json: Complete structured data`);
    console.log(`- structure-summary.md: Human-readable summary`);
    console.log(`- *.png: Screenshots of each page`);
    
    // Close browser
    await browser.close();
    
  } catch (error) {
    console.error('Automation failed:', error);
    
    // Take screenshot on error
    const errorPath = path.join(outputDir, `error-${Date.now()}.png`);
    await page.screenshot({ path: errorPath });
    console.log(`Error screenshot saved to ${errorPath}`);
    
    await browser.close();
  }
}

// Run the automation
automateFergus().catch(console.error); 