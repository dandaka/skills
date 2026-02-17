---
name: telegram
description: Post messages and article summaries to a Telegram channel. When the user provides an article URL or content, summarize it to ~2000 characters and post to the configured channel. Use when the user needs to share articles, summaries, or updates to their channel.
compatibility: Requires Grammy (install via: bun add grammy) and TELEGRAM_BOT_TOKEN in .env
metadata:
  author: dandaka
  version: "1.0"
  channel: Your Telegram Channel
  summary_length: 2000 characters (preferred)
allowed-tools: Bash(bun run*), WebFetch, Read
---

# Telegram Channel Poster

This skill provides the ability to post messages and article summaries to a Telegram channel using the Grammy framework.

## Primary Use Case: Article Summaries

When the user provides an article (URL or content), this skill will:

1. Fetch and read the article content
2. Generate a summary of approximately **2000 characters**
3. Post the summary to the configured Telegram channel

**Preferred summary format:**

- Language: **Always write summaries in the same language as the source article** (English by default)
- Length: ~2000 characters (strict preference)
- Include key points and takeaways
- Maintain readability
- Use Markdown formatting for emphasis

## Prerequisites

Before using this skill, ensure:

1. Grammy is installed (already installed in this skill directory)

2. Add credentials to `~/.claude/.env`:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=your_channel_id_here
```

3. Your bot has been added as an administrator to the target channel

Note: Bun automatically loads `.env` files - no additional packages needed!

## Core Capabilities

### 1. Summarize and Post Article (Primary Function)

When the user provides an article URL:

**Workflow:**

1. Use WebFetch or `agent-browser` to retrieve the article content
2. Generate a summary of ~2000 characters
3. Post the summary to the channel using post.ts

```bash
# CRITICAL: Change to skill directory FIRST, then run post.ts
# The entire message (including newlines) must be ONE quoted string argument
cd ~/.claude/skills/telegram && bun run post.ts "**Article Title**

[Summary ~2000 chars]

Source: [URL]"
```

**CRITICAL REQUIREMENTS:**

- ALWAYS `cd` to `~/.claude/skills/telegram` first (so bun finds node_modules)
- The ENTIRE message must be passed as a SINGLE quoted string argument
- Do NOT split the message into multiple arguments
- When `TELEGRAM_CHANNEL_ID` is set in .env, the script expects exactly 1 argument (the message)

**Summary Guidelines:**

- **Always write in the same language as the source article**
- Target length: 2000 characters (strict preference)
- Include article title
- Extract key points and insights
- Maintain readability and flow
- Use Markdown for formatting (**bold**, _italic_)
- Include source URL at the end
- NEVER add "Posted via Claude Code" or similar signatures

### 2. Post Message to Channel

**Option A: Using default channel from .env**

```bash
cd ~/.claude/skills/telegram && bun run post.ts "Your message here"
```

**Option B: Specify channel explicitly**

```bash
cd ~/.claude/skills/telegram && bun run post.ts "@channel_username" "Your message here"
```

**Multi-line messages:**

```bash
cd ~/.claude/skills/telegram && bun run post.ts "Line 1

Line 2

Line 3"
```

Arguments:

- If `TELEGRAM_CHANNEL_ID` is set in `.env`: Only message is required (1 argument)
- Otherwise: First argument is channel (@ prefix or numeric ID), second is message (2 arguments)
- Multi-line content must be in a single quoted string, NOT multiple arguments

### 3. Post with Formatting

Grammy supports Markdown and HTML formatting:

```bash
# Markdown formatting
cd ~/.claude/skills/telegram && bun run post.ts "@channel" "**Bold** _italic_ `code`"

# HTML formatting
cd ~/.claude/skills/telegram && bun run post.ts "@channel" "<b>Bold</b> <i>italic</i> <code>code</code>"
```

## Usage Instructions

### For Article Summaries (Primary Use Case):

When the user provides an article URL or asks to share an article:

1. **Fetch the article** - Use WebFetch to get the content
2. **Generate summary** - Create a ~2000 character summary with key points
3. **Format for Telegram** - Use Markdown formatting
4. **Post to channel** - Use `cd ~/.claude/skills/telegram && bun run post.ts "summary"`
5. **Confirm success** - Show the message ID

### For Direct Messages:

When the user wants to post a message directly:

1. **Get the message content** - The text to post
2. **Run the post script** - Default channel is pre-configured
3. **Confirm success** - The script will output the result

The skill posts to the channel configured via `TELEGRAM_CHANNEL_ID` in `~/.claude/.env`.

## Common Patterns

### Summarize and post article

```
User: "Summarize and post this article: https://example.com/article"

Claude:
1. Uses WebFetch to get article content
2. Generates ~2000 character summary
3. Posts via: cd ~/.claude/skills/telegram && bun run post.ts "**Article Title**

[Summary]

Source: https://example.com/article"
```

### Post simple message

```bash
cd ~/.claude/skills/telegram && bun run post.ts "Hello from Claude!"
```

### Post formatted announcement

```bash
cd ~/.claude/skills/telegram && bun run post.ts "**New Update**

Check out our latest features!"
```

## Error Handling

If the bot token is missing:

- Check that `.env` file contains `TELEGRAM_BOT_TOKEN`
- Verify the token is valid from @BotFather

If posting fails:

- Ensure the bot is added as admin to the channel
- Verify the channel username is correct (include @ prefix)
- Check that the channel exists and bot has permission to post

## Environment Variables

Required in `~/.claude/.env`:

```
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHANNEL_ID=your_channel_id (optional, enables posting without specifying channel)
```

## Tips

- Channel usernames must start with @ (e.g., @mychannel)
- For private channels, use the numeric channel ID instead
- The bot must be an administrator of the channel to post
- Messages support Telegram's markdown formatting
- Maximum message length is 4096 characters
- NEVER add "Posted via Claude Code" or similar signatures to messages
- Always use the same language for summary as in source article
