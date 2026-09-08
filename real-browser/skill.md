---
name: real-browser
description: Attach agent-browser to the real Chrome Beta instances running on this machine (persistent logins, one profile per CDP port) without launching Playwright-controlled browsers. Use for any site that detects automation, for QA at https://dev.bracos.app, or when several agents need the same browser at once.
allowed-tools: Bash(agent-browser:*), Bash(curl:*), Bash(sleep:*), Bash(launchctl:*)
---

# Real Chrome Beta via agent-browser

This skill covers only what is specific to this machine and to attaching to a
human-owned Chrome. The agent-browser command reference is **not** duplicated
here: it ships inside the CLI, version-matched, and is always more current
than anything copied into this file.

```bash
agent-browser skills get core          # overview + common patterns (read once per session)
agent-browser skills get core --full   # full command reference, tab pinning, restore, batch
agent-browser <command> --help         # per-command help
```

Verified against agent-browser 0.34.0 on 2026-09-08 (latest on npm at that
time: 0.37.0). Everything below relies on `--pin-tab`, present in 0.34.0; older installs
must upgrade first.

## Profiles and ports on this machine

Each Chrome Beta profile is its own process on its own CDP port. Pick the
port by what you need, never by habit.

| Port | Profile dir | Owner / purpose | Managed by |
|------|-------------|-----------------|------------|
| 9222 | `~/.chrome-beta-profile-financas` | Founder's personal working browser (finance, banking, ads accounts). Many user tabs open. | Launched by hand |
| 9223 | `~/.chrome-beta-profile` | Bracos main: Facebook account 1, dev.bracos.app QA, general agent work | launchd `app.bracos.chrome-beta-cdp` |
| 9224 | (forwarder) | `socat` forward of 9223 bound on `0.0.0.0` for the VPS scrapers. Same browser as 9223. Do not use locally. | launchd `app.bracos.chrome-cdp-forwarder` |
| 9225 | `~/.chrome-beta-profile-acct2` | Facebook account 2. Runs behind a proxy with images disabled. Scraper only. | launchd `app.bracos.chrome-beta-cdp-acct2` |
| 9226 | Figma desktop | Electron, not Chrome. Belongs to the `figma-use` skill. | Figma app |

Defaults:

