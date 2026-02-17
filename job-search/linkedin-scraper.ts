#!/usr/bin/env bun
/**
 * LinkedIn Job Scraper
 *
 * Scrapes LinkedIn job search results, resolves real application URLs,
 * deduplicates against the tracking sheet, and appends new jobs.
 *
 * Usage:
 *   bun linkedin-scraper.ts [--pages N] [--query "search terms"] [--dry-run]
 *
 * Prerequisites:
 *   - agent-browser with LinkedIn profile: ~/.agent-browser/profiles/linkedin
 *   - sheets-cli configured
 *   - User must have logged in at least once with:
 *     agent-browser --headed --profile ~/.agent-browser/profiles/linkedin open linkedin.com
 */

import { $ } from "bun";

const PROFILE = "~/.agent-browser/profiles/linkedin";
const SPREADSHEET = process.env.JOB_SHEET_ID ?? (() => { throw new Error("JOB_SHEET_ID not set in ~/.claude/.env") })();
const SHEET = "Jobs";
const DEFAULT_QUERY = "product+manager";
const DEFAULT_PAGES = 4;

// --- CLI args ---
const args = process.argv.slice(2);
let pages = DEFAULT_PAGES;
let query = DEFAULT_QUERY;
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pages" && args[i + 1]) pages = parseInt(args[i + 1]);
  if (args[i] === "--query" && args[i + 1]) query = args[i + 1].replace(/ /g, "+");
  if (args[i] === "--dry-run") dryRun = true;
}

// --- Types ---
interface ScrapedJob {
  jobId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  isEasyApply: boolean;
}

// --- Helpers ---
async function ab(...cmd: string[]): Promise<string> {
  const result = await $`agent-browser ${cmd}`.text();
  return result.trim();
}

