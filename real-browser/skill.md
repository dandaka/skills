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
2. Connect agent-browser with `agent-browser connect 9222`
3. Use agent-browser commands normally (no `--cdp` flag needed after connect)

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

```bash
agent-browser connect 9222
```

After connecting, all commands work without any extra flags:

```bash
agent-browser open "https://www.linkedin.com"
agent-browser snapshot -i
agent-browser click @e1
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
agent-browser --session s1 tab new "https://site1.com/apply"

agent-browser --session s2 connect 9222
agent-browser --session s2 tab new "https://site2.com/apply"

agent-browser --session s3 connect 9222
agent-browser --session s3 tab new "https://site3.com/apply"
```

**Each session operates independently:**

```bash
agent-browser --session s1 snapshot -i
agent-browser --session s1 fill @e1 "Vlad Ra"

agent-browser --session s2 snapshot -i
agent-browser --session s2 fill @e3 "vlad19@gmail.com"
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
agent-browser --session job-124 fill @ref_1 "Vlad Ra"
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

## Notes

- If Chrome Beta is already running without `--remote-debugging-port`, kill it first
- Profile at `~/.chrome-beta-profile` is separate from your main Chrome Beta profile
- Chrome must be relaunched with the debug port each time (doesn't persist between reboots)
- No need for multiple Chrome instances on different ports - use `--session` instead
