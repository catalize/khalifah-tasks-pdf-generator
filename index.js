const puppeteer = require('puppeteer');

async function generatePDF() {
    const puppeteer = require('puppeteer');

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Critical for Docker/Cloud Run
            '--disable-gpu'            // Saves resources in headless mode
        ]
    });
}

generatePDF();