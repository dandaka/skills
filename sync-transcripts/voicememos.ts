#!/usr/bin/env bun
/**
 * Apple Voice Memos → Knowledge Base sync tool.
 *
 * Reads the Voice Memos CloudKit store (synced from iPhone via iCloud) and
 * converts recordings to markdown in <calls_dir>/voicememos/.
 *
 * Unlike Hyprnote/OpenOats, Voice Memos does not transcribe anything — this
 * path transcribes locally with Parakeet TDT, the same as the Zoom path.
 *
 * Recordings are flat files in the shared container, not session folders, so
 * each one is staged into a work folder (_meta.json + extracted audio) and
 * then handed to the existing transcribe-local.py + convert.ts pipeline.
 *
 * Requires Full Disk Access for the host app — the container is TCC-protected.
 *
 * Usage:
 *   bun voicememos.ts <calls_dir>                    # show new recordings
 *   bun voicememos.ts <calls_dir> --convert [filter] # convert new recordings
 *   bun voicememos.ts <calls_dir> --rebuild          # rebuild index from voicememos/*.md
 *   bun voicememos.ts <calls_dir> --convert --limit 3
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";

const CALLS_DIR = process.argv[2];
if (!CALLS_DIR) {
  console.error("Usage: bun voicememos.ts <calls_dir> [--convert|--rebuild] [filter] [--limit N]");
  process.exit(1);
}

const INDEX_PATH = join(CALLS_DIR, "voicememos-index.json");
const VM_DIR = `${process.env.HOME}/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings`;
const VM_DB = join(VM_DIR, "CloudRecordings.db");
const VM_OUT_DIR = join(CALLS_DIR, "voicememos");
const WORK_DIR = `${process.env.HOME}/.cache/sync-transcripts/voicememos`;

const CONVERT_SCRIPT = join(import.meta.dir, "convert.ts");
const LOCAL_TRANSCRIBE = join(import.meta.dir, "transcribe-local.py");

/**
 * Voice Memos is also used for seconds-long personal notes. Meetings are the
 * point of this sync, so anything shorter than this is noise.
 */
const MIN_DURATION_SEC = 120;

/** Core Data epoch (2001-01-01) → Unix epoch offset. */
const CORE_DATA_EPOCH = 978307200;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

interface Recording {
  id: string; // ZUNIQUEID, stable across renames
  title: string;
  created_at: string; // local wall-clock
  duration: number; // seconds
  path: string; // absolute path to the source audio
  untitled: boolean;
}

interface IndexEntry {
  id: string;
  title: string;
  created_at: string;
  filename: string;
  synced: boolean;
}

type Index = Record<string, IndexEntry>;

function loadIndex(): Index {
  if (!existsSync(INDEX_PATH)) return {};
  return JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
}

function saveIndex(index: Index): void {
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf-8");
}

/**
 * Voice Memos auto-names untitled recordings with an ISO timestamp, which
 * makes a poor filename. Treat those as untitled so they get flagged for a
 * rename rather than silently becoming `2026-09-04t162724z.md`.
 */
const AUTO_TITLE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/;

function deriveTitle(label: string | null, date: string, time: string): { title: string; untitled: boolean } {
  const t = (label ?? "").trim();
  if (t && !AUTO_TITLE_RE.test(t)) return { title: t, untitled: false };
  return { title: `Voice memo ${date} ${time}`, untitled: true };
}

/**
 * The live database is WAL-mode and may be mid-write by the Voice Memos app.
 * Copy db + -wal + -shm to a scratch dir so sqlite can replay the WAL and see
 * recordings that have synced but not yet checkpointed — reading the .db
 * alone would silently miss the newest ones.
 */
function snapshotDb(): string {
  if (!existsSync(VM_DB)) {
    console.error(`Voice Memos database not found at:\n  ${VM_DB}`);
    console.error(`\nIs Voice Memos iCloud sync enabled on this Mac?`);
    process.exit(1);
  }
  mkdirSync(WORK_DIR, { recursive: true });
  const snap = join(WORK_DIR, "_db");
  mkdirSync(snap, { recursive: true });
  const dest = join(snap, "CloudRecordings.db");
  try {
    copyFileSync(VM_DB, dest);
    for (const ext of ["-wal", "-shm"]) {
      if (existsSync(VM_DB + ext)) copyFileSync(VM_DB + ext, dest + ext);
    }
  } catch (err) {
    console.error(`Cannot read the Voice Memos database: ${(err as Error).message}`);
    console.error(
      `\nThis container is TCC-protected. Grant Full Disk Access to the app running\n` +
        `this session (System Settings → Privacy & Security → Full Disk Access),\n` +
        `then fully quit and reopen it — the grant only applies on restart.`
    );
    process.exit(1);
  }
  return dest;
}

