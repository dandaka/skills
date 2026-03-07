---
name: peon-ping-toggle
description: Toggle peon-ping sound notifications on/off. Use when user wants to mute, unmute, pause, or resume peon sounds during a Claude Code session.
user_invocable: true
---

[![skillcheck passed](https://img.shields.io/badge/skillcheck-passed-4c1)](https://getskillcheck.com) ![score](https://img.shields.io/badge/score-94-brightgreen)

# peon-ping-toggle

Toggle peon-ping sounds on or off.

Run the following command using the Bash tool:

```bash
bash ~/.claude/hooks/peon-ping/peon.sh --toggle
```

Report the output to the user. The command will print either:
- `peon-ping: sounds paused` — sounds are now muted
- `peon-ping: sounds resumed` — sounds are now active
