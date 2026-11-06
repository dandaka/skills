---
name: sync-transcripts
description: Sync call recordings to the knowledge base. Imports Hyprnote sessions from ~/Library/Application Support/hyprnote/sessions/ as markdown, transcribes Zoom local recordings from ~/Documents/Zoom/, imports OpenOats sessions from ~/Library/Application Support/OpenOats/sessions/, and transcribes Apple Voice Memos synced from iPhone via iCloud. New files land in log/calls/ (Hyprnote), log/calls/zoom/ (Zoom), log/calls/openoats/ (OpenOats) and log/calls/voicememos/ (Voice Memos). Use when user wants to sync, import, or review call transcripts.
metadata:
  author: dandaka
  version: "2.2"
allowed-tools: Bash(bun*), Bash(ls*), Bash(mkdir*), Read, Write, Edit, Glob
---

# Sync Transcripts Skill

Syncs call recordings to the knowledge base as markdown files in `calls/`.

All scripts live in this skill folder (`~/.claude/skills/sync-transcripts/`):
- **sync.ts** — Hyprnote discovery + index + conversion orchestration
- **zoom.ts** — Zoom discovery + index + transcription + conversion orchestration
- **openoats.ts** — OpenOats discovery + index + conversion (self-contained; no transcription step)
- **voicememos.ts** — Voice Memos discovery (via the iCloud SQLite store) + staging + transcription + conversion
- **convert.ts** — converts a session folder (with `_meta.json` + `transcript.json`) to markdown
- **transcribe-deepgram.ts** — transcribes audio (mp3/m4a/wav/mp4) via Deepgram to `transcript.json`

Indexes: `log/calls/sessions-index.json` (Hyprnote), `log/calls/zoom-index.json` (Zoom), `log/calls/openoats-index.json` (OpenOats) and `log/calls/voicememos-index.json` (Voice Memos) map source recordings to call filenames and track sync status.

## Workflow

When the user runs `/sync-transcripts`:

### 1. First-time setup (if no index exists)

```bash
bun ~/.claude/skills/sync-transcripts/sync.ts log/calls/ --rebuild
bun ~/.claude/skills/sync-transcripts/zoom.ts log/calls/ --rebuild
bun ~/.claude/skills/sync-transcripts/openoats.ts log/calls/ --rebuild
bun ~/.claude/skills/sync-transcripts/voicememos.ts log/calls/ --rebuild
```

### 2. Check for new recordings

```bash
bun ~/.claude/skills/sync-transcripts/sync.ts log/calls/
bun ~/.claude/skills/sync-transcripts/zoom.ts log/calls/
bun ~/.claude/skills/sync-transcripts/openoats.ts log/calls/
bun ~/.claude/skills/sync-transcripts/voicememos.ts log/calls/
```

Shows which recordings are new and which are already synced.

### 3. Convert new recordings

Hyprnote (already transcribed by the app):

```bash
bun ~/.claude/skills/sync-transcripts/sync.ts log/calls/ --convert
```

Zoom (transcribed with Parakeet TDT locally — free, no API credits; optional `--deepgram` for diarized output via Deepgram). Optional filter limits to folder-name substrings, e.g. a date:

```bash
bun ~/.claude/skills/sync-transcripts/zoom.ts log/calls/ --convert
bun ~/.claude/skills/sync-transcripts/zoom.ts log/calls/ --convert "2026-08-17"
bun ~/.claude/skills/sync-transcripts/zoom.ts log/calls/ --convert --deepgram
```

Local transcription (`transcribe-local.py`) uses `mlx-community/parakeet-tdt-0.6b-v3`
via parakeet-mlx on this machine (M1 Pro, ~25x realtime, Russian auto-detected).
No speaker diarization: single-channel transcripts are labeled **Speaker** in
the markdown. Deepgram mode (`--deepgram`) needs `DEEPGRAM_API_KEY` —
ni-gate-managed; `zoom.ts` calls curl through `ni-gate run DEEPGRAM_API_KEY --
curl ...` (curl is the only command permitted for this var). Each zoom folder
gets a synthetic `_meta.json` next to its audio; the `transcript.json` is
written there too.

OpenOats (already transcribed locally by the app as the call happens — nothing to
transcribe, so this is just a conversion). Optional filter matches the session id:

```bash
bun ~/.claude/skills/sync-transcripts/openoats.ts log/calls/ --convert
bun ~/.claude/skills/sync-transcripts/openoats.ts log/calls/ --convert "2026-09-02"
```

Voice Memos (synced from iPhone via iCloud; transcribed locally with Parakeet TDT,
same engine as the Zoom path). Optional filter matches the recording id or date;
`--limit N` takes the N most recent, which is the usual way to catch up:

```bash
bun ~/.claude/skills/sync-transcripts/voicememos.ts log/calls/ --convert
bun ~/.claude/skills/sync-transcripts/voicememos.ts log/calls/ --convert --limit 3
bun ~/.claude/skills/sync-transcripts/voicememos.ts log/calls/ --convert "2026-09-04"
```

Long recordings take minutes to transcribe — run these in the background rather
than blocking on them, and note that a sandboxed shell with a short timeout will
kill the job mid-run while leaving a partial staging folder behind.

