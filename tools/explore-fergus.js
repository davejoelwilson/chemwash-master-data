const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);
}

async function exploreFergus() {
  // Launch browser in headed mode
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 // Slow down operations to see what's happening
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Fergus
    console.log('Navigating to Fergus dashboard...');
    await page.goto('https://app.fergus.com/dashboard');
    
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    
    console.log('Capturing page structure...');
    
    // Save page HTML for analysis
    const html = await page.content();
    const htmlPath = path.join(outputDir, 'fergus-page.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`✓ HTML content saved to ${htmlPath}`);
    
    // Take screenshot of entire page
    const screenshotPath = path.join(outputDir, 'fergus-full.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✓ Full page screenshot saved to ${screenshotPath}`);
    
    // Get all interactive elements for possible automation points
    const buttons = await page.$$eval('button, [role="button"], a.btn', elements => 
      elements.map(el => ({
        text: el.innerText.trim(),
        id: el.id,
        class: el.className,
        type: el.getAttribute('type'),
        href: el.getAttribute('href')
      }))
    );
    
    const inputs = await page.$$eval('input, select, textarea', elements => 
      elements.map(el => ({
        type: el.type || el.tagName.toLowerCase(),
        id: el.id,
        name: el.name,
        placeholder: el.placeholder,
        class: el.className
      }))
    );

    const forms = await page.$$eval('form', elements => 
      elements.map(el => ({
        id: el.id,
        action: el.action,
        method: el.method,
        class: el.className
      }))
    );
    
    // Save analysis results
    const elementsPath = path.join(outputDir, 'fergus-elements.json');
    fs.writeFileSync(elementsPath, JSON.stringify({
      buttons,
      inputs,
      forms
    }, null, 2));
    console.log(`✓ Interactive elements saved to ${elementsPath}`);
    
    // Create folder for the current date with timestamp for session data
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const sessionDir = path.join(outputDir, `session-${timestamp}`);
    fs.mkdirSync(sessionDir, { recursive: true });
    
    // Copy the files to the timestamped session folder
    fs.copyFileSync(htmlPath, path.join(sessionDir, 'fergus-page.html'));
    fs.copyFileSync(screenshotPath, path.join(sessionDir, 'fergus-full.png'));
    fs.copyFileSync(elementsPath, path.join(sessionDir, 'fergus-elements.json'));
    console.log(`✓ Session data archived to ${sessionDir}`);
    
    console.log('Page exploration complete. Analyze the saved files to build your workflow.');
    console.log('Leave the browser open to manually explore, or press Ctrl+C to exit.');
    
    // Keep browser open for manual exploration
    // Uncomment the line below to close automatically
    // await browser.close();
  } catch (error) {
    console.error('Exploration failed:', error);
    const errorPath = path.join(outputDir, `error-${Date.now()}.png`);
    await page.screenshot({ path: errorPath });
    console.log(`Error screenshot saved to ${errorPath}`);
    await browser.close();
  }
}

// Run the exploration
exploreFergus().catch(console.error); 