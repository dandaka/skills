#!/usr/bin/env bun
/**
 * OpenOats → Knowledge Base sync tool.
 *
 * Scans ~/Library/Application Support/OpenOats/sessions for recorded sessions
 * and converts them to markdown in <calls_dir>/openoats/.
 *
 * OpenOats transcribes locally (parakeetV3) as the call happens, so unlike the
 * Zoom path there is nothing to transcribe here — transcript.live.jsonl is
 * already present and carries per-utterance speaker labels.
 *
 * Usage:
 *   bun openoats.ts <calls_dir>                    # show new recordings
 *   bun openoats.ts <calls_dir> --convert [filter] # convert new recordings (filter = session-id substring)
 *   bun openoats.ts <calls_dir> --rebuild          # rebuild index from existing openoats/*.md
 *   bun openoats.ts <calls_dir> --untitled         # list synced calls still waiting for a real title
 *   bun openoats.ts <calls_dir> --rename <session-id> "<Title>"  # give a synced call a descriptive title
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

const CALLS_DIR = process.argv[2];
if (!CALLS_DIR) {
  console.error("Usage: bun openoats.ts <calls_dir> [--convert|--rebuild] [filter]");
  process.exit(1);
}

const INDEX_PATH = join(CALLS_DIR, "openoats-index.json");
const OO_DIR = `${process.env.HOME}/Library/Application Support/OpenOats/sessions`;
const OO_OUT_DIR = join(CALLS_DIR, "openoats");

const SESSION_RE = /^session_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})$/;

/** Sessions with fewer utterances than this carry no real content. */
const MIN_UTTERANCES = 10;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

interface Utterance {
  speaker?: string;
  text?: string;
  timestamp?: string;
}

interface SessionMeta {
  id?: string;
  title?: string;
  startedAt?: string;
  endedAt?: string;
  engine?: string;
  utteranceCount?: number;
}

interface Recording {
  id: string; // session folder name
  title: string;
  created_at: string; // local wall-clock, from the folder name
  utterances: Utterance[];
  untitled: boolean;
}

interface IndexEntry {
  id: string;
  title: string;
  created_at: string;
  filename: string;
  synced: boolean;
  renamed?: boolean; // title set via --rename, not by OpenOats
}

type Index = Record<string, IndexEntry>;

function loadIndex(): Index {
  if (!existsSync(INDEX_PATH)) return {};
  return JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
}

function saveIndex(index: Index): void {
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf-8");
}

function readUtterances(dir: string): Utterance[] {
  const path = join(dir, "transcript.live.jsonl");
  if (!existsSync(path)) return [];
  const out: Utterance[] = [];
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // A live-written JSONL can end mid-line if the app died; skip that line.
    }
  }
  return out;
}

/**
 * OpenOats only stores a title when the user set one. Everything else is
 * identified by timestamp, so fall back to the date rather than inventing a
 * topic — the caller can rename later.
 */
function deriveTitle(meta: SessionMeta, date: string, time: string): { title: string; untitled: boolean } {
  const t = meta.title?.trim();
  if (t && !GENERIC_TITLES.has(t.toLowerCase())) return { title: t, untitled: false };
  // Keep the app name in the placeholder ("Zoom 2026-11-06 19:14") so the
  // pre-rename filename still hints at where the call happened.
  const prefix = t || "OpenOats session";
  return { title: `${prefix} ${date} ${time}`, untitled: true };
}

/**
 * OpenOats auto-fills the title with the meeting app's name. That says nothing
 * about the topic, so treat it as untitled and flag the file for renaming.
 */
const GENERIC_TITLES = new Set(["zoom", "google meet", "meet", "microsoft teams", "teams", "facetime", "slack", "telegram", "whatsapp", "discord"]);

function discover(): Recording[] {
  if (!existsSync(OO_DIR)) return [];
  const recordings: Recording[] = [];

  for (const entry of readdirSync(OO_DIR)) {
    const m = entry.match(SESSION_RE);
    if (!m) continue;

    const dir = join(OO_DIR, entry);
    const [, date, hh, mm, ss] = m;

    let meta: SessionMeta = {};
    const metaPath = join(dir, "session.json");
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {
        // Fall through to timestamp-derived defaults.
      }
    }

    const utterances = readUtterances(dir).filter((u) => (u.text ?? "").trim());
    const { title, untitled } = deriveTitle(meta, date, `${hh}:${mm}`);

    recordings.push({
      id: entry,
      title,
      created_at: `${date}T${hh}:${mm}:${ss}`,
      utterances,
      untitled,
    });
  }

  return recordings.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function speakerLabel(speaker: string | undefined): string {
  if (speaker === "you") return "Me";
  if (speaker === "them") return "Other";
  return "Speaker";
}

