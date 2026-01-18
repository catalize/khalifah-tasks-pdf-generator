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

    // --- PROGRESS TRACKING VARIABLES ---
    let totalImages = 0;
    let loadedImages = 0;
    let failedImages = 0;

    console.log("Starting PDF generation process...");

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();

        // 1. Enable Request Interception
        await page.setRequestInterception(true);

        page.on('request', async (request) => {
            const url = request.url();
            
            // CASE 1: Google Cloud Storage Internal Links
            if (url.startsWith('gs://')) {
                totalImages++;
                try {
                    const parts = url.replace('gs://', '').split('/');
                    const bucketName = parts.shift();
                    const fileName = parts.join('/');

                    const [buffer] = await storage.bucket(bucketName).file(fileName).download();

                    // Auto-detect MIME type based on extension
                    const ext = fileName.split('.').pop().toLowerCase();
                    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

                    loadedImages++;
                    const percent = Math.round((loadedImages / (totalImages || 1)) * 100);
                    process.stdout.write(`\r📸 Progress: [${'█'.repeat(percent/10)}${'░'.repeat(10-(percent/10))}] ${loadedImages} Loaded | ${failedImages} Failed`);

                    request.respond({
                        status: 200,
                        contentType: mimeType,
                        body: buffer
                });
                } catch (err) {
                    failedImages++;
                    console.error(`Failed to fetch GS image: ${url}`, err);
                    request.abort();
                }
            } // CASE 2: External HTTP Links (Your Logo & Ngrok Assets)
            else if (url.startsWith('http')) {
                const headers = {
                    ...request.headers(),
                    'ngrok-skip-browser-warning': 'true'
                };
                
                request.continue({ headers });
            }
            // CASE 3: Data URLs or other protocols
            else {
                request.continue();
            }
        });

        // Set the HTML content for the page
        // The 'content' variable is already declared above, so we reuse it.
        console.log(`Downloading HTML: ${inputHtmlPath}`);
        const [content] = await storage.bucket(bucketName).file(inputHtmlPath).download();
        await page.setContent(content.toString(), { waitUntil: 'networkidle0' });

        // This ensures Puppeteer doesn't "skip" the PDF generation
        await page.evaluate(async () => {
            const selectors = Array.from(document.querySelectorAll('img'));
            await Promise.all(selectors.map(img => {
                if (img.complete) return;
                return new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = resolve; // Continue even if one image fails
                });
            }));
        });

        // Extra safety for 1,000 images
        await new Promise(r => setTimeout(r, 120000));

        const pdfPath = `/tmp/report_${userId}.pdf`;
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });

        // UPLOAD PDF BACK TO GCS (or Google Drive)
        const outputGcsPath = process.env.OUTPUT_GCS_PATH; // e.g., temp_reports/report-aachen-2026-01-01...pdf

        if (outputGcsPath) {
            console.log(`\n📤 Uploading final PDF to: ${outputGcsPath}`);
            await storage.bucket(bucketName).upload(pdfPath, {
                destination: outputGcsPath,
                public: false, // Keep it private
                metadata: {
                    contentType: 'application/pdf',
                }
            });

            console.log(`Success! PDF uploaded to ${outputGcsPath}`);
        }

        // Update the Callback to send the final path back to Laravel
        const callbackUrl = process.env.CALLBACK_URL;
        const internalSecret = process.env.INTERNAL_SECRET;

        if (callbackUrl) {
            console.log(`🔗 Notifying Laravel at: ${callbackUrl}`);
            try {
                await axios.post(callbackUrl, {
                    user_id: process.env.USER_ID,
                    file_path: process.env.OUTPUT_GCS_PATH,
                    status: 'success'
                }, {
                    headers: { 
                        'X-Internal-Secret': internalSecret,
                        'ngrok-skip-browser-warning': 'true',
                        'Content-Type': 'application/json'
                    }
                });
                console.log("✅ Callback successful");
            } catch (err) {
                console.error("❌ Callback failed:", err.response?.data || err.message);
            }
        }

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