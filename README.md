# Claude Code Skills

Custom skills for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Each skill is a reusable capability invoked via `/skill-name` in the Claude Code CLI.

## Setup

1. Place this `skills/` directory under `~/.claude/skills/`
2. Create `~/.claude/.env` with the required credentials (see below)
3. Claude Code automatically loads env vars from `~/.claude/.env`

## Environment variables

```bash
# ~/.claude/.env

# Google (for calendar, mail, sheets skills)
GOOGLE_ACCOUNT=you@gmail.com

# Telegram (for telegram skill)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHANNEL_ID=...

# Linear (for linear skill)
LINEAR_API_KEY=...
LINEAR_API_KEY_MOBICRAFT=...
LINEAR_API_KEY_AIFC=...

# Job search (for job-search skill)
JOB_SHEET_ID=...

# Google Drive (for blog-sync-video-src skill)
GDRIVE_BLOG_FOLDER_ID=...
```

## Skills

| Skill | Description | Dependencies |
|-------|-------------|--------------|
| `adobe-podcast-enhance` | Enhance audio via Adobe Podcast web tool | Chrome browser automation |
| `blog-sync-video-src` | Sync blog videos to Google Drive | `rclone` |
| `calendar` | Manage Google Calendar | `gog` CLI |
| `cv-generator` | Generate PDF CVs from markdown | `md-to-pdf`, Libertinus Serif font |
| `discord-post` | Generate Discord announcements | — |
| `interview` | Structured interview for implementation plans | — |
| `job-search` | Scrape PM jobs, deduplicate, post to Google Sheet | `bun`, `sheets-cli` |
| `linear` | Manage Linear issues and projects | `bun` |
| `mail` | Manage Gmail | `gog` CLI |
| `pdf` | Fill and manipulate PDF forms | Python, `pypdf` |
| `peon-ping-toggle` | Toggle peon-ping sound notifications | — |
| `sheets-cli` | Read/write Google Sheets | `sheets-cli` CLI |
| `sync-transcripts` | Sync Hyprnote call transcripts to knowledge base | `bun` |
| `telegram` | Post messages and article summaries to Telegram | `bun`, `grammy` |
| `web-scraper` | Scrape dynamic pages | `bun`, `playwright` |
