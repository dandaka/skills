# Claude Code Skills

Custom skills for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Each skill is a reusable capability invoked via `/skill-name` in the Claude Code CLI.

## Setup

1. Place this `skills/` directory under `~/.claude/skills/`
2. Create `~/.claude/.env` with the required credentials (see below)
3. Claude Code automatically loads env vars from `~/.claude/.env`
4. Machine-specific, non-secret config that a skill needs (e.g. which Chrome profile listens on which CDP port for `real-browser`) goes in `~/.claude/<skill>.local.md`; see the skill's `LOCAL.example.md`

## Environment variables

```bash
# ~/.claude/.env

# Google (for calendar, doc, mail, sheets skills)
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
| `doc` | Create Google Docs / Sheets with gog to share with external parties | `gog` CLI |
| `discord-post` | Generate Discord announcements | — |
| `frontend-standards` | Evidence-based Figma↔browser frontend protocol: preflight, intent intake, measure→experiment→commit debugging, design vocabulary | `figma-use`, `agent-browser` (CDP) |
| `interview` | Structured interview for implementation plans | — |
| `job-search` | Scrape PM jobs, deduplicate, post to Google Sheet | `bun`, `sheets-cli` |
| `linear` | Manage Linear issues and projects | `bun` |
| `mail` | Manage Gmail | `gog` CLI |
| `pidev` | Fan out DeepSeek v4.1 Flash subagents via the pi CLI (issues → worktrees → PRs) | `pi` CLI, OpenCode Go auth, `gh`, `jq` |
| `pdf` | Fill and manipulate PDF forms | Python, `pypdf` |
| `peon-ping-toggle` | Toggle peon-ping sound notifications | — |
| `sheets-cli` | Read/write Google Sheets | `sheets-cli` CLI |
| `sync-transcripts` | Sync Hyprnote call transcripts to knowledge base | `bun` |
| `telegram` | Entry point for Telegram: Telethon, secrets in Infisical, Kira bot, channel posting | `infisical`, Telethon venv, `bun`, `grammy` |
| `web-scraper` | Scrape dynamic pages | `bun`, `playwright` |

## Third-party skills (not in this repo)

Installed into `~/.claude/skills/` by their own tools, which also keep them up to date.
They are gitignored here; reinstall them on a new machine with the commands below.

| Skill | Source | Install |
|-------|--------|---------|
| `treg` | [superdesigndev/treg · skills/treg](https://github.com/superdesigndev/treg/tree/main/skills/treg) | `curl -fsSL https://treg.to/install.sh \| sh` |
| `web-access` | [superdesigndev/treg · skills/web-access](https://github.com/superdesigndev/treg/tree/main/skills/web-access) | `curl -fsSL https://treg.to/install.sh \| sh -s -- --skills web-access` |
| `lead-signals` | [superdesigndev/treg · skills/lead-signals](https://github.com/superdesigndev/treg/tree/main/skills/lead-signals) | `curl -fsSL https://treg.to/install.sh \| sh -s -- --skills lead-signals` |
| `make-ugc` | [superdesigndev/treg · skills/make-ugc](https://github.com/superdesigndev/treg/tree/main/skills/make-ugc) | `curl -fsSL https://treg.to/install.sh \| sh -s -- --skills make-ugc` |
| `recruit` | [superdesigndev/treg · skills/recruit](https://github.com/superdesigndev/treg/tree/main/skills/recruit) | `curl -fsSL https://treg.to/install.sh \| sh -s -- --skills recruit` |
| `reverse-engineer-anything` | [morluto/rea · .agents/skills/reverse-engineer-anything](https://github.com/morluto/rea/tree/main/.agents/skills/reverse-engineer-anything) | `npx rea-agents@latest setup` (also registers the REA MCP server) |

All treg workflow skills at once: `curl -fsSL https://treg.to/install.sh | sh -s -- --skills all`.
In Claude Code each is also a plugin: `/plugin marketplace add superdesigndev/treg`, then `/plugin install <skill>@treg`.