/**
 * Roughly one paragraph's worth of speech. A session where every utterance
 * carries the same label (mislabelled channel, or a genuine monologue) would
 * otherwise merge into a single unreadable block, so cap how much runs
 * together before starting a new turn.
 */
const MAX_TURN_CHARS = 700;

/** Merge consecutive utterances from the same speaker into one turn. */
function buildTurns(utterances: Utterance[]): Array<{ speaker: string; text: string }> {
  const turns: Array<{ speaker: string; text: string }> = [];
  for (const u of utterances) {
    const text = (u.text ?? "").trim();
    if (!text) continue;
    const label = speakerLabel(u.speaker);
    const last = turns[turns.length - 1];
    if (last && last.speaker === label && last.text.length + text.length + 1 <= MAX_TURN_CHARS) {
      last.text += " " + text;
    } else {
      turns.push({ speaker: label, text });
    }
  }
  return turns;
}

function filenameFor(rec: Recording, index: Index): string {
  const date = rec.created_at.substring(0, 10);
  const base = `${date}-${slugify(rec.title)}`;
  const taken = new Set(
    Object.values(index)
      .filter((e) => e.id !== rec.id)
      .map((e) => e.filename)
  );
  let name = `${base}.md`;
  if (taken.has(name)) {
    // Same title on the same day: disambiguate with the recording time.
    const hhmmss = rec.created_at.substring(11).replace(/:/g, "");
    name = `${base}-${hhmmss}.md`;
  }
  return name;
}

const UNTITLED_NOTE =
  "Untitled in OpenOats — rename with `openoats.ts <calls_dir> --rename <session-id> \"<Title>\"` once the topic is confirmed.";

function toMarkdown(rec: Recording): string {
  const turns = buildTurns(rec.utterances);
  const date = rec.created_at.substring(0, 10);
  const speakers = new Set(turns.map((t) => t.speaker));

  const notes: string[] = [];
  if (rec.untitled) {
    notes.push(UNTITLED_NOTE);
  }
  if (speakers.size === 1) {
    notes.push(
      `Every utterance was labelled "${[...speakers][0]}" — OpenOats captured only one ` +
        `channel here, so speaker attribution in this transcript is unreliable even if ` +
        `several people are talking.`
    );
  }

  const noteBlock = notes.length ? `\n${notes.map((n) => `> [!note] ${n}`).join("\n")}\n` : "";

  const body = turns.map((t) => `**${t.speaker}:** ${t.text}`).join("\n\n");

  return `# ${rec.title}

**Date:** ${date}
**Source:** OpenOats (\`${rec.id}\`)
**Participants:** Unknown
${noteBlock}
## Summary

<!-- TODO: Add summary -->

## Transcript

${body}
`;
}

const args = process.argv.slice(3);
const doConvert = args.includes("--convert");
const doRebuild = args.includes("--rebuild");
const doRename = args.includes("--rename");
const doUntitled = args.includes("--untitled");
const filter = args.find((a) => !a.startsWith("--"));

const index = loadIndex();

/**
 * Give a synced call a descriptive title: renames the markdown file, rewrites
 * its H1, drops the "untitled" note and records the new name in the index.
 * The session id never changes, so later runs still see it as synced.
 */