- **Bracos work (QA, Facebook, anything the founder's Bracos account is logged into): `--cdp 9223`.**
- Personal accounts the founder is logged into in their day-to-day browser: `--cdp 9222`, and only when the task explicitly needs that login.
- 9225 is production scraping infrastructure. Do not attach unless the task is the acct2 scraper itself.

Check what is up before attaching:

```bash
for p in 9222 9223 9225; do printf "%s " $p; curl -s -m 2 http://localhost:$p/json/version | grep -o '"Browser": "[^"]*"' || echo down; done
```

9223 and 9225 are restarted by launchd every day at 05:00. That restart also
kills every agent-browser daemon on the machine, so a session that lives
across 05:00 must expect a fresh daemon and re-bind its tab.

## The three rules

1. **Never launch a browser through agent-browser.** No `agent-browser open`
   without `--cdp`, no `--headed`, no `--profile`. Those start a
   Playwright-controlled Chromium, which the target sites detect, and they
   do not carry the persistent logins. Always attach to a running Chrome
   with `--cdp <port>`.
2. **Never quit, kill or restart Chrome, and never `pkill agent-browser`.**
   The founder works in these windows, and the production Facebook scraper
   keeps its own long-lived agent-browser daemons on 9223 and 9225. A global
   `pkill` takes production down. To end your own work, close your own
   session (below). If Chrome is broken and you think it needs a restart,
   say so and stop.
3. **Every command carries `--cdp <port> --session <id>`, and the first
   command of the session also carries `--pin-tab`.** Without a pin, `open`
   navigates whatever tab is active in the shared browser, which may be the
   founder's or another agent's.

## Start a session

```bash
PORT=9223
SESSION=qa-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)   # unique per agent run
# `agent-browser session id --prefix qa` is stable per checkout: fine for one long-lived
# loop, wrong for parallel agents started from the same repo (they would share a tab)

agent-browser --cdp $PORT --session "$SESSION" --pin-tab open "https://dev.bracos.app"
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
- Tabs opened by the founder or other sessions never become your active tab.
- The flag is sticky per session. Pass it once; later commands may omit it.
  `--no-pin-tab` turns it off again.

If the bound tab disappears (the founder closed it, the 05:00 restart, the
cleanup job), commands fail with `code: "tab_gone"` instead of silently
acting on someone else's tab. Recover explicitly:

```bash
agent-browser --cdp $PORT --session "$SESSION" tab new "https://dev.bracos.app"   # bind a new tab
# or pick an existing one by target id
agent-browser --cdp $PORT --session "$SESSION" tab list --json
agent-browser --cdp $PORT --session "$SESSION" tab <targetId>
```

## End a session

```bash
agent-browser --cdp $PORT --session "$SESSION" tab close   # closes only your tab
agent-browser --session "$SESSION" close                   # stops your daemon; Chrome stays up
```

`close` on a CDP-attached session detaches; it does not quit Chrome
(verified). Leaving tabs behind is not free: a cleanup job on 9223 closes
stale `newtab` pages every 10 minutes and caps the tab count, so tidy up.

## Parallel agents

Every agent gets its own `SESSION` and its own pinned tab; all share the
profile's cookies. Open all tabs first, then work, so the founder gets one
burst of new tabs instead of a trickle.

```bash
for ID in 124 180 182; do
  agent-browser --cdp 9223 --session "job-$ID" --pin-tab open "https://example.com/apply/$ID"
done
# each agent then works only in its own session
agent-browser --cdp 9223 --session job-124 snapshot -i
agent-browser --cdp 9223 --session job-180 snapshot -i
```

Do not use `curl http://localhost:PORT/json/new?url` to pre-create tabs any
more. A pinned session opens its own tab on first attach, and a tab created
outside agent-browser has no session bound to it.

## Timeouts and recovery

`timeout` and `gtimeout` do not exist on this Mac. Use agent-browser's own
timeout instead:

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
login: open the site in a pinned session, tell the founder which window and
tab, and let them log in by hand. The session persists across Chrome
restarts. Do not use `--profile`, `--restore` or `--state` for these
profiles; they are for agent-browser-launched browsers.

## Launching a profile that is down

Only 9222 is launched by hand. If its check fails, start it in the
background and wait a few seconds:

```bash
"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
  --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-beta-profile-financas"
```

`--user-data-dir` is required; Chrome refuses remote debugging on its
default profile. If Chrome Beta is already running **without** the debug
port, ask the founder to relaunch it. Do not close it yourself.

9223 and 9225 are launchd services with KeepAlive. If one is down and the
founder has asked you to bring it back:

```bash
launchctl kickstart -k "gui/$(id -u)/app.bracos.chrome-beta-cdp"        # 9223
launchctl kickstart -k "gui/$(id -u)/app.bracos.chrome-beta-cdp-acct2"  # 9225
```

Read `docs/processes/prod-deploy-and-mac-mini-loops.md` in the bracos repo
before touching launchd.

## Upgrading agent-browser

The daemon is a long-lived process; a new CLI talking to an old daemon fails
silently. Upgrade only when `agent-browser session list` shows no live
sessions you do not own, and never during the scraper's working hours
without the founder's go-ahead.

```bash
agent-browser upgrade          # or: bun install -g agent-browser@latest
agent-browser doctor --fix     # clears stale sockets and state files
agent-browser --version
```

## Verify it is a real browser

```bash
agent-browser --cdp $PORT --session "$SESSION" eval 'navigator.webdriver'   # expect false or undefined
```
