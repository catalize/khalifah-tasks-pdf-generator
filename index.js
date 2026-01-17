const puppeteer = require('puppeteer');
const fs = require('fs');

async function generatePDF() {
    console.log("Starting PDF generation process...");

    let browser;
    try {
        console.log("Launching browser...");
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',          // Helps prevent zombie processes
                '--single-process',     // Crucial for low-resource environments
            ]
        });

        console.log("Browser launched successfully. Opening new page...");
        const page = await browser.newPage();

        // Optional: Set a timeout for the navigation to prevent infinite hanging
        page.setDefaultNavigationTimeout(60000); // 60 seconds

        const targetUrl = 'https://developer.chrome.com/'; // Change this to your target website
        console.log(`Navigating to: ${targetUrl}`);
        
        // waitUntil: 'networkidle2' is great for waiting until images/scripts are loaded
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });

        // Set screen size.
        await page.setViewport({width: 1080, height: 1024});

        console.log("Page loaded. Generating PDF...");
        const pdfPath = '/tmp/report.pdf'; // /tmp is the writable folder in Cloud Run
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true
        });

        console.log(`PDF saved locally at: ${pdfPath}`);

        // VERIFICATION: Check file size to ensure it's not empty
        const stats = fs.statSync(pdfPath);
        console.log(`PDF size: ${stats.size} bytes`);

        // FUTURE STEP: Here you will add your Google Drive upload logic

    } catch (error) {
        console.error("CRITICAL ERROR during PDF generation:", error);
    } finally {
        if (browser) {
            console.log("Closing browser...");
            await browser.close();
        }
        console.log("Process finished.");
        // Explicitly exit the process so the Cloud Run Job knows it's done
        process.exit(0);
    }
}

generatePDF();