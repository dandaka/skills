---
name: real-browser
description: Launch and control real Chrome Beta with persistent login sessions. Use when automating websites that detect Playwright (LinkedIn, etc.) or when running parallel browser sessions for job applications.
allowed-tools: Bash(agent-browser:*), Bash(pkill:*), Bash(curl:*), Bash(sleep:*)
---

# Browser Automation - Real Chrome Beta

## CRITICAL: Never use agent-browser to launch Chrome

**DO NOT** use `agent-browser open` or `agent-browser --headed` to launch a browser.
Doing so sends automation signals (Playwright-controlled browser) that websites detect.

**CORRECT workflow:**
1. Launch Chrome Beta with `--remote-debugging-port=9222` and `--user-data-dir`
2. Use `--cdp 9222 --session <name>` on ALL commands (combines CDP attach + named session)

**DO NOT use `agent-browser --session <name> connect 9222`.** The `connect` subcommand's Rust daemon creates a new `about:blank` tab instead of attaching to existing pages. This is a known bug (verified 2026-04-03, agent-browser v0.22.3).

## Shutdown Chrome Beta (graceful)

Always shut down Chrome gracefully to avoid the "not shut down correctly" banner on next launch. Escalate from gentle to forceful:

```bash
osascript -e 'quit app "Google Chrome Beta"' 2>/dev/null
sleep 3
pkill -f "Google Chrome Beta" 2>/dev/null
sleep 1
pkill -9 -f "Google Chrome Beta" 2>/dev/null
sleep 1
```

**Never start with `pkill -9`.** AppleScript `quit` lets Chrome save session state. SIGTERM (`pkill` without `-9`) is the fallback. SIGKILL (`-9`) is last resort only.

## Launch Chrome Beta

```bash
osascript -e 'quit app "Google Chrome Beta"' 2>/dev/null
sleep 3
pkill -f "Google Chrome Beta" 2>/dev/null
sleep 1
pkill -9 -f "Google Chrome Beta" 2>/dev/null
sleep 1
```

Then launch in background (`run_in_background: true`):

```bash
"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-beta-profile"
```

Wait 4s, then verify:

```bash
curl -s http://localhost:9222/json/version
```

**Key:** `--user-data-dir` is REQUIRED. Without it Chrome refuses to enable remote debugging on a default profile.

## Connect agent-browser

**CRITICAL: Always use `--cdp 9222 --session <name>` on EVERY command.** The `--cdp` flag attaches to Chrome's debugging port, `--session` provides named session isolation for multi-tab work.

```bash
agent-browser --cdp 9222 --session main snapshot -i
agent-browser --cdp 9222 --session main click @e1
agent-browser --cdp 9222 --session main screenshot /tmp/page.png
```

No separate `connect` step needed — `--cdp` handles the connection on each invocation.


## Persistent login sessions

Profile at `~/.chrome-beta-profile` persists cookies and sessions across restarts.

**First time setup (e.g. LinkedIn):**
1. Launch Chrome Beta (steps above)
2. Connect agent-browser
3. `agent-browser open "https://www.linkedin.com/login"`
4. User logs in manually in the Chrome window
5. Kill Chrome, relaunch - session is preserved

**DO NOT** use Playwright profiles (`~/.agent-browser/profiles/`) - Chrome can't read them.

## Parallel sessions (single Chrome instance)

Multiple independent sessions share one Chrome instance and its login state. Each session gets its own tab.

**Setup:**

```bash
agent-browser --cdp 9222 --session s1 open "https://site1.com/apply"
agent-browser --cdp 9222 --session s2 open "https://site2.com/apply"
agent-browser --cdp 9222 --session s3 open "https://site3.com/apply"
```

**Each session operates independently:**

```bash
agent-browser --cdp 9222 --session s1 snapshot -i
agent-browser --cdp 9222 --session s1 fill @e1 "Jane Doe"

agent-browser --cdp 9222 --session s2 snapshot -i
agent-browser --cdp 9222 --session s2 fill @e3 "user@example.com"
```

**Tested:** 5+ parallel sessions work, all sharing the same cookies/login state.

**Cleanup:**

```bash
agent-browser --session s1 tab close
agent-browser --session s2 tab close
```

## Batch tab opening (minimize focus interruptions)

**CRITICAL: Opening a new Chrome tab steals OS focus from the user's current window. To avoid repeated interruptions, always batch-open all tabs upfront before doing any work.**

### Option A: CDP background tabs (PREFERRED — zero focus steal)

Use Chrome's CDP `Target.createTarget` endpoint directly. This creates tabs **without stealing OS focus** at all — Chrome stays in the background the entire time.

```bash
# Create background tabs via CDP HTTP API (no focus steal!)
URLS=("https://site1.com/jobs" "https://site2.com/jobs" "https://site3.com/jobs")

for url in "${URLS[@]}"; do
  curl -s "http://localhost:9222/json/new?${url}" > /dev/null
done

# Wait for pages to load
sleep 5

# Now use sessions with --cdp to work with tabs
agent-browser --cdp 9222 --session s0 snapshot -i
agent-browser --cdp 9222 --session s1 snapshot -i
agent-browser --cdp 9222 --session s2 snapshot -i
```

