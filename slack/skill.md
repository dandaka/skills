---
name: slack
description: Manage Slack integration for the knowledge base. Supports two subcommands — 'connect' to extract tokens from the Slack desktop app, 'sync' to download all message history to comms/slack/, and 'thread <url>' to fetch a single thread. Use when setting up Slack sync, refreshing tokens after re-login, pulling new messages, or reading a specific Slack thread.
metadata:
  author: dandaka
  version: "1.1"
allowed-tools: Bash(bun*), Bash(security*), Bash(mkdir*), Bash(ls*), Bash(curl*), Bash(source*), Read, Write, Edit
---

# Slack Skill

Unified Slack integration. Three subcommands:

- `/slack connect` — extract tokens from Slack desktop app → `~/.claude/.env`
- `/slack sync` — download messages from all workspaces → `comms/slack/`
- `/slack thread <url>` — fetch and display a single Slack thread

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

**IMPORTANT:** This is a heavy operation that fetches ALL channels and ALL history. Do NOT run this automatically when the user just wants to read a single thread or message. Ask the user to confirm before running a full sync. If the user provided a thread URL, use `/slack thread` instead.

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

---

## `/slack thread <url>`

Fetches a single Slack thread by URL and displays it with resolved user names.

**ARGUMENTS:** a Slack message URL like `https://<workspace>.slack.com/archives/<channel_id>/p<timestamp>`

### How to use

1. Parse the URL to extract `channel_id` and `ts` (the `p` prefix is removed, dot inserted at position 10)
2. Load tokens: `source ~/.claude/.env`
3. Determine workspace from URL hostname (e.g. `azuro-protocol` → `AZURO`)
4. Fetch thread via Slack API and resolve user names

### Implementation (inline — no separate script)

```bash
# 1. Parse URL
# URL format: https://<workspace>.slack.com/archives/<channel>/p<ts_without_dot>
# Example: https://azuro-protocol.slack.com/archives/C09NZTK4AP6/p1773070443708829
# Extract channel: C09NZTK4AP6
# Extract ts: 1773070443.708829 (insert dot at position 10)

# 2. Source tokens (SLACK_TOKEN_* and SLACK_COOKIE_* are NOT in env by default)
source ~/.claude/.env

# 3. Use context-mode execute (javascript) to:
#    - fetch conversations.replies with channel + ts
#    - resolve user IDs via users.info
#    - print formatted messages
```

### Key gotchas

- **Tokens are NOT loaded into env at session start.** Always `source ~/.claude/.env` or load the file manually before API calls.
- **Env file format is `KEY=value`** (no `export`, no quotes). When loading in JS, split on first `=`.
- **Use `javascript` language in context-mode execute** (not typescript — bun in context-mode sandbox doesn't support TS imports).
- **Use `require('fs')` not `import`** in context-mode JS sandbox.
- **Workspace name mapping:** URL hostname prefix maps to env var suffix (e.g. `azuro-protocol` → look for `SLACK_TOKEN_AZURO`). If ambiguous, try all `SLACK_TOKEN_*` vars.

### Reference JS snippet for context-mode execute

```javascript
const fs = require('fs');
for (const line of fs.readFileSync(process.env.HOME + '/.claude/.env', 'utf8').split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0) process.env[line.slice(0, eq)] = line.slice(eq + 1);
}
const token = process.env.SLACK_TOKEN_AZURO;
const cookie = process.env.SLACK_COOKIE_AZURO;
const headers = { "Authorization": `Bearer ${token}`, "Cookie": `d=${cookie}` };

const res = await fetch(`https://slack.com/api/conversations.replies?channel=CHANNEL&ts=TS&limit=100`, { headers });
const data = await res.json();
if (!data.ok) { console.log("API error:", data.error); process.exit(1); }

const uids = [...new Set(data.messages.map(m => m.user).filter(Boolean))];
const names = {};
for (const uid of uids) {
  const r = await fetch(`https://slack.com/api/users.info?user=${uid}`, { headers });
  const d = await r.json();
  names[uid] = d.user?.real_name || d.user?.name || uid;
}

for (const msg of data.messages) {
  const date = new Date(parseFloat(msg.ts) * 1000).toISOString().replace('T', ' ').slice(0, 16);
  let text = (msg.text || '').replace(/<@(\w+)>/g, (_, id) => `@${names[id] || id}`);
  console.log(`**${names[msg.user] || msg.user}** ${date}`);
  console.log(text);
  console.log('');
}
```