function query(db: string, sql: string): string[][] {
  const res = Bun.spawnSync(["sqlite3", "-separator", "", db, sql]);
  if (res.exitCode !== 0) {
    console.error(`sqlite3 failed: ${res.stderr.toString().trim()}`);
    process.exit(1);
  }
  return res.stdout
    .toString()
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.split(""));
}

function discover(): Recording[] {
  const db = snapshotDb();
  const rows = query(
    db,
    `SELECT ZUNIQUEID, COALESCE(ZCUSTOMLABEL,''), ZPATH, ZDURATION,
            strftime('%Y-%m-%dT%H:%M:%S', ZDATE + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime')
     FROM ZCLOUDRECORDING
     WHERE ZPATH IS NOT NULL AND ZPATH != ''
     ORDER BY ZDATE ASC;`
  );

  const recordings: Recording[] = [];
  for (const [id, label, path, dur, created] of rows) {
    // ZPATH is a bare filename in the same Recordings dir.
    const abs = join(VM_DIR, path);
    if (!existsSync(abs)) continue; // not downloaded from iCloud yet
    const date = created.substring(0, 10);
    const time = created.substring(11, 16);
    const { title, untitled } = deriveTitle(label, date, time);
    recordings.push({
      id: id || path,
      title,
      created_at: created,
      duration: parseFloat(dur) || 0,
      path: abs,
      untitled,
    });
  }
  return recordings;
}

/**
 * `reserved` carries names already handed out earlier in this same run.
 * Without it, a batch of recordings sharing a title and timestamp (Voice
 * Memos bulk-imports land seconds apart) would all resolve to one filename
 * and silently overwrite each other.
 */
function filenameFor(rec: Recording, index: Index, reserved: Set<string> = new Set()): string {
  const date = rec.created_at.substring(0, 10);
  const base = `${date}-${slugify(rec.title)}`;
  const taken = new Set([
    ...Object.values(index)
      .filter((e) => e.id !== rec.id)
      .map((e) => e.filename),
    ...reserved,
  ]);

  let name = `${base}.md`;
  if (!taken.has(name)) return name;

  const hhmmss = rec.created_at.substring(11).replace(/:/g, "");
  name = `${base}-${hhmmss}.md`;
  if (!taken.has(name)) return name;

  // Same title *and* second: only the recording's own id can separate these.
  const suffix = rec.id.replace(/[^A-Za-z0-9]/g, "").slice(-8).toLowerCase();
  return `${base}-${hhmmss}-${suffix}.md`;
}

/**
 * Stage a recording as a session folder the shared pipeline understands.
 *
 * .qta files carry several streams (stereo AAC + a 4-channel spatial mix +
 * data tracks), so pin stream 0 explicitly — letting ffmpeg choose can pick
 * the spatial track and yield an unusable transcript. Downmix to 16 kHz mono
 * wav, which is what Parakeet wants anyway.
 */
function stage(rec: Recording): string | null {
  const folder = join(WORK_DIR, rec.id.replace(/[^A-Za-z0-9._-]/g, "_"));
  mkdirSync(folder, { recursive: true });

  const metaPath = join(folder, "_meta.json");
  if (!existsSync(metaPath)) {
    writeFileSync(
      metaPath,
      JSON.stringify(
        { id: rec.id, title: rec.title, created_at: rec.created_at, participants: [] },
        null,
        2
      ) + "\n",
      "utf-8"
    );
  }

  const audio = join(folder, "audio.wav");
  if (existsSync(audio)) return folder;

  const res = Bun.spawnSync([
    "ffmpeg", "-nostdin", "-v", "error", "-y",
    "-i", rec.path,
    "-map", "0:a:0",
    "-ac", "1", "-ar", "16000",
    audio,
  ]);
  if (res.exitCode !== 0) {
    console.error(`  ✗ ffmpeg failed: ${res.stderr.toString().trim()}`);
    return null;
  }
  return folder;
}

