#!/usr/bin/env bun
/**
 * Transcribes audio using Deepgram API and saves transcript.json
 * in the format expected by convert.ts.
 *
 * Usage: DEEPGRAM_API_KEY=... bun transcribe-deepgram.ts <session_folder>
 *
 * Auto-detects the audio file in the folder:
 *   - Hyprnote: audio.mp3 / audio.wav / audio.m4a
 *   - Zoom: audio_only*.m4a, audio*.m4a, video*.mp4 (audio extracted by Deepgram)
 *
 * Produces transcript.json with structure:
 * { transcripts: [{ words: [{ channel, start_ms, end_ms, text }] }] }
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const sessionFolder = process.argv[2];
if (!sessionFolder) {
  console.error("Usage: bun transcribe-deepgram.ts <session_folder>");
  process.exit(1);
}

function findAudioFile(folder: string): string | null {
  const files = readdirSync(folder);
  // Exact names first (Hyprnote convention)
  for (const name of ["audio.mp3", "audio.wav", "audio.m4a"]) {
    const p = join(folder, name);
    if (existsSync(p)) return p;
  }
  // Zoom-style prefixed files, ranked: audio_only > audio > video
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
    aac: "audio/aac",
    ogg: "audio/ogg",
    webm: "audio/webm",
  };
  return map[ext] ?? "application/octet-stream";
}

const audioPath = findAudioFile(sessionFolder) ?? "";
if (!audioPath) {
  console.error(`No audio file (mp3/wav/m4a/mp4) found in ${sessionFolder}`);
  process.exit(1);
}

const transcriptPath = join(sessionFolder, "transcript.json");
if (existsSync(transcriptPath)) {
  console.error(`transcript.json already exists in ${sessionFolder}, skipping`);
  process.exit(0);
}

const apiKey = process.env.DEEPGRAM_API_KEY;
if (!apiKey) {
  console.error("DEEPGRAM_API_KEY not set");
  process.exit(1);
}

console.log(`Reading ${audioPath}...`);
const audioBuffer = readFileSync(audioPath);
console.log(`Audio size: ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB`);

console.log("Sending to Deepgram API...");
const response = await fetch(
  "https://api.deepgram.com/v1/listen?" +
    new URLSearchParams({
      model: "nova-3",
      smart_format: "true",
      diarize: "true",
      language: "ru",
      detect_language: "true",
      punctuate: "true",
      utterances: "true",
    }),
  {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": contentTypeFor(audioPath),
    },
    body: audioBuffer,
  }
);

if (!response.ok) {
  const errText = await response.text();
  console.error(`Deepgram API error ${response.status}: ${errText}`);
  process.exit(1);
}

const result = await response.json();
console.log("Transcription received, converting format...");

interface DGWord {
  word: string;
  start: number;
  end: number;
  speaker?: number;
  punctuated_word?: string;
}

const dgWords: DGWord[] =
  result.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];

if (dgWords.length === 0) {
  console.error("Deepgram returned no words");
  process.exit(1);
}

// Convert Deepgram format to Hyprnote transcript.json format
// Deepgram speaker IDs map to channels: speaker 0 -> channel 0 (Me), speaker 1 -> channel 1 (Other)
const words = dgWords.map((w) => ({
  channel: w.speaker ?? 0,
  start_ms: Math.round(w.start * 1000),
  end_ms: Math.round(w.end * 1000),
  text: " " + (w.punctuated_word ?? w.word),
}));

const transcript = {
  transcripts: [{ words }],
};

writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), "utf-8");
console.log(
  `Saved transcript.json (${words.length} words, ${new Set(dgWords.map((w) => w.speaker)).size} speakers)`
);
