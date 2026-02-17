---
name: mail
description: Manage Gmail using gog gmail command-line tool. Search emails, read messages, compose and send emails, manage labels, and perform common email operations. Use when the user needs to check their email, send messages, or work with Gmail.
compatibility: Requires gog (install via: go install github.com/stephenafamo/gog@latest)
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Bash(gog gmail*)
---

# Gmail Manager

This skill provides Gmail management capabilities using the `gog gmail` command-line tool.

## Prerequisites

Before using this skill, ensure gog is installed and authenticated:

```bash
go install github.com/stephenafamo/gog@latest
gog gmail init
```

The first time you run gog gmail, it will authenticate with your Google account.

## User Configuration

- **Default account**: set via `GOOGLE_ACCOUNT` in `~/.claude/.env`
- All gog gmail commands should use `--account $GOOGLE_ACCOUNT` flag
- **Important emails**: When user asks for "important" mail, NEVER use `is:important` filter. Instead, search for unread emails, read their content, and intelligently prioritize based on context (e.g., customer messages, time-sensitive requests, personal communications vs newsletters/promotions)
- **Label for action items**: Use `!2do` label to mark emails requiring action

## Core Capabilities

### 1. List/Search Emails

To list or search emails:

```bash
# List recent emails
gog gmail search --account $GOOGLE_ACCOUNT ""

# Search for specific emails
gog gmail search --account $GOOGLE_ACCOUNT "query"

# Search with specific criteria
gog gmail search --account $GOOGLE_ACCOUNT "is:unread"

# Search inbox
gog gmail search --account $GOOGLE_ACCOUNT "in:inbox"
```

### 2. Read Email

To read a specific email:

```bash
# Read email by ID
gog gmail get --account $GOOGLE_ACCOUNT <message-id>
```

### 3. Send Email

To send a new email:

```bash
# Send email
gog gmail send --account $GOOGLE_ACCOUNT --to "recipient@example.com" --subject "Subject" --body "Message body"

# Send with CC/BCC
gog gmail send --account $GOOGLE_ACCOUNT --to "recipient@example.com" --cc "cc@example.com" --bcc "bcc@example.com" --subject "Subject" --body "Message"

# Reply to an email (keeps it in the same thread)
gog gmail send --account $GOOGLE_ACCOUNT --reply-to-message-id "<message-id>" --reply-all --body "Reply message"

# Reply within a thread (uses latest message for headers)
gog gmail send --account $GOOGLE_ACCOUNT --thread-id "<thread-id>" --reply-all --body "Reply message"
```

**IMPORTANT**: When replying to emails, always use `--reply-to-message-id` or `--thread-id` to keep the conversation threaded. Use `--reply-all` to automatically populate recipients from the original message.

### 4. Manage Labels

To manage email labels:

```bash
# List all labels
gog gmail labels list --account $GOOGLE_ACCOUNT

# Get label details
gog gmail labels get --account $GOOGLE_ACCOUNT <labelIdOrName>

# Create a new label
gog gmail labels create --account $GOOGLE_ACCOUNT <name>

# Add/remove labels from threads (can operate on multiple threads at once)
gog gmail labels modify --account $GOOGLE_ACCOUNT <threadId> ... --add=<label1>,<label2> --remove=<label3>

# Mark emails as read (remove UNREAD label)
gog gmail labels modify --account $GOOGLE_ACCOUNT <threadId> ... --remove=UNREAD

# Mark emails as unread (add UNREAD label)
gog gmail labels modify --account $GOOGLE_ACCOUNT <threadId> ... --add=UNREAD
```

**Note**: Use thread IDs (not message IDs) for label operations. Thread IDs are returned by `gog gmail search` commands.

### 5. Trash/Delete Emails

To trash or delete emails:

```bash
# Move to trash
gog gmail trash <message-id>

# Permanently delete
gog gmail delete <message-id>
```

## Usage Instructions

When the user requests email operations:

1. **For viewing emails**: Use `gog gmail list` or `gog gmail search` to find messages
2. **For reading emails**: Use `gog gmail read` with the message ID
3. **For sending new emails**: Use `gog gmail send` with appropriate flags
4. **For replying to emails**: Use `gog gmail send` with `--reply-to-message-id` or `--thread-id` and `--reply-all` to keep the conversation threaded
5. **For managing labels**: Use `gog gmail labels` and `gog gmail label` commands

## Common Patterns

### Check inbox
```bash
gog gmail search --account $GOOGLE_ACCOUNT "in:inbox"
```

### Search for emails from a specific sender
```bash
gog gmail search --account $GOOGLE_ACCOUNT "from:sender@example.com"
```

### Send a quick email
```bash
gog gmail send --account $GOOGLE_ACCOUNT --to "recipient@example.com" --subject "Quick update" --body "Here's the update..."
```

### Reply to an email thread
```bash
# Get the message ID from search/list results first
gog gmail search --account $GOOGLE_ACCOUNT "from:sender@example.com"

# Reply to keep it in the same thread
gog gmail send --account $GOOGLE_ACCOUNT --reply-to-message-id "19be12f187273072" --reply-all --body "Thanks for your email..."
```

## Error Handling

If gog is not installed:
```bash
go install github.com/stephenafamo/gog@latest
```

If authentication fails:
```bash
gog gmail init
```

## Tips

- Use natural language queries for searching emails
- Message IDs can be obtained from list/search results
- Labels are case-sensitive
- The tool supports Gmail's search operators (from:, to:, subject:, etc.)
- **Always use `--reply-to-message-id` or `--thread-id` when replying to emails** to keep conversations properly threaded in Gmail
- Use `--reply-all` to automatically include all original recipients (To, CC) in your reply
