#!/usr/bin/env bun
/**
 * Job Sheet Sync
 *
 * Downloads all jobs from the Google Sheet (source of truth) to a local JSON file
 * for faster local operations. Run this to refresh local state before batch processing.
 *
 * Usage:
 *   bun sync.ts [--out <path>] [--status <status>]
 *
 * Default output: work/search/jobs-local.json
 * With --status: filters to only jobs with that status (e.g. "2do")
 *
 * Output format: array of job objects with fields:
 *   #, Link, Status, Company, Position, Compensation, Referral, Source, Match
 */

import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const SPREADSHEET = process.env.JOB_SHEET_ID ?? (() => { throw new Error("JOB_SHEET_ID not set in ~/.claude/.env") })();
const SHEET = "Jobs";
const DEFAULT_OUT = "work/search/jobs-local.json";

// --- CLI args ---
const args = process.argv.slice(2);
let outPath = DEFAULT_OUT;
let statusFilter: string | null = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out" && args[i + 1]) outPath = args[i + 1];
  if (args[i] === "--status" && args[i + 1]) statusFilter = args[i + 1];
}

interface Job {
  "#": string;
  Link: string;
  Status: string;
  Company: string;
  Position: string;
  Compensation: string;
  Referral: string;
  Source: string;
  Match: string;
  [key: string]: string;
}

async function main() {
  console.log(`Syncing from sheet: ${SPREADSHEET} / ${SHEET} ...`);

  const raw = await $`sheets-cli read table --spreadsheet ${SPREADSHEET} --sheet ${SHEET} --limit 2000`.text();

  let parsed: { result: { rows: Job[] } };
  try {
    // Use eval-style parse to handle control characters in cell values
    parsed = JSON.parse(raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " "));
  } catch {
    // Fallback: strip all control chars more aggressively
    const cleaned = raw.replace(/[^\x09\x0A\x0D\x20-\uFFFF]/g, " ");
    parsed = JSON.parse(cleaned);
  }

  let jobs: Job[] = parsed.result.rows;
  const total = jobs.length;

  if (statusFilter) {
    jobs = jobs.filter((j) => j.Status === statusFilter);
    console.log(`Filtered to status="${statusFilter}": ${jobs.length} of ${total} jobs`);
  } else {
    console.log(`Fetched ${total} jobs`);
  }

  const outDir = dirname(outPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const meta = {
    syncedAt: new Date().toISOString(),
    total,
    count: jobs.length,
    statusFilter: statusFilter ?? "all",
    spreadsheet: SPREADSHEET,
    sheet: SHEET,
  };

  const output = { meta, jobs };
  await Bun.write(outPath, JSON.stringify(output, null, 2));

  console.log(`Saved to ${outPath}`);
  console.log(`  syncedAt: ${meta.syncedAt}`);
  console.log(`  jobs: ${meta.count}${statusFilter ? ` (status="${statusFilter}")` : ""}`);
}

main().catch((e) => {
  console.error("Sync failed:", e.message);
  process.exit(1);
});
