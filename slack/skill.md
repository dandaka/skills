---
name: slack
description: Manage Slack integration for the knowledge base. Supports two subcommands — 'connect' to extract tokens from the Slack desktop app, and 'sync' to download all message history to comms/slack/. Use when setting up Slack sync, refreshing tokens after re-login, or pulling new messages.
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Bash(bun*), Bash(security*), Bash(mkdir*), Bash(ls*), Read, Write, Edit
---

# Slack Skill

Unified Slack integration. Two subcommands:

- `/slack connect` — extract tokens from Slack desktop app → `~/.claude/.env`
- `/slack sync` — download messages from all workspaces → `comms/slack/`

---

## `/slack connect`

Extracts `xoxc` token + `xoxd` cookie from the Slack desktop app and writes them to `~/.claude/.env`.

```bash
bun /Users/dandaka/.claude/skills/slack/extract-tokens.ts
```

### How it works

1. Scans `~/Library/Application Support/Slack/Local Storage/leveldb/` for `xoxc-*` tokens
2. Reads encrypted `d` cookie from Slack's SQLite Cookies DB
3. Decrypts using Keychain password (`Slack Safe Storage`) + Chrome AES-128-CBC
4. Calls `auth.test` to resolve the workspace name
5. Writes to `~/.claude/.env`:
   - `SLACK_TOKEN_<WORKSPACE>=xoxc-...`
   - `SLACK_COOKIE_<WORKSPACE>=xoxd-...`

Run again after re-logging into Slack to refresh tokens.

---

## `/slack sync`

Downloads all message history (channels + DMs + threads) for every connected workspace.

```bash
bun /Users/dandaka/.claude/skills/slack/sync.ts
```

### Storage layout

```
comms/slack/
  <workspace>/
    channels/
      <channel-name>/
        2026-02.md
    dms/
      <username>/
        2026-02.md
    .state.json
```

### Message format (per .md file)

```markdown
# #general — February 2026

---

**Alice Russell (@alice)** 2026-02-22 14:03
Hello everyone

> **Thread** (3 replies)
> **Bob (@bob)** 2026-02-22 14:05
> Sure, sounds good
```

### State tracking

Each workspace has `comms/slack/<workspace>/.state.json` tracking the last synced timestamp per channel. Subsequent syncs are incremental — only new messages are fetched.

### Behavior

- Reads all `SLACK_TOKEN_*` + `SLACK_COOKIE_*` pairs from `~/.claude/.env`
- For each workspace: lists all joined channels, public channels, DMs, group DMs
- Fetches full history on first run; incremental on subsequent runs
- Resolves user IDs → display names + handles via `users.list` (cached per run)
- Fetches thread replies for any message with `reply_count > 0`
- Respects Slack rate limits (Tier 3: ~50 req/min) with automatic throttling

### After sync

Report: workspaces synced, channels processed, total messages written.
