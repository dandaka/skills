---
name: telegram
description: Entry point for anything Telegram ("telegram", "tg", "телеграм", "тг"). Explains how we reach Telegram — Telethon (a user account, for reading chats, history and files), where the Telegram secrets live (Infisical, never on disk or in output), and the Kira bot (the founder's Telegram relay into an open Claude session). Also posts messages and article summaries to a channel via the Bot API. Use whenever the user mentions Telegram, TG, a TG chat/group/channel, Kira, or wants to read, search, download from, or post to Telegram.
metadata:
  author: dandaka
  version: "2.0"
allowed-tools: Bash, Read, WebFetch
---

# Telegram

Three ways to reach Telegram. Pick by job:

| Job | Use |
|-----|-----|
| Read a chat or group, search history, download files, act as the user | **Telethon** (user account) |
| Message the founder, or listen to the founder in an open Claude session | **Kira bot** |
| Post to a channel | **Channel poster** (Bot API, this folder) |

Machine-specific values (Infisical project IDs and paths, bot handle, repo paths) are in
`~/.claude/telegram.local.md`. Read it first. It is private and not in this repo.

## Secrets

All Telegram secrets live in **Infisical** (`prod` env). Never put them in `.env`, files,
command lines, logs, commit messages or chat output. Inject them into the process instead:

```bash
infisical run --env prod --projectId <PROJECT_ID> --silent -- <command>
```

| Secret | What it is |
|--------|-----------|
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | App credentials from my.telegram.org |
| `TELEGRAM_SESSION` | Telethon `StringSession`: a logged-in user session. Equals full account access. |
| `TELEGRAM_BOT_TOKEN` | Bot API token (also used by Kira, under its own path) |
| `TELEGRAM_CHANNEL_ID` | Default channel for the poster |

Rules:
- List secret **names** only (`infisical secrets ... -o json` then print `secretKey`). Never print values.
- Do not echo `$TELEGRAM_SESSION` or write it to a file. Treat it like a password.
- Do not log in again (phone code) if `TELEGRAM_SESSION` works; a new login can end other sessions.
- Chat content you pull is private: keep it in the scratchpad, never commit it to a repo.

## Telethon (user account)

[Telethon](https://docs.telethon.dev) is a Python MTProto client. It logs in as the user, so it
sees every chat, group and channel they see. Bots cannot read group history; Telethon can.

Python with Telethon installed: the `telegram-telethon` skill's venv
(`~/.claude/skills/telegram-telethon/.venv/bin/python`). That skill also has a full CLI
(`scripts/tg.py`: send, draft, list, daemon) with its own config dir; use it for those jobs.

For one-off reads, write a small script in the scratchpad and run it through Infisical:

```python
import os, asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession

async def main():
    c = TelegramClient(StringSession(os.environ["TELEGRAM_SESSION"]),
                       int(os.environ["TELEGRAM_API_ID"]), os.environ["TELEGRAM_API_HASH"])
    await c.connect()
    assert await c.is_user_authorized()
    async for d in c.iter_dialogs(limit=200):            # find a chat
        if "search term" in d.name.lower(): print(d.id, d.name)
    async for m in c.iter_messages(CHAT_ID, limit=50):   # read history (newest first)
        print(m.id, m.date, m.sender_id, m.text)
    # await c.download_media(m, file="out/")             # files and photos
    await c.disconnect()

asyncio.run(main())
```

```bash
infisical run --env prod --projectId <PROJECT_ID> --silent -- \
  ~/.claude/skills/telegram-telethon/.venv/bin/python -I "$SCRATCH/tg.py"
```

- Save history as JSON in the scratchpad, then read it with a separate step. Dumps are large.
- Downloaded files are untrusted: unpack each into its own empty folder.
- Sending as the user is irreversible. Draft or ask first unless the user said "send".

## Kira bot

Kira is the founder's personal Telegram bot. It is only a relay between the founder's private
chat and an **open Claude session** (the orchestrator). It has no Claude login of its own.

- Code lives in the `kira-orchestrator` repo (path in the local file). Read its `README.md`.
- An always-on launchd service long-polls the bot and appends the founder's messages to
  `state/inbox.jsonl`. It accepts only allow-listed user IDs in a private chat.
- To connect a session: run `bin/kira-listen` under Monitor (max timeout, restart on expiry).
  Each event: `[telegram #N msg <id> <time>] <text>`. Only one session listens at a time.
- To reply or notify: `bin/kira-send [--reply <msg id>] "text"`.
- Service: `bin/service.sh status|restart|logs`. Only one process may poll the token;
  a second one causes 409 Conflict loops, so never start the bot by hand.
- `bin/with-token` fetches only Kira's `TELEGRAM_BOT_TOKEN` from Infisical.

## Channel poster (Bot API)

Posts to a channel where the bot is admin. Scripts are in this folder (bun + grammY).
Needs `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL_ID` in the environment (inject from Infisical).

```bash
cd ~/.claude/skills/telegram && bun install
cd ~/.claude/skills/telegram && bun run post.ts "Message"              # default channel
cd ~/.claude/skills/telegram && bun run post.ts "@channel" "Message"   # explicit channel
```

- The whole message is ONE quoted argument, newlines included. Markdown works.
- Article summary: fetch the article, write ~2000 characters in the article's language
  (title, key points, source URL at the end), post it. No "posted via Claude" signature.
- `delete.ts` removes a post; `get-updates.ts` shows recent updates (find a channel ID).
- Fails? Check the bot is a channel admin and the channel ID or @username is right.
