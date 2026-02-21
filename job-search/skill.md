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

**IMPORTANT:** Always load `$JOB_SHEET_ID` from env first:
```bash
source ~/.claude/.env
```

Then read the sheet:
```bash
sheets-cli read table --spreadsheet $JOB_SHEET_ID --sheet "Jobs" --limit 500
```

**Parsing notes:**
- The output may contain control characters that cause strict JSON parsers to fail. Always parse with `strict=False` in Python, e.g.: `json.loads(content, strict=False)`
- Extract all existing URLs and find the max `#` value for numbering new entries.

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

Auto-increment the ID from the max existing `#` value.

### Updating a row status
To update a field (e.g. status) by row ID, use:
```bash
sheets-cli update key \
  --spreadsheet $JOB_SHEET_ID \
  --sheet "Jobs" \
  --key-col "#" \
  --key "<row_id>" \
  --set '{"Status":"Not fit"}'
```

**Do NOT use** `sheets-cli update --where` or `sheets-cli update --spreadsheet` — those don't exist. The correct subcommand is `update key` or `update row`.

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
- The "Apply Directly" button may open a new tab or require login. To get the real application URL without clicking, extract it from the page source:
  ```bash
  curl -s "https://jobstash.xyz/jobs/<slug>/details" | grep -o '"url":"[^"]*"' | grep -v "jobstash\|twitter\|telegram\|warpcast\|linkedin" | head -3
  ```

## Applying to jobs (opportunity flow)

When applying to a batch of `2do` jobs:

1. **Check if job is still open first** before doing any CV/form work. For JobStash URLs, use curl to check for `"title":` in the response:
   ```bash
   curl -s "<url>" | grep -o '"title":"[^"]*"' | head -1
   ```
   If `Job Not Found` is returned, mark as `Not fit` immediately and skip.

2. **Always open forms with remote debugging enabled** so the human can connect via `chrome://inspect` and review before submitting.

   `agent-browser --cdp 9222` does NOT expose a port — it means "connect agent-browser TO an existing Chrome on 9222". That is the wrong direction.

   The correct approach: set env vars so agent-browser's internal Chromium exposes a debug port:
   ```bash
   agent-browser close  # kill any existing daemon first
   export AGENT_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   export AGENT_BROWSER_ARGS="--remote-debugging-port=9222"
   agent-browser open "<application_url>"
   ```
   Then verify the port is up: `curl -s http://localhost:9222/json/version`

   The user can now go to `chrome://inspect` → Configure → `localhost:9222` to see the page.

   All subsequent `agent-browser` commands in the session work normally (no `--cdp` flag needed — the daemon is already running).

3. **Before filling the form, capture all fields to a markdown file.** Scroll through the entire form first, then create `leads/<id>-<slug>/answers.md` with this structure:

   ```markdown
   # Application Form: <Company> - <Position>

   | Field | Type | Proposed Answer |
   |-------|------|-----------------|
   | Full Name | text (short) | Vlad Ra |
   | Email | email (short) | vlad@example.com |
   | Cover Letter | textarea | <one paragraph> |
   | LinkedIn URL | url (short) | https://linkedin.com/in/vladra |
   | Why do you want to work here? | textarea | <2-3 sentences> |
   ```

   **Field type values:** `text (short)`, `email (short)`, `url (short)`, `select`, `textarea`, `checkbox`, `file`

   **Answer length rules:**
   - `short` fields (text, email, url, select): one sentence maximum, no padding
   - `textarea` fields: concise paragraph, focus on relevance to role
   - `file` fields: note the file path (e.g., `leads/<id>/cv.pdf`)

   Show the user the `answers.md` and **wait for their confirmation** before filling any fields.

4. For file upload (resume), use `agent-browser upload` targeting the hidden `input[type="file"]` by CSS selector or ID - NOT the visible button:
   ```bash
   # Find the input ID first via JS:
   agent-browser eval "Array.from(document.querySelectorAll('input[type=file]')).map(el => ({id: el.id, accept: el.accept}))"
   # Then upload using the CSS ID:
   agent-browser upload "#_systemfield_resume" /path/to/cv.pdf   # Ashby
   agent-browser upload "#candidate_resume_remote_url" /path/to/cv.pdf  # Teamtailor
   ```
   Do NOT use `agent-browser upload @ref` on a `<button>` element - it must be the actual `<input type="file">`.

