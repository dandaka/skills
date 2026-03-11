---
name: sync-transcripts
description: Sync Hyprnote call transcripts to the knowledge base. Finds new sessions in ~/Library/Application Support/hyprnote/sessions/, converts them to markdown (transcript + summary), and saves to calls/ in the knowledge base. Use when user wants to sync, import, or review call transcripts.
metadata:
  author: dandaka
  version: "2.0"
allowed-tools: Bash(bun*), Bash(ls*), Bash(mkdir*), Read, Write, Edit, Glob
---

# Sync Transcripts Skill

Syncs Hyprnote call recordings to the knowledge base as markdown files in `calls/`.

All scripts live in this skill folder (`~/.claude/skills/sync-transcripts/`):
- **sync.ts** — discovers sessions, manages the index, orchestrates conversion
- **convert.ts** — converts a single session folder to markdown

The index file (`calls/sessions-index.json`) maps Hyprnote session IDs to call filenames and tracks sync status.

## Workflow

When the user runs `/sync-transcripts`:

### 1. First-time setup (if no index exists)

```bash
bun ~/.claude/skills/sync-transcripts/sync.ts calls/ --rebuild
```

This scans all Hyprnote sessions, fuzzy-matches them against existing `calls/*.md` files, and creates `calls/sessions-index.json`.

### 2. Check for new sessions

```bash
bun ~/.claude/skills/sync-transcripts/sync.ts calls/
```

Shows which sessions are new and which are already synced.

### 3. Convert new sessions

```bash
bun ~/.claude/skills/sync-transcripts/sync.ts calls/ --convert
```

Converts all unsynced sessions to markdown. Each generated file has a `<!-- TODO: Add summary -->` placeholder.

### 4. Write summaries

For each newly created file:
1. Read the generated markdown file
2. Write a 3-5 bullet summary of the call based on the transcript content
3. Replace the `<!-- TODO: Add summary -->` placeholder using the Edit tool

### 5. Report

List all newly created files with their titles and dates.

## Notes

- Sessions with transcripts < 500 bytes are automatically skipped (no real content)
- The convert script skips transcripts with fewer than 10 words (exits with code 2)
- The index handles slug mismatches from older syncs via fuzzy date+title matching during `--rebuild`
- Channel 0 = **Me** (local user), Channel 1 = **Other** (remote participant)
