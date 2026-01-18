const puppeteer = require('puppeteer');
const fs = require('fs');

async function generatePDF() {
    console.log("Starting PDF generation process...");

    let browser;
    try {
        console.log("Getting Firebase Access Token...");
        const firebaseToken = process.env.FIREBASE_CUSTOM_TOKEN;

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

        // 2. Inject the token into the browser context BEFORE setting content
        if (firebaseToken) {
            console.log("Setting Firebase Auth Token in browser context...");
            await page.evaluateOnNewDocument((token) => {
                // This allows your HTML's script (if any) to pick up the token
                localStorage.setItem('firebaseToken', token);
            }, firebaseToken);
        }

        // 3. Set the HTML string we got from GCS
        // networkidle0 ensures it waits for the Firebase image fetches to finish
        console.log("Setting the page contents...");
        await page.setContent(htmlString, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });

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

        // 4. Upload the PDF back to GCS
        const outputFileName = `results/report_${process.env.USER_ID}_${Date.now()}.pdf`;

        console.log(`Uploading PDF to GCS: ${outputFileName}...`);
        await storage.bucket(bucketName).upload(pdfPath, {
            destination: outputFileName,
            metadata: {
                contentType: 'application/pdf',
            },
        });

        console.log("Upload complete! You can now see the file in the GCP Console.");

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