5. **After uploading the file, wait 20-30 seconds.** Ashby does a background sync after upload. If you submit too early, it shows: *"We're updating your application (e.g. uploading files), please try again when they're finished."* Wait until the warning disappears.
   ```bash
   agent-browser upload "#_systemfield_resume" /path/to/cv.pdf
   sleep 25
   agent-browser snapshot 2>&1 | grep -E "updating|uploading"
   ```

6. **agent-browser refs reset after every dropdown interaction.** After clicking a combobox option, always run `agent-browser snapshot` again to get fresh refs before filling the next field.

7. **Hand off to the user for final review and submission.** Once all fields are filled and the file is uploaded, do NOT click Submit. Tell the user:
   > "Form is filled and ready. To connect and review:
   > 1. Open Chrome and go to `chrome://inspect`
   > 2. Under **Remote Target**, click **inspect** on the page that appears
   > 3. Review all fields, then click Submit yourself."

   Leave the browser session open and wait. **Do NOT close it.** After the user confirms they submitted, update status to `Applied`:
   ```bash
   sheets-cli update key --spreadsheet $JOB_SHEET_ID --sheet "Jobs" --key-col "#" --key "<id>" --set '{"Status":"Applied"}'
   ```

## Local sync (jobs-local.json)

The sheet is the source of truth. Use the sync script to clone it locally for fast offline access.

```bash
# Sync all jobs (default output: work/search/jobs-local.json)
bun ~/.claude/skills/job-search/sync.ts

# Sync only "2do" jobs
bun ~/.claude/skills/job-search/sync.ts --status 2do

# Custom output path
bun ~/.claude/skills/job-search/sync.ts --out /tmp/jobs.json
```

The output JSON format:
```json
{
  "meta": { "syncedAt": "...", "total": 500, "count": 42, "statusFilter": "2do" },
  "jobs": [
    { "#": "1", "Link": "...", "Status": "2do", "Company": "...", "Position": "...", ... }
  ]
}
```

**When to re-sync:** before any batch processing session. The local file is a point-in-time snapshot — always re-sync to get fresh data. The file is tracked in git (snapshot history).

**Reading locally synced jobs in code:**
```ts
const { jobs } = JSON.parse(await Bun.file("work/search/jobs-local.json").text());
```

**Legacy one-liner** (still works, but prefer the script above):
```bash
source ~/.claude/.env && sheets-cli read table --spreadsheet $JOB_SHEET_ID --sheet "Jobs" --limit 500 > /tmp/jobs-full.json && jq '.result.rows | map(select(.Status == "2do"))' /tmp/jobs-full.json > work/search/todo-jobs.json
```

## Regenerating all CVs

**IMPORTANT: Always regenerate PDFs in a single batch command - never one-by-one per folder.**

To rebuild every `cv.pdf` from its `cv.md` in one shot:

```bash
bash work/search/regen-pdfs.sh
```

The script iterates over every `leads/*/` directory that contains a `cv.md` and runs `md-to-pdf cv.md` inside it.

To only regenerate PDFs that are missing (new cv.md files without a cv.pdf):

```bash
for dir in work/search/leads/*/; do
  [ -f "$dir/cv.md" ] && [ ! -f "$dir/cv.pdf" ] && (cd "$dir" && md-to-pdf cv.md)
done
```

Do NOT call `md-to-pdf cv.md` individually for each folder as agents complete - always use batch commands above.

## Tips

- Always `source ~/.claude/.env` before using `$JOB_SHEET_ID`
- Always close the browser session when done: `agent-browser close`
- Run appends in parallel (up to 6) for speed
- The `snapshot` command returns an accessibility tree — parse job titles, companies, and URLs from heading elements and link URLs
- Parse sheet JSON output with `strict=False` to handle control characters in cell values
