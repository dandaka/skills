# Web Scraper Skill

This skill fetches content from web pages using Playwright/Chromium, which can render JavaScript and dynamic content.

## Prerequisites

Playwright must be installed and browsers must be set up:

```bash
# If using npm/yarn
npm install -D playwright
npx playwright install chromium

# If using bun
bun add -d playwright
bunx playwright install chromium
```

## Usage

When the user provides a URL to scrape or asks to fetch content from a JavaScript-rendered page:

1. Use the TypeScript script located at `~/.claude/skills/web-scraper/scraper.ts`
2. Run it with: `bun run ~/.claude/skills/web-scraper/scraper.ts <url>`
3. The script will output the page title and visible text content

## Script Functionality

The scraper script:
- Launches a headless Chromium browser
- Navigates to the provided URL
- Waits for network to be idle and gives extra time for dynamic content
- Extracts the page title
- Extracts all visible text from the page body
- Outputs the results to stdout

## Examples

```bash
# Scrape a URL
bun run ~/.claude/skills/web-scraper/scraper.ts https://example.com

# Use in a pipeline
bun run ~/.claude/skills/web-scraper/scraper.ts https://example.com | grep "keyword"
```

## Common Use Cases

- Extracting event details from dynamic event pages
- Scraping content from single-page applications (SPAs)
- Getting data from pages that require JavaScript rendering
- Fetching content that WebFetch cannot access due to authentication or JavaScript requirements
