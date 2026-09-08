# real-browser: machine-specific config (template)

Copy this file to `~/.claude/real-browser.local.md` and fill it in. The
skill reads that path first. Keep it out of any public repo; it describes
which of your logged-in browsers agents may touch.

## Profiles and ports

| Port | Profile dir | Purpose | Managed by | Agents may use? |
|------|-------------|---------|------------|-----------------|
| 9222 | `~/.chrome-profile-personal` | Your day-to-day browser, personal logins | launched by hand | only when the task needs that login |
| 9223 | `~/.chrome-profile-work` | Work account, app QA, general agent work | launchd / systemd service `<label>` | yes, default |
| 9225 | `~/.chrome-profile-bot` | Long-running scraper account | service `<label>` | no, scraper only |

## Defaults

- Default port for agent work: 9223.
- Off limits: 9225 unless the task is the scraper itself.

## Scheduled jobs that affect sessions

- Daily restart of the service-managed profiles at HH:MM. It also kills every
  agent-browser daemon, so sessions must re-bind their tab afterwards.
- Cleanup job on port 9223 every N minutes: closes stale new-tab pages and
  caps the tab count.

## Restarting a service-managed profile (only when the user asks)

```bash
launchctl kickstart -k "gui/$(id -u)/<label>"
```
