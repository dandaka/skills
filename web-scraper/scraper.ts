#!/usr/bin/env bun
import { chromium } from 'playwright';

async function fetchPageContent(url: string) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.error(`Fetching: ${url}`);

        // Navigate to the URL (use domcontentloaded instead of networkidle for faster loading)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for dynamic content to load
        await page.waitForTimeout(5000);

        // Get the page title
        const title = await page.title();
        console.log('=== PAGE TITLE ===');
        console.log(title);
        console.log('');

        // Get visible text
        const bodyText = await page.locator('body').innerText();
        console.log('=== VISIBLE CONTENT ===');
        console.log(bodyText);

    } catch (error) {
        console.error('Error fetching page:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

// Get URL from command line argument
const url = process.argv[2];

if (!url) {
    console.error('Usage: bun run scraper.ts <url>');
    process.exit(1);
}

fetchPageContent(url);
