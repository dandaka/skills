#!/usr/bin/env bun
/**
 * Transcribes audio using Deepgram API and saves transcript.json
 * in the format expected by convert.ts.
 *
 * Usage: DEEPGRAM_API_KEY=... bun transcribe-deepgram.ts <session_folder>
 *
 * Produces transcript.json with structure:
 * { transcripts: [{ words: [{ channel, start_ms, end_ms, text }] }] }
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const sessionFolder = process.argv[2];
if (!sessionFolder) {
  console.error("Usage: bun transcribe-deepgram.ts <session_folder>");
  process.exit(1);
}

const audioPath = join(sessionFolder, "audio.mp3");
if (!existsSync(audioPath)) {
  console.error(`No audio.mp3 found in ${sessionFolder}`);
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
      "Content-Type": "audio/mpeg",
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
