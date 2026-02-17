#!/usr/bin/env bun
/**
 * Converts a Hyprnote session folder into a markdown transcript file.
 * Usage: bun convert.ts <session_folder> <output_path>
 *
 * Channel 0 = Other (remote participant)
 * Channel 1 = Me (local user)
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

interface MetaJson {
  id: string;
  title: string;
  created_at: string;
  participants: string[];
}

interface Word {
  channel: number;
  start_ms: number;
  end_ms: number;
  text: string;
}

interface Transcript {
  words: Word[];
}

interface TranscriptJson {
  transcripts: Transcript[];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

function buildTurns(words: Word[]): Array<{ channel: number; text: string }> {
  const turns: Array<{ channel: number; text: string }> = [];
  let currentChannel: number | null = null;
  let currentText = "";

  for (const word of words) {
    if (word.channel === currentChannel) {
      currentText += word.text;
    } else {
      if (currentChannel !== null && currentText.trim()) {
        turns.push({ channel: currentChannel, text: currentText.trim() });
      }
      currentChannel = word.channel;
      currentText = word.text;
    }
  }

  if (currentChannel !== null && currentText.trim()) {
    turns.push({ channel: currentChannel, text: currentText.trim() });
  }

  return turns;
}

function speakerLabel(channel: number): string {
  return channel === 1 ? "Me" : "Other";
}

const [, , sessionFolder, outputPath] = process.argv;

if (!sessionFolder || !outputPath) {
  console.error("Usage: bun convert.ts <session_folder> <output_path>");
  process.exit(1);
}

const metaRaw = readFileSync(join(sessionFolder, "_meta.json"), "utf-8");
const meta: MetaJson = JSON.parse(metaRaw);

const transcriptRaw = readFileSync(
  join(sessionFolder, "transcript.json"),
  "utf-8"
);
const transcriptData: TranscriptJson = JSON.parse(transcriptRaw);

// Merge all words from all transcripts, sorted by start_ms
const allWords: Word[] = transcriptData.transcripts
  .flatMap((t) => t.words)
  .sort((a, b) => a.start_ms - b.start_ms);

if (allWords.length < 10) {
  console.error(`Skipping: transcript too short (${allWords.length} words)`);
  process.exit(2);
}

const turns = buildTurns(allWords);
const date = meta.created_at.substring(0, 10);
const participants =
  meta.participants?.length > 0 ? meta.participants.join(", ") : "Unknown";

const transcriptLines = turns
  .map((t) => `**${speakerLabel(t.channel)}:** ${t.text}`)
  .join("\n\n");

const markdown = `# ${meta.title}

**Date:** ${date}
**Participants:** ${participants}

## Summary

<!-- TODO: Add summary -->

## Transcript

${transcriptLines}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, markdown, "utf-8");

// Output the slug info for the caller
console.log(
  JSON.stringify({ title: meta.title, date, slug: slugify(meta.title) })
);