function rename(idFilter: string, newTitle: string): void {
  const matches = Object.values(index).filter((e) => e.id.includes(idFilter));
  if (matches.length !== 1) {
    console.error(`--rename: "${idFilter}" matches ${matches.length} indexed session(s); need exactly 1.`);
    process.exit(1);
  }
  const entry = matches[0];
  const oldPath = join(OO_OUT_DIR, entry.filename);
  if (!existsSync(oldPath)) {
    console.error(`--rename: ${oldPath} does not exist.`);
    process.exit(1);
  }

  const rec: Recording = { id: entry.id, title: newTitle, created_at: entry.created_at, utterances: [], untitled: false };
  const filename = filenameFor(rec, index);
  const newPath = join(OO_OUT_DIR, filename);
  if (filename !== entry.filename && existsSync(newPath)) {
    console.error(`--rename: ${filename} already exists.`);
    process.exit(1);
  }

  const content = readFileSync(oldPath, "utf-8")
    .replace(/^# .*$/m, `# ${newTitle}`)
    .replace(/^> \[!note\] Untitled in OpenOats.*\n/m, "");
  writeFileSync(newPath, content, "utf-8");
  if (newPath !== oldPath) unlinkSync(oldPath);

  index[entry.id] = { ...entry, title: newTitle, filename, renamed: true };
  saveIndex(index);
  console.log(`  ${entry.filename} → ${filename}`);
}

if (doRename) {
  const [idFilter, ...titleParts] = args.filter((a) => !a.startsWith("--"));
  const newTitle = titleParts.join(" ").trim();
  if (!idFilter || !newTitle) {
    console.error('Usage: bun openoats.ts <calls_dir> --rename <session-id> "<New title>"');
    process.exit(1);
  }
  rename(idFilter, newTitle);
  process.exit(0);
}

if (doUntitled) {
  // Synced files still waiting for a descriptive title.
  const waiting = Object.values(index).filter(
    (e) => e.synced && !e.renamed && existsSync(join(OO_OUT_DIR, e.filename)) &&
      (GENERIC_TITLES.has(e.title.trim().toLowerCase()) ||
        readFileSync(join(OO_OUT_DIR, e.filename), "utf-8").includes("Untitled in OpenOats"))
  );
  if (!waiting.length) console.log("No untitled OpenOats calls.");
  for (const e of waiting) console.log(`  ${e.id}  ${e.filename}`);
  process.exit(0);
}

const recordings = discover();

if (doRebuild) {
  const rebuilt: Index = {};
  for (const rec of recordings) {
    if (rec.utterances.length < MIN_UTTERANCES) continue;
    // Keep titles given with --rename; OpenOats itself never learns about them.
    const prev = index[rec.id];
    if (prev?.renamed && existsSync(join(OO_OUT_DIR, prev.filename))) {
      rebuilt[rec.id] = { ...prev, synced: true };
      continue;
    }
    const filename = filenameFor(rec, rebuilt);
    rebuilt[rec.id] = {
      id: rec.id,
      title: rec.title,
      created_at: rec.created_at,
      filename,
      synced: existsSync(join(OO_OUT_DIR, filename)),
    };
  }
  saveIndex(rebuilt);
  const synced = Object.values(rebuilt).filter((e) => e.synced).length;
  console.log(`Rebuilt index: ${Object.keys(rebuilt).length} session(s), ${synced} already synced.`);
  process.exit(0);
}

const skipped = recordings.filter((r) => r.utterances.length < MIN_UTTERANCES);
const usable = recordings.filter((r) => r.utterances.length >= MIN_UTTERANCES);
const pending = usable.filter((r) => !index[r.id]?.synced);

if (skipped.length) {
  console.log(`Skipping ${skipped.length} empty/near-empty session(s):`);
  for (const r of skipped) {
    console.log(`  ${r.id} (${r.utterances.length} utterance(s))`);
  }
  console.log("");
}

if (pending.length === 0) {
  console.log("All OpenOats sessions are synced.");
  process.exit(0);
}

console.log(`${pending.length} unsynced OpenOats recording(s):\n`);
for (const rec of pending) {
  const filename = index[rec.id]?.filename ?? filenameFor(rec, index);
  console.log(`  ${rec.created_at.substring(0, 10)}  ${rec.title}`);
  console.log(`    → ${filename}`);
}

if (!doConvert) process.exit(0);

const targets = filter ? pending.filter((r) => r.id.includes(filter)) : pending;

console.log("\n--- Converting ---\n");
mkdirSync(OO_OUT_DIR, { recursive: true });

let converted = 0;
for (const rec of targets) {
  console.log(`Converting: ${rec.title}`);
  const filename = index[rec.id]?.filename ?? filenameFor(rec, index);
  const outPath = join(OO_OUT_DIR, filename);

  writeFileSync(outPath, toMarkdown(rec), "utf-8");

  index[rec.id] = {
    id: rec.id,
    title: rec.title,
    created_at: rec.created_at,
    filename,
    synced: true,
  };
  saveIndex(index);

  converted++;
  console.log(`  ✓ ${filename}`);
}

console.log(`\nConverted ${converted} recording(s).`);