Each generated file has a `<!-- TODO: Add summary -->` placeholder.

### 4. Write summaries

For each newly created file:
1. Read the generated markdown file
2. Write a 3-5 bullet summary of the call based on the transcript content
3. Replace the `<!-- TODO: Add summary -->` placeholder using the Edit tool
4. If you can tell who was on the call, replace `**Participants:** Unknown`

With many files (roughly 5+ or 30k+ words), split them across parallel subagents
and have each return a one-line description per file — that line becomes the title.

### 4b. Rename untitled OpenOats calls (mandatory)

OpenOats titles most sessions with the meeting app's name ("Zoom"), which makes
every file `YYYY-MM-DD-zoom-HHMMSS.md`. Once summaries are written, give each one
a descriptive title. List what still needs a title:

```bash
bun ~/.claude/skills/sync-transcripts/openoats.ts log/calls/ --untitled
```

Then rename each one. This renames the file, rewrites its H1, removes the
"untitled" note and records the new filename in the index (marked `renamed`, so
`--rebuild` keeps it):

```bash
bun ~/.claude/skills/sync-transcripts/openoats.ts log/calls/ --rename 2026-11-06_19-14 "Slava – evening prototype screen-by-screen review"
```

Title style: English, `<Main person or group> – <topic>`, at most ~8 words (the
slug is cut at 60 chars). Use neutral titles for private recordings ("Private
conversation at home"). Rerun `--untitled` at the end; it should print nothing.

### 5. Report

List all newly created files with their titles and dates. Commit the new files and
`log/calls/*-index.json` in dn-kb (a post-commit hook pushes).

## Notes

- Hyprnote sessions with transcripts < 500 bytes are automatically skipped (no real content)
- The convert script skips transcripts with fewer than 10 words (exits with code 2)
- The index handles slug mismatches from older syncs via fuzzy date+title matching during `--rebuild`
- Zoom folders are named `YYYY-MM-DD HH.MM.SS Topic`; only folders with audio files (m4a/mp3/wav/mp4) are picked up
- Zoom output goes to `log/calls/zoom/` so it never collides with the Hyprnote index scan of `log/calls/*.md`
- Channel 0 = **Me** (local user), Channel 1 = **Other** (remote participant), Channel N+ = **Speaker N** (diarized Zoom speakers)
- OpenOats sessions live in `session_YYYY-MM-DD_HH-MM-SS/` with a `transcript.live.jsonl` (one JSON object per line: `speaker` / `text` / `timestamp`) and a `session.json`
- OpenOats speaker labels map `you` → **Me** and `them` → **Other**; output goes to `log/calls/openoats/`
- OpenOats only stores a title when the user set one, and otherwise often fills in the meeting app ("Zoom", "Google Meet", ...). Both cases are treated as untitled: they get a `<App or "OpenOats session"> <date> <time>` placeholder and an in-file note, and step 4b renames them
- Sessions where every utterance carries the same speaker label are flagged in-file: OpenOats captured a single channel, so attribution is unreliable even when several people are talking
- Consecutive same-speaker utterances merge into one turn, capped at ~700 chars so a single-channel session stays readable instead of collapsing into one block
- Sessions with fewer than 10 utterances are skipped as empty
- Voice Memos reads `~/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/CloudRecordings.db`. That container is **TCC-protected**: the host app needs Full Disk Access (System Settings → Privacy & Security), and the grant only applies after a full quit and reopen. Without it `stat` still works while every content read fails with "Operation not permitted" — a confusing half-failure the script detects and explains
- The database is WAL-mode and the Voice Memos app may hold uncheckpointed writes, so the script snapshots `.db` + `-wal` + `-shm` together before querying. Reading the `.db` alone silently misses the newest recordings
- Recordings only appear on the Mac after the Voice Memos app has been opened at least once; iCloud does not populate that store in the background beforehand
- Newer recordings are `.qta` (spatial audio), not `.m4a`. These carry several streams — stereo AAC plus a 4-channel spatial mix plus data tracks — so extraction pins `-map 0:a:0`; letting ffmpeg choose can grab the spatial track and produce an unusable transcript
- Voice Memos stores flat files rather than session folders, so each recording is staged into `~/.cache/sync-transcripts/voicememos/<id>/` as `_meta.json` + 16 kHz mono `audio.wav`, then handed to the shared `transcribe-local.py` + `convert.ts` pipeline. Staging is idempotent — a re-run reuses existing wav/transcript instead of redoing the work
- Recordings shorter than 120s are skipped: Voice Memos doubles as a scratchpad for seconds-long personal notes, and meetings are the point here
- Untitled recordings are auto-named by Voice Memos with an ISO timestamp (`2026-09-04T16:27:24Z`), which makes a poor slug. Those are treated as untitled, get a `Voice memo <date> <time>` placeholder, and are flagged at convert time for renaming
- Identity is `ZUNIQUEID`, so renaming a memo on the iPhone does not cause a re-sync. Bulk-imported recordings can share a timestamp *and* title, so filename disambiguation falls back to time and then to the id suffix
- No diarization: everything is one channel, labeled **Speaker** — the same limitation as local Zoom transcription