**How it works:** `GET http://localhost:9222/json/new?<url>` creates a new tab via CDP without triggering OS focus. The response includes the tab's `webSocketDebuggerUrl` for direct connection.

### Option B: Batch agent-browser tabs (one brief focus steal)

If CDP direct isn't available, batch-open all tabs in a tight loop — this causes ONE brief focus steal instead of N.

```bash
URLS=("https://site1.com/jobs" "https://site2.com/jobs" "https://site3.com/jobs")

for i in "${!URLS[@]}"; do
  agent-browser --cdp 9222 --session "s$i" tab new "${URLS[$i]}"
done

sleep 5

for i in "${!URLS[@]}"; do
  agent-browser --cdp 9222 --session "s$i" snapshot
done
```

**NEVER open tabs one-by-one interleaved with work.** Bad: open tab, scrape, open tab, scrape. Good: open all tabs, then scrape all.

## Job applications - parallel workflow

**CRITICAL: Every agent MUST use `--cdp 9222 --session job-{ID}` for ALL commands.**

**Before launching parallel agents, batch-open all tabs (prefer CDP for zero focus steal):**

```bash
# Batch-open phase via CDP (PREFERRED — no focus steal)
for ID in 124 180 182 195; do
  curl -s "http://localhost:9222/json/new?https://company-$ID.com/apply" > /dev/null
done
sleep 5
```

**Then each agent works with `--cdp 9222 --session`:**

```bash
agent-browser --cdp 9222 --session job-124 snapshot
agent-browser --cdp 9222 --session job-124 fill @ref_1 "Jane Doe"
agent-browser --cdp 9222 --session job-124 tab close  # cleanup after done
```

Multiple agents can run in parallel, each with its own `--session`:

```bash
# Agent 1                                              # Agent 2
agent-browser --cdp 9222 --session job-180 snapshot      agent-browser --cdp 9222 --session job-182 snapshot
agent-browser --cdp 9222 --session job-180 fill @e1 val  agent-browser --cdp 9222 --session job-182 fill @e1 val
```

All sessions share the same cookies/login state (same Chrome profile). No interference between sessions.

## Verify no automation flag

```bash
agent-browser eval 'navigator.webdriver'
# Expected: false (or undefined)
```

## Reliability: timeouts and checkpoints

The main failure mode in browser automation is an unbounded wait — a page that never loads, a element that never appears, a redirect loop. Don't iterate on browser config; instead, treat each browser subtask with a hard timeout and checkpoint strategy.

**Hard timeouts on every command:**

```bash
timeout 15 agent-browser --cdp 9222 --session main snapshot -i
timeout 10 agent-browser --cdp 9222 --session main click @e1
timeout 20 agent-browser --cdp 9222 --session main fill @e3 "value"
```

If a command times out, take a snapshot to capture last-known state, then decide whether to retry or skip.

**Checkpoint pattern for multi-step flows:**

Break long flows (e.g. job applications) into discrete steps. After each step, snapshot and record progress so you can retry from that point rather than restarting from scratch.

```
Step 1: Navigate to form → checkpoint: on form page
Step 2: Fill personal info → checkpoint: info filled
Step 3: Upload CV        → checkpoint: CV attached
Step 4: Submit           → checkpoint: done
```

If step 3 fails, retry from step 3 (the page is already on the form with info filled), not from step 1.

**Recovery after timeout:**

```bash
# Take a snapshot to see where we are
timeout 10 agent-browser --cdp 9222 --session main snapshot -i
# If page is stuck, try navigating directly
timeout 10 agent-browser --cdp 9222 --session main eval "window.location.href='https://...'"
# If Chrome debugging port is unresponsive, verify it's still running
curl -s http://localhost:9222/json/version
```

## Upgrading agent-browser: kill stale daemons

**CRITICAL: After upgrading agent-browser, always kill stale daemons before using it.**

agent-browser runs a background daemon process. When you upgrade versions, the old daemon keeps running. The new CLI talking to the old daemon causes silent failures: blank pages, missing cookies, wrong targets. There is no version mismatch warning.

```bash
pkill -f agent-browser
rm -rf /tmp/agent-browser-* ~/.agent-browser/sockets/ 2>/dev/null
bun install -g agent-browser@latest
agent-browser --version
```

**Verified (2026-04-03):** v0.22.3 CDP connect works correctly — discovers existing pages, reads cookies. The old v0.10.0 pin was caused by stale Node.js daemons from pre-v0.16 versions, not a regression in newer code.

**If CDP connect returns `about:blank` or empty cookies after upgrade:** stale daemon is the #1 suspect. Kill all processes and retry before debugging anything else.

## Notes

- If Chrome Beta is already running without `--remote-debugging-port`, kill it first
- Profile at `~/.chrome-beta-profile` is separate from your main Chrome Beta profile
- Chrome must be relaunched with the debug port each time (doesn't persist between reboots)
- No need for multiple Chrome instances on different ports — use `--cdp 9222 --session <name>` instead
- **Always use `--cdp 9222`** on every command to attach to Chrome's debugging port
- **NEVER use `agent-browser --session <name> connect 9222`** — the `connect` subcommand creates blank tabs (bug in Rust daemon, verified v0.22.3)
