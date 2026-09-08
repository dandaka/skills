---
name: real-browser
description: Attach agent-browser to a real, human-owned Chrome (persistent logins, one profile per CDP port) instead of launching a Playwright-controlled browser. Use for sites that detect automation, for QA against a logged-in app, or when several agents must share one browser without fighting over tabs.
allowed-tools: Bash(agent-browser:*), Bash(curl:*), Bash(sleep:*)
---

# Real Chrome via agent-browser

This skill covers only what is specific to attaching to a Chrome that a human
owns and keeps logged in. The agent-browser command reference is **not**
duplicated here: it ships inside the CLI, version-matched, and is always more
current than anything copied into this file.

```bash
agent-browser skills get core          # overview + common patterns (read once per session)
agent-browser skills get core --full   # full command reference, tab pinning, restore, batch
agent-browser <command> --help         # per-command help
```

Requires agent-browser 0.34 or newer (`--pin-tab`). Check with
`agent-browser --version`.

## Machine-specific config

**Before anything else, read `~/.claude/real-browser.local.md` if it exists.**
It lists this machine's Chrome profiles, which CDP port each one listens on,
which one to use by default, which ones are off limits, and any scheduled
restarts or cleanup jobs. That file is private and never committed. A template
lives next to this skill in `LOCAL.example.md`.

If the file does not exist, discover what is running and ask the user which
port to use:

```bash
for p in 9222 9223 9224 9225; do printf "%s " $p; curl -s -m 2 http://localhost:$p/json/version | grep -o '"Browser": "[^"]*"' || echo down; done
```

## The three rules

1. **Never launch a browser through agent-browser.** No `agent-browser open`
   without `--cdp`, no `--headed`, no `--profile`. Those start a
   Playwright-controlled Chromium, which target sites detect, and they do
   not carry the human's logins. Always attach to a running Chrome with
   `--cdp <port>`.
2. **Never quit, kill or restart Chrome, and never `pkill agent-browser`.**
   The user works in these windows, and other long-lived agents (scrapers,
   loops) may hold their own agent-browser daemons on the same ports. A
   global `pkill` takes them all down. To end your own work, close your own
   session (below). If Chrome looks broken, say so and stop.
3. **Every command carries `--cdp <port> --session <id>`, and the first
   command of the session also carries `--pin-tab`.** Without a pin, `open`
   navigates whatever tab is active in the shared browser, which may be the
   user's or another agent's.

## Start a session

```bash
PORT=9223                                                        # from the local config
SESSION=qa-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)   # unique per agent run
# `agent-browser session id --prefix qa` is stable per checkout: fine for one long-lived
# loop, wrong for parallel agents started from the same repo (they would share a tab)

agent-browser --cdp $PORT --session "$SESSION" --pin-tab open "https://example.com"
agent-browser --cdp $PORT --session "$SESSION" snapshot -i
agent-browser --cdp $PORT --session "$SESSION" click @e3
```

Put `PORT` and `SESSION` in variables at the top of the agent and reuse them
on every call. Never use `default`, `main` or another guessable session name;
two agents on the same name share one daemon and one tab.

What `--pin-tab` gives you:

- The first attach opens a **fresh tab** for this session instead of adopting
  the active one. Nothing you do touches other tabs.
- The binding is by CDP target id and persists in
  `~/.agent-browser/<session>.target`, so it survives daemon restarts.
- Tabs opened by the user or other sessions never become your active tab.
- The flag is sticky per session. Pass it once; later commands may omit it.
  `--no-pin-tab` turns it off again.

If the bound tab disappears (the user closed it, Chrome restarted, a cleanup
job ran), commands fail with `code: "tab_gone"` instead of silently acting on
someone else's tab. Recover explicitly:

```bash
agent-browser --cdp $PORT --session "$SESSION" tab new "https://example.com"   # bind a new tab
# or pick an existing one by target id
agent-browser --cdp $PORT --session "$SESSION" tab list --json
agent-browser --cdp $PORT --session "$SESSION" tab <targetId>
```

## End a session

```bash
agent-browser --cdp $PORT --session "$SESSION" tab close   # closes only your tab
agent-browser --session "$SESSION" close                   # stops your daemon; Chrome stays up
```

`close` on a CDP-attached session detaches; it does not quit Chrome. Do not
leave tabs behind; the user sees every one of them.

## Parallel agents

Every agent gets its own `SESSION` and its own pinned tab; all share the
profile's cookies. Open all tabs first, then work, so the user gets one burst
of new tabs instead of a trickle.

```bash
for ID in 124 180 182; do
  agent-browser --cdp $PORT --session "job-$ID" --pin-tab open "https://example.com/apply/$ID"
done
# each agent then works only in its own session
agent-browser --cdp $PORT --session job-124 snapshot -i
agent-browser --cdp $PORT --session job-180 snapshot -i
```

Do not pre-create tabs with `curl http://localhost:PORT/json/new?url`. A
pinned session opens its own tab on first attach, and a tab created outside
agent-browser has no session bound to it.

## Timeouts and recovery

macOS ships without `timeout`. Use agent-browser's own timeout instead:

```bash
export AGENT_BROWSER_DEFAULT_TIMEOUT=15000   # ms, default 25000
```

If a command hangs or fails:

1. `agent-browser --cdp $PORT --session "$SESSION" snapshot -i` to see where the page is.
2. `agent-browser --cdp $PORT --session "$SESSION" session info --json` for daemon and binding state.
3. `curl -s http://localhost:$PORT/json/version` to confirm Chrome is still answering.
4. `agent-browser doctor` for stale install files. Never `doctor --fix` or `pkill` while other sessions are live (`agent-browser session list`).

Break long flows into checkpoints (on form, info filled, file attached,
submitted) and retry from the failed step, not from the start.

## Persistent logins

Logins live in the Chrome profile directory, not in agent-browser. To add a
login: open the site in a pinned session, tell the user which window and tab,
and let them log in by hand. It persists across Chrome restarts. Do not use
`--profile`, `--restore` or `--state` against a human-owned Chrome; those are
for browsers agent-browser launches itself.

## Launching a profile that is down

Only if the local config says the profile is launched by hand. Start it in
the background and wait a few seconds:

```bash
"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
  --remote-debugging-port=<port> --user-data-dir="$HOME/<profile-dir>"
```

`--user-data-dir` is required; Chrome refuses remote debugging on its
default profile. If Chrome is already running **without** the debug port,
ask the user to relaunch it. Do not close it yourself. Profiles managed by a
service manager (launchd, systemd) are restarted through that manager, and
only when the user asks.

## Upgrading agent-browser

The daemon is a long-lived process; a new CLI talking to an old daemon fails
silently. Upgrade only when `agent-browser session list` shows no live
sessions you do not own.

```bash
agent-browser upgrade          # or: bun install -g agent-browser@latest
agent-browser doctor --fix     # clears stale sockets and state files
agent-browser --version
```

## Verify it is a real browser

```bash
agent-browser --cdp $PORT --session "$SESSION" eval 'navigator.webdriver'   # expect false or undefined
```
