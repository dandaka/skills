# telegram

Telegram bot for posting to channels using Grammy framework.

## Installation

```bash
bun install
```

## Configuration

Create a `.env` file with:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=your_channel_id_here  # Optional: enables posting without specifying channel
```

## Usage

### Post to default channel (from .env)

```bash
cd /Users/dandaka/.claude/skills/telegram
bun run post.ts "Your message here"
```

### Post to specific channel

```bash
cd /Users/dandaka/.claude/skills/telegram
bun run post.ts "@channel_username" "Your message here"
```

### Multi-line messages

For multi-line messages (like article summaries), the message must be passed as a **single quoted argument**:

```bash
cd /Users/dandaka/.claude/skills/telegram
bun run post.ts "Line 1

Line 2

Line 3"
```

**CRITICAL:**
- ALWAYS `cd` to `/Users/dandaka/.claude/skills/telegram` first to ensure .env loads
- The entire message (including newlines) must be one quoted string argument
- Do NOT try to pass multiple string arguments - the script expects exactly 1 argument when TELEGRAM_CHANNEL_ID is set in .env

## Formatting

Supports Markdown formatting:
- **Bold**: `**text**`
- _Italic_: `_text_`
- `Code`: `` `code` ``

This project was created using `bun init` in bun v1.3.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
