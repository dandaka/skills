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
2. Connect a named session: `agent-browser --session <name> connect 9222`
3. Use `--session <name>` on ALL subsequent commands

## Launch Chrome Beta

```bash
pkill -9 -f "Google Chrome Beta" 2>/dev/null
sleep 2
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

**CRITICAL: Always use `--session <name>` on EVERY command.** Without `--session`, each invocation is a standalone process that doesn't persist the CDP connection — commands will hang or launch a separate headless browser.

```bash
agent-browser --session main connect 9222
```

After connecting, all commands work with the same session flag:

```bash
agent-browser --session main snapshot -i
agent-browser --session main click @e1
```


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
agent-browser --session s1 connect 9222
agent-browser --session s1 eval "window.location.href='https://site1.com/apply'"

agent-browser --session s2 connect 9222
agent-browser --session s2 eval "window.location.href='https://site2.com/apply'"

agent-browser --session s3 connect 9222
agent-browser --session s3 eval "window.location.href='https://site3.com/apply'"
```

**Each session operates independently:**

```bash
agent-browser --session s1 snapshot -i
agent-browser --session s1 fill @e1 "Jane Doe"

agent-browser --session s2 snapshot -i
agent-browser --session s2 fill @e3 "user@example.com"
```

**Tested:** 5+ parallel sessions work, all sharing the same cookies/login state.

**Cleanup:**

```bash
agent-browser --session s1 tab close
agent-browser --session s2 tab close
```

## Job applications - parallel workflow

**CRITICAL: Every agent MUST use `--session job-{ID}` for ALL commands. Never run bare `agent-browser` commands without `--session` when launched as a background agent — it creates tab conflicts.**

Use lead ID as session name:

```bash
agent-browser --session job-124 connect 9222
agent-browser --session job-124 tab new "https://company.com/apply"
agent-browser --session job-124 snapshot
agent-browser --session job-124 fill @ref_1 "Jane Doe"
agent-browser --session job-124 tab close  # cleanup after done
```

Multiple agents can run in parallel, each with its own `--session`:

```bash
# Agent 1                                    # Agent 2
agent-browser --session job-180 connect 9222  agent-browser --session job-182 connect 9222
agent-browser --session job-180 tab new URL1  agent-browser --session job-182 tab new URL2
agent-browser --session job-180 snapshot      agent-browser --session job-182 snapshot
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
timeout 15 agent-browser --session main snapshot -i
timeout 10 agent-browser --session main click @e1
timeout 20 agent-browser --session main fill @e3 "value"
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
timeout 10 agent-browser --session main snapshot -i
# If page is stuck, try navigating directly
timeout 10 agent-browser --session main eval "window.location.href='https://...'"
# If session is dead, reconnect
agent-browser --session main connect 9222
```

## Notes

- If Chrome Beta is already running without `--remote-debugging-port`, kill it first
- Profile at `~/.chrome-beta-profile` is separate from your main Chrome Beta profile
- Chrome must be relaunched with the debug port each time (doesn't persist between reboots)
- No need for multiple Chrome instances on different ports - use `--session` instead
- **NEVER use bare `agent-browser` without `--session`** — the CDP connection won't persist and commands will hang or spawn a headless browser