function parseSnapshot(snapshot: string) {
  const lines = snapshot.split("\n");
  const jobs: Array<{ jobId: string; title: string; company: string; location: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const urlMatch = lines[i].match(/\/url:\s*\/jobs\/view\/(\d+)\//);
    if (!urlMatch) continue;

    const jobId = urlMatch[1];
    if (seen.has(jobId)) continue;
    seen.add(jobId);

    const titleMatch = i > 0 ? lines[i - 1].match(/link "(.+?)"\s*\[/) : null;
    const title = titleMatch ? titleMatch[1].replace(/ with verification/g, "").trim() : "";

    let company = "";
    let location = "";

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const l = lines[j].trim();
      if (!company && l.startsWith("- text: ")) {
        const c = l.slice(8).trim();
        if (c && c.length < 60 && !["Me", "Status is online"].includes(c)) company = c;
      }
      if (!location && l.includes("- listitem:")) {
        const loc = l.split("listitem:").pop()?.trim() || "";
        if (/Remote|Hybrid|On-site|Portugal|EMEA|Lisbon|Lisboa/.test(loc)) location = loc;
      }
      if (l.startsWith('- button "Dismiss')) break;
    }

    if (company) jobs.push({ jobId, title, company, location });
  }
  return jobs;
}

async function loadExistingJobs(): Promise<{ existingUrls: Set<string>; maxId: number }> {
  const result = await $`sheets-cli read table --spreadsheet ${SPREADSHEET} --sheet ${SHEET} --limit 500`.text();
  const data = JSON.parse(result);
  const rows = data.result.rows;

  const existingUrls = new Set<string>();
  let maxId = 0;

  for (const r of rows) {
    if (r.Link) {
      existingUrls.add(r.Link);
      const m = r.Link.match(/linkedin\.com\/jobs\/view\/(\d+)/);
      if (m) existingUrls.add(m[1]);
    }
    if (r["#"]) {
      const id = parseInt(r["#"]);
      if (id > maxId) maxId = id;
    }
  }

  return { existingUrls, maxId };
}

async function appendJob(id: number, job: ScrapedJob) {
  const values = JSON.stringify({
    "#": String(id),
    Link: job.url,
    Status: "2do",
    Company: job.company,
    Position: job.title,
    Compensation: "",
    Referral: "",
    Source: "LinkedIn",
    Match: "",
  });
  await $`sheets-cli append --spreadsheet ${SPREADSHEET} --sheet ${SHEET} --values ${values}`.quiet();
}

// --- Main ---
async function main() {
  console.error(`Scraping LinkedIn: query="${query}", pages=${pages}${dryRun ? " (dry run)" : ""}`);

  // 1. Load existing jobs for dedup
  console.error("Loading existing jobs from sheet...");
  const { existingUrls, maxId } = await loadExistingJobs();
  console.error(`  ${existingUrls.size} existing URLs, max ID: ${maxId}`);

  // 2. Scrape LinkedIn pages
  await $`agent-browser close 2>/dev/null || true`.quiet();
  await $`agent-browser --profile ${PROFILE} open ${"https://www.linkedin.com/jobs/search/?keywords=" + query + "&f_WT=2&sortBy=DD"}`.quiet();
  await ab("wait", "3000");

  const allJobs: Array<{ jobId: string; title: string; company: string; location: string }> = [];
  const seenIds = new Set<string>();

  for (let page = 0; page < pages; page++) {
    const start = page * 25;
    console.error(`  Page ${page + 1}/${pages} (start=${start})...`);

    if (page > 0) {
      await ab("open", `https://www.linkedin.com/jobs/search/?keywords=${query}&f_WT=2&sortBy=DD&start=${start}`);
      await ab("wait", "3000");
    }

    await ab("scroll", "down", "3000");
    await ab("wait", "1500");

    const snapshot = await ab("snapshot");
    const jobs = parseSnapshot(snapshot);

    for (const j of jobs) {
      if (!seenIds.has(j.jobId) && !existingUrls.has(j.jobId)) {
        seenIds.add(j.jobId);
        allJobs.push(j);
      }
    }
    console.error(`    Found ${jobs.length} on page, ${allJobs.length} new unique total`);
  }

  // 3. Deduplicate by company+title
  const titleSeen = new Set<string>();
  const deduped = allJobs.filter((j) => {
    const key = j.company + "|" + j.title;
    if (titleSeen.has(key)) return false;
    titleSeen.add(key);
    return true;
  });
  console.error(`After company+title dedup: ${deduped.length} jobs`);

  // 4. Filter to product roles only
  const filtered = deduped.filter((j) => {
    const t = j.title.toLowerCase();
    return t.includes("product") || t.includes("pm ");
  });
  console.error(`After product-role filter: ${filtered.length} jobs`);

  // 5. Resolve real application URLs
  console.error(`Resolving application URLs for ${filtered.length} jobs...`);
  const results: ScrapedJob[] = [];

  for (const job of filtered) {
    await ab("open", `https://www.linkedin.com/jobs/view/${job.jobId}/`);
    await ab("wait", "2000");

    const jsResult = await ab(
      "eval",
      'var btn = document.querySelector(\'button[aria-label*="on company website"]\'); if (btn) { var orig = window.open; var url = null; window.open = function(u) { url = u; return null; }; btn.click(); window.open = orig; JSON.stringify({url: url}); } else { var ea = document.querySelector(\'button[aria-label*="Easy Apply"]\'); JSON.stringify({url: null, isEasyApply: !!ea}); }'
    );

    let url = `https://www.linkedin.com/jobs/view/${job.jobId}`;
    let isEasyApply = false;
    try {
      const parsed = JSON.parse(jsResult.replace(/^"|"$/g, "").replace(/\\"/g, '"'));
      if (parsed.url) {
        const u = new URL(parsed.url);
        for (const p of ["utm_source", "utm_medium", "utm_campaign", "gh_src", "source"]) {
          u.searchParams.delete(p);
        }
        url = u.toString();
      } else {
        isEasyApply = parsed.isEasyApply || false;
      }
    } catch {}

    // Skip if resolved URL already exists in sheet
    if (existingUrls.has(url)) {
      console.error(`  SKIP (dup URL) ${job.company}: ${url.substring(0, 80)}`);
      continue;
    }

    results.push({ ...job, url, isEasyApply });
    console.error(`  ${job.company}: ${url.substring(0, 80)}`);
  }

  await $`agent-browser close`.quiet();

  // 6. Add to sheet
  if (dryRun) {
    console.error(`\nDry run - would add ${results.length} jobs:`);
    for (const j of results) {
      console.error(`  ${j.company}: ${j.title}`);
    }
  } else {
    console.error(`\nAdding ${results.length} jobs to sheet...`);
    let nextId = maxId + 1;

    // Batch in groups of 6
    for (let i = 0; i < results.length; i += 6) {
      const batch = results.slice(i, i + 6);
      await Promise.all(batch.map((j) => appendJob(nextId++, j)));
    }
    console.error("Done writing to sheet.");
  }

  // 7. Summary to stdout
  const summary = {
    scraped: allJobs.length,
    afterDedup: filtered.length,
    added: results.length,
    jobs: results.map((j) => ({
      company: j.company,
      position: j.title,
      url: j.url,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
