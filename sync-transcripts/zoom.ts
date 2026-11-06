#!/usr/bin/env bun
/**
 * Zoom → Knowledge Base sync tool.
 *
 * Scans ~/Documents/Zoom for local recordings, transcribes new ones with
 * Deepgram, and converts them to markdown in <calls_dir>/zoom/.
 *
 * Usage:
 *   bun zoom.ts <calls_dir>                    # show new recordings
 *   bun zoom.ts <calls_dir> --convert [filter] # transcribe + convert new recordings (filter = folder-name substring)
 *   bun zoom.ts <calls_dir> --convert --deepgram  # use Deepgram (diarized) instead of local Parakeet
 *   bun zoom.ts <calls_dir> --rebuild          # rebuild index from existing zoom/*.md
 *
 * Transcription defaults to local Parakeet TDT (MLX, free). Deepgram (via
 * ni-gate) is opt-in with --deepgram and adds speaker diarization.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";

const CALLS_DIR = process.argv[2];
if (!CALLS_DIR) {
  console.error("Usage: bun zoom.ts <calls_dir> [--status|--convert|--rebuild] [filter]");
  process.exit(1);
}

const INDEX_PATH = join(CALLS_DIR, "zoom-index.json");
const ZOOM_DIR = `${process.env.HOME}/Documents/Zoom`;
const ZOOM_OUT_DIR = join(CALLS_DIR, "zoom");
const CONVERT_SCRIPT = join(import.meta.dir, "convert.ts");

const AUDIO_RE = /^audio(_only)?.*\.(m4a|mp3|wav|mp4)$|^video.*\.(mp4|mov|m4v)$/i;
const FOLDER_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2})\.(\d{2})\.(\d{2}) (.*)$/;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

interface ZoomRecording {
  folder: string; // folder name in ~/Documents/Zoom
  title: string;
  created_at: string;
}

interface IndexEntry {
  folder: string;
  title: string;
  created_at: string;
  filename: string;
  synced: boolean;
}

type ZoomIndex = Record<string, IndexEntry>;

function readZoomRecordings(): ZoomRecording[] {
  if (!existsSync(ZOOM_DIR)) return [];
  const recordings: ZoomRecording[] = [];

  for (const dir of readdirSync(ZOOM_DIR)) {
    if (dir.startsWith(".")) continue;
    const m = dir.match(FOLDER_RE);
    if (!m) continue;
    const folderPath = join(ZOOM_DIR, dir);
    let hasAudio = false;
    try {
      hasAudio = readdirSync(folderPath).some((f: string) => AUDIO_RE.test(f));
    } catch {
      continue; // unreadable folder
    }
    if (!hasAudio) continue;
    recordings.push({
      folder: dir,
      title: m[5],
      created_at: `${m[1]}T${m[2]}:${m[3]}:${m[4]}`,
    });
  }

  return recordings.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function expectedFilename(r: ZoomRecording): string {
  return `${r.created_at.substring(0, 10)}-${slugify(r.title)}.md`;
}

// Same-day recordings with identical topics would collide; disambiguate with time.
function makeFilename(r: ZoomRecording, taken: Set<string>): string {
  let fname = expectedFilename(r);
  if (taken.has(fname)) {
    const hhmmss = r.created_at.substring(11).replace(/:/g, "");
    fname = `${r.created_at.substring(0, 10)}-${slugify(r.title)}-${hhmmss}.md`;
  }
  taken.add(fname);
  return fname;
}

function loadIndex(): ZoomIndex {
  if (!existsSync(INDEX_PATH)) return {};
  try {
    return JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveIndex(index: ZoomIndex): void {
  const sorted = Object.fromEntries(
    Object.entries(index).sort(([, a], [, b]) => a.created_at.localeCompare(b.created_at))
  );
  writeFileSync(INDEX_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
}

function getExistingZoomFiles(): Set<string> {
  if (!existsSync(ZOOM_OUT_DIR)) return new Set();
  return new Set(readdirSync(ZOOM_OUT_DIR).filter((f: string) => f.endsWith(".md")));
}

function writeZoomMeta(folderPath: string, r: ZoomRecording): void {
  const metaPath = join(folderPath, "_meta.json");
  if (existsSync(metaPath)) return;
  writeFileSync(
    metaPath,
    JSON.stringify(
      { id: r.folder, title: r.title, created_at: r.created_at, participants: [] },
      null,
      2
    ) + "\n",
    "utf-8"
  );
}

// Mirror of the detection in transcribe-deepgram.ts (kept in sync manually).
function findAudioFile(folder: string): string | null {
  const files = readdirSync(folder);
  for (const name of ["audio.mp3", "audio.wav", "audio.m4a"]) {
    const p = join(folder, name);
    if (existsSync(p)) return p;
  }
  const pick = (re: RegExp): string | null => {
    const match = files.filter((f: string) => re.test(f)).sort()[0];
    return match ? join(folder, match) : null;
  };
  return (
    pick(/^audio_only.*\.(m4a|mp3|wav)$/i) ??
    pick(/^audio.*\.(m4a|mp3|wav|mp4)$/i) ??
    pick(/^video.*\.(mp4|mov|m4v)$/i)
  );
}

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
  };
  return map[ext] ?? "application/octet-stream";
}

interface DGWord {
  word: string;
  start: number;
  end: number;
  speaker?: number;
  punctuated_word?: string;
}

// Local (free) transcription via Parakeet TDT — writes transcript.json, single channel.
const LOCAL_TRANSCRIBE = join(import.meta.dir, "transcribe-local.py");

function transcribeLocal(folderPath: string): number {
  const result = Bun.spawnSync(["python3", LOCAL_TRANSCRIBE, folderPath]);
  if (result.exitCode !== 0) {
    console.error(`  ✗ Local transcription failed: ${result.stderr.toString().trim()}`);
    return 1;
  }
  const line = result.stdout.toString().trim().split("\n").pop() ?? "";
  console.log(`  ${line}`);
  return 0;
}

// Returns 0 on success, non-zero on failure. Writes transcript.json next to the audio.
function transcribeDeepgram(folderPath: string): number {
  const transcriptPath = join(folderPath, "transcript.json");
  if (existsSync(transcriptPath)) {
    console.log(`  transcript.json already exists, skipping`);
    return 0;
  }

  const audio = findAudioFile(folderPath);
  if (!audio) {
    console.error(`  ✗ No audio file found in ${folderPath}`);
    return 1;
  }

  const respPath = join(folderPath, "_deepgram_response.json");
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    diarize: "true",
    language: "ru",
    detect_language: "true",
    punctuate: "true",
    utterances: "true",
  });
  const url = `https://api.deepgram.com/v1/listen?${params}`;

  // DEEPGRAM_API_KEY is ni-gate-managed: curl is the only permitted command,
  // and ni-gate substitutes $DEEPGRAM_API_KEY inside argv.
  const result = Bun.spawnSync([
    "ni-gate", "run", "DEEPGRAM_API_KEY", "--",
    "curl", "-s", "-X", "POST", url,
    "-H", "Authorization: Token $DEEPGRAM_API_KEY",
    "-H", `Content-Type: ${contentTypeFor(audio)}`,
    "--data-binary", `@${audio}`,
    "-o", respPath,
  ]);

  if (result.exitCode !== 0) {
    console.error(`  ✗ Deepgram request failed: ${result.stderr.toString().trim()}`);
    return 1;
  }

  const raw = readFileSync(respPath, "utf-8");
  const json = JSON.parse(raw);
  if (json.err_code) {
    console.error(`  ✗ Deepgram error ${json.err_code}: ${json.err_msg}`);
    return 1;
  }

  const dgWords: DGWord[] = json.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  if (dgWords.length === 0) {
    console.error(`  ✗ Deepgram returned no words`);
    return 1;
  }

  const words = dgWords.map((w) => ({
    channel: w.speaker ?? 0,
    start_ms: Math.round(w.start * 1000),
    end_ms: Math.round(w.end * 1000),
    text: " " + (w.punctuated_word ?? w.word),
  }));
  writeFileSync(transcriptPath, JSON.stringify({ transcripts: [{ words }] }, null, 2) + "\n", "utf-8");
  rmSync(respPath, { force: true });
  console.log(
    `  Got ${words.length} words, ${new Set(dgWords.map((w) => w.speaker)).size} speakers`
  );
  return 0;
}

// --- Commands ---

const command = process.argv[3] || "--status";

if (command === "--rebuild") {
  const recordings = readZoomRecordings();
  const existing = getExistingZoomFiles();
  const index: ZoomIndex = {};

  for (const r of recordings) {
    index[r.folder] = {
      folder: r.folder,
      title: r.title,
      created_at: r.created_at,
      filename: expectedFilename(r),
      synced: existing.has(expectedFilename(r)),
    };
  }

  // Resolve same-day same-topic filename collisions with a time suffix,
  // keeping plain names on folders that already have converted files.
  const taken = new Set<string>(existing);
  const sorted = Object.values(index).sort((a, b) => {
    const aHas = existing.has(a.filename);
    const bHas = existing.has(b.filename);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.created_at.localeCompare(b.created_at);
  });
  for (const entry of sorted) {
    entry.filename = makeFilename(entry, taken);
  }

  for (const entry of Object.values(index)) {
    entry.synced = existing.has(entry.filename);
  }

  saveIndex(index);
  const total = Object.keys(index).length;
  const synced = Object.values(index).filter((e) => e.synced).length;
  console.log(`Index rebuilt: ${total} recordings, ${synced} synced, ${total - synced} new`);
} else {
  const index = loadIndex();
  const recordings = readZoomRecordings();
  const existing = getExistingZoomFiles();
  const taken = new Set<string>([...existing, ...Object.values(index).map((e) => e.filename)]);

  for (const r of recordings) {
    if (index[r.folder]) {
      const entry = index[r.folder];
      if (!entry.synced && existing.has(entry.filename)) {
        entry.synced = true;
      }
      continue;
    }

    const fname = makeFilename(r, taken);
    index[r.folder] = {
      folder: r.folder,
      title: r.title,
      created_at: r.created_at,
      filename: fname,
      synced: existing.has(fname),
    };
  }

  const unsynced = Object.values(index).filter((e) => !e.synced);
  if (unsynced.length === 0) {
    console.log("All Zoom recordings are synced.");
  } else {
    console.log(`${unsynced.length} unsynced Zoom recording(s):\n`);
    for (const entry of unsynced.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      console.log(`  ${entry.created_at.substring(0, 10)}  ${entry.title}`);
      console.log(`    → ${entry.filename}`);
    }
  }

  if (command === "--convert") {
    const useDeepgram = process.argv.includes("--deepgram");
    const filterArg = process.argv[4];
    const filter = filterArg && !filterArg.startsWith("--") ? filterArg : undefined;
    console.log("\n--- Converting ---\n");
    for (const entry of unsynced.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (filter && !entry.folder.includes(filter)) continue;
      const folderPath = join(ZOOM_DIR, entry.folder);
      const engine = useDeepgram ? "Deepgram" : "local Parakeet";
      console.log(`Converting: ${entry.title} (${engine})`);

      const transcribe = useDeepgram ? transcribeDeepgram : transcribeLocal;
      if (transcribe(folderPath) !== 0) {
        continue;
      }

      writeZoomMeta(folderPath, entry);
      const outputPath = join(ZOOM_OUT_DIR, entry.filename);
      const result = Bun.spawnSync(["bun", CONVERT_SCRIPT, folderPath, outputPath]);
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