function transcribeLocal(folderPath: string): number {
  const res = Bun.spawnSync(["python3", LOCAL_TRANSCRIBE, folderPath], { stdout: "inherit", stderr: "pipe" });
  if (res.exitCode !== 0) {
    console.error(`  ✗ Local transcription failed: ${res.stderr.toString().trim()}`);
    return 1;
  }
  return 0;
}

const args = process.argv.slice(3);
const doConvert = args.includes("--convert");
const doRebuild = args.includes("--rebuild");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "0", 10) : 0;
const filter = args.find((a, i) => !a.startsWith("--") && i !== limitIdx + 1);

const index = loadIndex();
const recordings = discover();

if (doRebuild) {
  const rebuilt: Index = {};
  const rebuiltNames = new Set<string>();
  for (const rec of recordings) {
    if (rec.duration < MIN_DURATION_SEC) continue;
    const filename = filenameFor(rec, rebuilt, rebuiltNames);
    rebuiltNames.add(filename);
    rebuilt[rec.id] = {
      id: rec.id,
      title: rec.title,
      created_at: rec.created_at,
      filename,
      synced: existsSync(join(VM_OUT_DIR, filename)),
    };
  }
  saveIndex(rebuilt);
  const synced = Object.values(rebuilt).filter((e) => e.synced).length;
  console.log(`Rebuilt index: ${Object.keys(rebuilt).length} recording(s), ${synced} already synced.`);
  process.exit(0);
}

const skipped = recordings.filter((r) => r.duration < MIN_DURATION_SEC);
const usable = recordings.filter((r) => r.duration >= MIN_DURATION_SEC);
const pending = usable.filter((r) => !index[r.id]?.synced);

if (skipped.length) {
  console.log(`Skipping ${skipped.length} recording(s) under ${MIN_DURATION_SEC}s (voice notes, not meetings).\n`);
}

if (pending.length === 0) {
  console.log("All Voice Memos recordings are synced.");
  process.exit(0);
}

console.log(`${pending.length} unsynced Voice Memos recording(s):\n`);
const previewNames = new Set<string>();
for (const rec of pending) {
  const filename = index[rec.id]?.filename ?? filenameFor(rec, index, previewNames);
  previewNames.add(filename);
  const mins = (rec.duration / 60).toFixed(1);
  console.log(`  ${rec.created_at.substring(0, 10)}  ${rec.title}  (${mins} min)`);
  console.log(`    → ${filename}`);
}

if (!doConvert) process.exit(0);

let targets = filter ? pending.filter((r) => r.id.includes(filter) || r.created_at.includes(filter)) : pending;
// Newest first when limiting, so `--limit 3` means the three most recent.
if (limit > 0) targets = [...targets].reverse().slice(0, limit).reverse();

console.log("\n--- Converting ---\n");
mkdirSync(VM_OUT_DIR, { recursive: true });

let converted = 0;
const usedNames = new Set<string>();
for (const rec of targets) {
  console.log(`Converting: ${rec.title} (${(rec.duration / 60).toFixed(1)} min)`);
  const filename = index[rec.id]?.filename ?? filenameFor(rec, index, usedNames);
  usedNames.add(filename);
  const outPath = join(VM_OUT_DIR, filename);

  const folder = stage(rec);
  if (!folder) continue;

  if (!existsSync(join(folder, "transcript.json"))) {
    if (transcribeLocal(folder) !== 0) continue;
  }

  const res = Bun.spawnSync(["bun", CONVERT_SCRIPT, folder, outPath]);
  if (res.exitCode === 0) {
    index[rec.id] = { id: rec.id, title: rec.title, created_at: rec.created_at, filename, synced: true };
    saveIndex(index);
    converted++;
    console.log(`  ✓ ${filename}${rec.untitled ? "  (untitled in Voice Memos — consider renaming)" : ""}`);
  } else if (res.exitCode === 2) {
    index[rec.id] = { id: rec.id, title: rec.title, created_at: rec.created_at, filename, synced: true };
    saveIndex(index);
    console.log(`  ⊘ Skipped (too short)`);
  } else {
    console.error(`  ✗ Error: ${res.stderr.toString()}`);
  }
}

console.log(`\nConverted ${converted} recording(s).`);
