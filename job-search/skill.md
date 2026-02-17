---
name: job-search
description: Search for product manager jobs from configured sources, deduplicate against existing entries, and post new jobs to the tracking Google Sheet. Use when the user wants to find new job listings or update their job search pipeline.
compatibility: Requires agent-browser, sheets-cli
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Bash(agent-browser*), Bash(sheets-cli*)
---

# Job Search Skill

Scrapes job listings from configured sources using `agent-browser`, deduplicates against the tracking spreadsheet, and appends new jobs via `sheets-cli`.

## Configuration

**Sources file:** `work/search/job-sites.md` — one URL per line (with search query baked in).

**Tracking sheet:** Google Sheet configured via `JOB_SHEET_ID` in `~/.claude/.env`
- Tab: `Jobs`
- Columns: `# | Link | Status | Company | Position | Compensation | Referral | Source | Match`

## Workflow

When the user runs `/job-search`:

### 1. Load sources
Read `work/search/job-sites.md` to get the list of job source URLs.

### 2. Load existing jobs from sheet
```bash
sheets-cli read table --spreadsheet $JOB_SHEET_ID --sheet "Jobs" --limit 500
```
Extract all existing URLs and find the max ID for numbering new entries.

### 3. Scrape each source
For each URL in the sources file, use `agent-browser` to load and extract job listings:

```bash
# Open the page and wait for dynamic content
agent-browser open "<url>"
# Wait for content to load
agent-browser wait 3000
# Get accessibility snapshot (structured data for AI parsing)
agent-browser snapshot
# Scroll down if needed for more results
agent-browser scroll down 2000
agent-browser wait 2000
agent-browser snapshot
# Close when done with all sources
agent-browser close
```

From each snapshot, extract for every job listing:
- **Company** name
- **Position** title
- **URL** (the job detail link)
- **Compensation** (if visible)
- **Source** (derive from the site name, e.g. "JobStash")

### 4. Deduplicate
Compare scraped job URLs against existing sheet URLs. A job is a duplicate if its URL slug/ID already appears in any existing URL. For JobStash, the unique slug is the alphanumeric ID in the URL path (e.g., `5HtvTo` from `.../nethermind-product-manager-...-5HtvTo/details`).

### 5. Append new jobs
For each new (non-duplicate) job, append a row:

```bash
sheets-cli append --spreadsheet $JOB_SHEET_ID --sheet "Jobs" \
  --values '{"#":"<next_id>","Link":"<job_url>","Status":"2do","Company":"<company>","Position":"<position>","Compensation":"<comp_or_empty>","Referral":"","Source":"<source_name>"}'
```

Auto-increment the ID from the max existing ID.

### 6. Report
Summarize to the user:
- How many jobs were found per source
- How many were duplicates (already in sheet)
- How many new jobs were added
- List the new jobs (company + position)

## Arguments

- Default (no args): scrape all sources, add up to 10 newest jobs per source
- `--limit N`: override the max jobs per source
- `--source <name>`: only scrape a specific source by name/URL fragment

## Source-specific notes

### Welcome to the Jungle (WTTJ)
- Requires login. Use persistent profile: `--profile ~/.agent-browser/profiles/wttj`
- **IMPORTANT:** Always pass `--profile` on the first `agent-browser` command (e.g. `open`). If the daemon is already running without the profile, close it first with `agent-browser close`, then reopen with `--profile`.
- WTTJ shows one job at a time in a card view, not a scrollable list.
- Navigate between jobs using keyboard: `agent-browser press ArrowRight` (next) and `agent-browser press ArrowLeft` (previous).
- Each card shows: company name (h1 has position + company link), compensation, level, location.
- The job URL slug is in the format `/jobs/<slug>` (e.g. `/jobs/bPNvMbv-`). Use the slug for deduplication.
- Extract job details from each card's snapshot, then press `>` to move to the next job.
- The search URL format: `https://app.welcometothejungle.com/jobs?query=product+manager&refinementList%5Bremote%5D%5B%5D=fulltime`

### LinkedIn
- Requires login. Profile stored at `~/.agent-browser/profiles/linkedin`.
- First-time setup: `agent-browser --headed --profile ~/.agent-browser/profiles/linkedin open linkedin.com` (user logs in manually).
- **Scraper script:** `bun ~/.claude/skills/job-search/linkedin-scraper.ts [--pages N] [--query "search terms"] [--dry-run]`
  - Scrapes N pages (default 4, ~7 jobs/page), resolves real application URLs, deduplicates against the sheet, and appends new jobs.
  - For External Apply jobs, captures the real destination URL (Greenhouse, Ashby, etc.).
  - For Easy Apply jobs, falls back to the LinkedIn URL.
  - Deduplicates by LinkedIn job ID, resolved URL, and company+title.
  - Filters to product roles only.
  - `--dry-run` to preview without writing to sheet.

### JobStash
- Loads content dynamically — must use `agent-browser` (not simple HTTP fetch)
- The unique slug is the alphanumeric ID in the URL path (e.g., `5HtvTo` from `.../nethermind-product-manager-...-5HtvTo/details`)

## Tips

- Always close the browser session when done: `agent-browser close`
- Run appends in parallel (up to 6) for speed
- The `snapshot` command returns an accessibility tree — parse job titles, companies, and URLs from heading elements and link URLs
