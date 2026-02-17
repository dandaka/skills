---
name: sync-transcripts
description: Sync Hyprnote call transcripts to the knowledge base. Finds new sessions in ~/Library/Application Support/hyprnote/sessions/, converts them to markdown (transcript + summary), and saves to calls/ in the knowledge base. Use when user wants to sync, import, or review call transcripts.
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Bash(bun*), Bash(ls*), Bash(mkdir*), Read, Write, Edit
---

# Sync Transcripts Skill

Reads Hyprnote session folders, converts JSON transcripts to markdown files, and stores them in the knowledge base under `calls/`.

## Source

**Sessions folder:** `~/Library/Application Support/hyprnote/sessions/`

Each session folder contains:
- `_meta.json` — title, created_at, participants
- `transcript.json` — words array with channel (0 = remote/other, 1 = local/user) and text

## Destination

**Knowledge base folder:** `calls/` (create if missing)

One markdown file per session, named: `YYYY-MM-DD-<slugified-title>.md`

## Workflow

When the user runs `/sync-transcripts`:

### 1. Discover sessions

List all folders in `~/Library/Application Support/hyprnote/sessions/`. For each, read `_meta.json` to get title and date.

### 2. Check which are new

Check `calls/` in the knowledge base. Skip sessions that already have a corresponding markdown file (match by date + slug of title).

Show the user which sessions are new and which are already synced.

### 3. Convert new sessions

For each new session, run the bundled `convert.ts` script:

```bash
bun /Users/dandaka/.claude/skills/sync-transcripts/convert.ts \
  "<session_folder_path>" \
  "<output_markdown_path>"
```

The script:
- Reads `_meta.json` for title, date, participants
- Reads `transcript.json` and reconstructs turn-by-turn dialogue
  - Channel 0 = **Other** (remote participant)
  - Channel 1 = **Me** (local user)
  - Groups consecutive words from same channel into a single turn
- Writes a markdown file (with `<!-- TODO: Add summary -->` placeholder in Summary section)
- After the script runs, **read the generated markdown file**, write a 3-5 bullet summary of the call based on the transcript content, and replace the placeholder with it using the Edit tool
- File structure:

```markdown
# <Title>

**Date:** YYYY-MM-DD
**Participants:** <list from meta or "Unknown">

## Summary

<3-5 bullet point summary of key topics and decisions>

## Transcript

**Me:** <turn text>

**Other:** <turn text>

...
```

### 4. Report

After syncing, list all newly created files with their titles and dates.

## Notes

- Skip sessions with empty or near-empty transcripts (fewer than 10 words total)
- The `convert.ts` script handles the JSON parsing and markdown formatting
- For summaries: after generating the transcript text, ask Claude (yourself) to write a concise summary based on the transcript content
- `calls/` folder should be created if it doesn't exist
