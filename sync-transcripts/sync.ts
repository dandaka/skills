#!/usr/bin/env bun
/**
 * Hyprnote → Knowledge Base sync tool.
 *
 * Reads all Hyprnote session metadata, compares against a local index
 * (sessions-index.json), and reports new/unsynced sessions.
 *
 * Usage:
 *   bun sync.ts <calls_dir>              # show new sessions
 *   bun sync.ts <calls_dir> --convert    # convert new sessions to markdown
 *   bun sync.ts <calls_dir> --rebuild    # rebuild index from existing calls/*.md
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join } from "path";

const CALLS_DIR = process.argv[2];
if (!CALLS_DIR) {
  console.error("Usage: bun sync.ts <calls_dir> [--convert|--rebuild]");
  process.exit(1);
}

const INDEX_PATH = join(CALLS_DIR, "sessions-index.json");
const SESSIONS_DIR = `${process.env.HOME}/Library/Application Support/hyprnote/sessions`;
const CONVERT_SCRIPT = join(import.meta.dir, "convert.ts");

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

interface SessionMeta {
  id: string;
  title: string;
  created_at: string;
  participants: string[];
}

interface IndexEntry {
  id: string;
  title: string;
  created_at: string;
  filename: string;
  synced: boolean;
}

type SessionIndex = Record<string, IndexEntry>;

function readHyprnoteSessions(): SessionMeta[] {
  if (!existsSync(SESSIONS_DIR)) return [];
  const entries = readdirSync(SESSIONS_DIR).filter(e => !e.startsWith("."));
  const sessions: SessionMeta[] = [];

  for (const dir of entries) {
    const metaPath = join(SESSIONS_DIR, dir, "_meta.json");
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      const transcriptPath = join(SESSIONS_DIR, dir, "transcript.json");
      const tBytes = existsSync(transcriptPath) ? statSync(transcriptPath).size : 0;
      if (tBytes < 500) continue;
      sessions.push({
        id: meta.id || dir,
        title: meta.title || "",
        created_at: meta.created_at || "",
        participants: meta.participants || [],
      });
    } catch {
      // skip broken meta files
    }
  }

  return sessions.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function expectedFilename(session: SessionMeta): string {
  const date = session.created_at.substring(0, 10);
  const slug = slugify(session.title);
  return `${date}-${slug}.md`;
}

function loadIndex(): SessionIndex {
  if (!existsSync(INDEX_PATH)) return {};
  try {
    return JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveIndex(index: SessionIndex): void {
  const sorted = Object.fromEntries(
    Object.entries(index).sort(([, a], [, b]) => a.created_at.localeCompare(b.created_at))
  );
  writeFileSync(INDEX_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
}

function getExistingCallFiles(): Set<string> {
  return new Set(
    readdirSync(CALLS_DIR)
      .filter(f => f.endsWith(".md") && f !== "README.md")
  );
}

// --- Commands ---

const command = process.argv[3] || "--status";

if (command === "--rebuild") {
  const sessions = readHyprnoteSessions();
  const existing = getExistingCallFiles();
  const index: SessionIndex = {};

  for (const session of sessions) {
    const fname = expectedFilename(session);
    index[session.id] = {
      id: session.id,
      title: session.title,
      created_at: session.created_at,
      filename: fname,
      synced: existing.has(fname),
    };
  }

  // Fuzzy match for old slug variants
  for (const [id, entry] of Object.entries(index)) {
    if (entry.synced) continue;
    const datePrefix = entry.created_at.substring(0, 10);
    for (const file of existing) {
      if (file.startsWith(datePrefix) && !Object.values(index).some(e => e.filename === file && e.synced)) {
        const titleWords = entry.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const fileSlug = file.replace(/\.md$/, "").substring(11);
        const matchCount = titleWords.filter(w => fileSlug.includes(w)).length;
        if (matchCount >= Math.min(2, titleWords.length)) {
          entry.filename = file;
          entry.synced = true;
          break;
        }
      }
    }
  }

  saveIndex(index);
  const total = Object.keys(index).length;
  const synced = Object.values(index).filter(e => e.synced).length;
  console.log(`Index rebuilt: ${total} sessions, ${synced} synced, ${total - synced} new`);
} else {
  const index = loadIndex();
  const sessions = readHyprnoteSessions();
  const existing = getExistingCallFiles();

  for (const session of sessions) {
    if (index[session.id]) {
      if (!index[session.id].synced && existing.has(index[session.id].filename)) {
        index[session.id].synced = true;
      }
      continue;
    }

    const fname = expectedFilename(session);
    const entry: IndexEntry = {
      id: session.id,
      title: session.title,
      created_at: session.created_at,
      filename: fname,
      synced: existing.has(fname),
    };
    index[session.id] = entry;
  }

  const unsynced = Object.values(index).filter(e => !e.synced);
  if (unsynced.length === 0) {
    console.log("All sessions are synced.");
  } else {
    console.log(`${unsynced.length} unsynced session(s):\n`);
    for (const entry of unsynced.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      console.log(`  ${entry.created_at.substring(0, 10)}  ${entry.title}`);
      console.log(`    → ${entry.filename}  (id: ${entry.id})`);
    }
  }

  if (command === "--convert") {
    console.log("\n--- Converting ---\n");
    for (const entry of unsynced.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const sessionFolder = join(SESSIONS_DIR, entry.id);
      const outputPath = join(CALLS_DIR, entry.filename);
      console.log(`Converting: ${entry.title}`);
      const result = Bun.spawnSync(["bun", CONVERT_SCRIPT, sessionFolder, outputPath]);
      if (result.exitCode === 0) {
        entry.synced = true;
        console.log(`  ✓ ${entry.filename}`);
      } else if (result.exitCode === 2) {
        entry.synced = true;
        console.log(`  ⊘ Skipped (too short)`);
      } else {
        console.error(`  ✗ Error: ${result.stderr.toString()}`);
      }
    }
  }

  saveIndex(index);
}
