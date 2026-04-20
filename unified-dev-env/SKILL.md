---
name: unified-dev-env
description: Set up and use a unified dev environment where all services, logs,
  and browser console stream into one place — so an agent can develop, observe,
  and QA without context-switching. Use when starting a new project and wanting
  this pattern, OR when already set up and needing the agent reference (log
  paths, browser attach commands).
---

# unified-dev-env

A pattern for agentic development: all services, logs, and browser console stream into one observable place. An agent can write code, read logs, attach a browser, and verify visually — all from a single log stream, without context-switching.

---

## Setup

Run this section once per project to implement the pattern.

### What you'll build

- A process manager script (`scripts/dev-logs.ts`) that starts all services and multiplexes their stdout/stderr into one prefixed, timestamped stream
- A rotating log file with a stable symlink (`logs/dev-latest.log`) the agent always reads — never guess which rotation file is current
- An optional CDP browser tap: attaches to Chrome/Chromium and streams console output into the same log stream

### Prerequisites

- [ ] Bun (or Node.js) installed
- [ ] A multi-service project (2+ processes)
- [ ] Chrome, Chrome Beta, or Chromium (optional — for browser tap)

### Step 1: Install dependencies

```bash
bun add rotating-file-stream ws
bun add -d @types/ws
```

For Node.js: `npm install rotating-file-stream ws` (same packages).

### Step 2: Copy the reference implementation

Copy `dev-logs.reference.ts` (in this skill directory) to `scripts/dev-logs.ts` in your project. Then edit the **Config** and **Start your services** sections:

```typescript
// ── Config ────────────────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dir, "..");  // project root relative to scripts/
const PROJECT = "myproject";                  // used for /tmp dir name
```

```typescript
// ── Start your services here ──────────────────────────────────────────────────
const children = [
  runProc("server", "bun run src/index.ts",  join(ROOT, "packages/server")),
  runProc("web",    "bun run dev",           join(ROOT, "packages/web")),
];
```

Add one `runProc()` call per service. The first argument becomes the log prefix (`[server]`, `[web]`, etc.) — keep it short.

### Step 3: Wire into package.json

```json
{
  "scripts": {
    "dev": "bun scripts/dev-logs.ts"
  }
}
```

### Step 4: Add logs/ to .gitignore

```
logs/
```

### Step 5: Validate

```bash
bun run dev
```

In another terminal:

```bash
tail -n 50 logs/dev-latest.log
```

Expected output:

```
2026-04-20T10:00:00.000Z [server] listening on :3001
2026-04-20T10:00:00.100Z [web] ready on http://localhost:3000
```

### Step 6 (optional): Attach the browser tap

Start Chrome with CDP enabled:

```bash
# macOS — Chrome Beta
"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-beta-profile" &

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-dev &
```

Open a tab to your app (e.g. `http://localhost:3000`). The script polls CDP every 3 seconds and logs `[browser] attached to tab: …` when it connects. Browser console logs, network errors, and JS exceptions then appear in `dev-latest.log`.

### Step 7: Add CLAUDE.md instructions

Paste this into your project's `CLAUDE.md` so the agent knows how to use the environment:

````markdown
## Dev logs (unified stream)

`bun run dev` starts all services through `scripts/dev-logs.ts`:
- Output is prefixed: `[server]`, `[web]`, `[browser]`, `[dev-logs]`
- Rotating log: 5 MB × 10 files, gzipped on rotate
- Stable symlink: `logs/dev-latest.log` — always read this path

**Agent access:**
```bash
tail -n 200 logs/dev-latest.log          # recent context
tail -f logs/dev-latest.log              # live follow
grep -h ERROR logs/dev-*.log | tail -50  # search across rotations
```

**Restart:** always restart the full environment, never individual services:
```bash
pkill -f "scripts/dev-logs" 2>/dev/null; sleep 2; bun run dev &
```
````

---

## Agent Reference

Use this section every session. Always read `dev-latest.log` — never guess filenames.

### Log access

```bash
tail -n 200 logs/dev-latest.log          # recent context (start here)
tail -f logs/dev-latest.log              # live follow while testing
grep -h ERROR logs/dev-*.log | tail -50  # search across all rotations
grep "\[browser\]" logs/dev-latest.log   # browser-only lines
```

### Log prefixes

| Prefix | Source |
|--------|--------|
| `[server]` | Backend process |
| `[web]` | Frontend dev server |
| `[browser]` | Chrome console/errors via CDP |
| `[dev-logs]` | Process manager messages |

Project-specific prefixes (e.g. `[tauri]`, `[worker]`) are defined in `scripts/dev-logs.ts`.

### Attach the browser tap

If not already running:

```bash
# macOS — Chrome Beta
"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-beta-profile" &

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-dev &
```

Open a tab to your app. The script auto-attaches within 3 seconds — confirm with:

```bash
grep "browser.*attached" logs/dev-latest.log | tail -1
```

Once attached, browser `console.log`, errors, and JS exceptions stream as `[browser] [log|warn|error|exception] …` lines.

### Restart the environment

Always restart everything together — partial restarts leave connections dangling:

```bash
pkill -f "scripts/dev-logs" 2>/dev/null
pkill -f "packages/server" 2>/dev/null
pkill -f "packages/web" 2>/dev/null
sleep 2
bun run dev &
```

Adjust the `pkill` patterns to match your actual service entrypoints.

### Agent QA loop

1. Write or edit code
2. `tail -n 100 logs/dev-latest.log` — check for errors or unexpected output
3. If frontend change: attach browser (see above), open the relevant page
4. `grep "\[browser\].*error\|exception" logs/dev-latest.log` — check for JS errors
5. Fix and repeat
