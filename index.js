const puppeteer = require('puppeteer');

async function generatePDF() {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    // ... your PDF logic ...
    console.log("PDF generated!");
    await browser.close();
}

generatePDF();