const puppeteer = require('puppeteer');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const fs = require('fs');

const storage = new Storage({ keyFilename: '/app/secrets/firebase-adminsdk.json' });

async function run() {
    console.log("Initializing variables...");
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    const inputHtmlPath = process.env.INPUT_GCS_PATH;
    const firebaseToken = process.env.FIREBASE_CUSTOM_TOKEN;
    const userId = process.env.USER_ID;

    console.log("Starting PDF generation process...");

    let browser;
    try {
        console.log(`Downloading HTML: ${inputHtmlPath}`);
        const [content] = await storage.bucket(bucketName).file(inputHtmlPath).download();
        const htmlString = content.toString();

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
        });
        const page = await browser.newPage();

        // Pre-authenticate the browser session with the Custom Token
        if (firebaseToken) {
            await page.evaluateOnNewDocument((token) => {
                localStorage.setItem('firebaseToken', token);
            }, firebaseToken);
        }

        console.log("Rendering PDF...");
        await page.setContent(htmlString, { waitUntil: 'networkidle0', timeout: 60000 });

        const pdfPath = `/tmp/report_${userId}.pdf`;
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });

        // UPLOAD PDF BACK TO GCS (or Google Drive)
        const finalPdfName = `reports/final_${userId}_${Date.now()}.pdf`;
        await storage.bucket(bucketName).upload(pdfPath, { destination: finalPdfName });

        console.log(`Success! PDF uploaded to ${finalPdfName}`);

        // CALLBACK TO LARAVEL
        // This triggers the notification system you already have
        await axios.post('https://your-laravel-domain.com/api/reports/callback', {
            user_id: userId,
            file_name: finalPdfName,
            status: 'success'
        }, {
            headers: { 'Authorization': 'Bearer YOUR_INTERNAL_SECRET_TOKEN' }
        });

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

run();