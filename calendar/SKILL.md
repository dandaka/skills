---
name: calendar
description: Manage Google Calendar events using gog. View upcoming events, create new events, update events, add attendees, and manage calendar entries. Use when the user needs to check their schedule, add calendar events, or work with Google Calendar.
compatibility: Requires gog (Google OAuth CLI tool)
metadata:
  author: dandaka
  version: "2.0"
allowed-tools: Bash(gog*)
---

# Google Calendar Manager

This skill provides Google Calendar management capabilities using the `gog` command-line tool.

## Prerequisites

Before using this skill, ensure gog is installed and authenticated:

```bash
# Install gog (if not already installed)
# Follow instructions at: https://github.com/googleworkspace/gam

# Authenticate with your Google account
gog auth add
```

The first time you run gog, it will guide you through OAuth authentication.

## User's Configuration

**Primary Account:** set via `GOOGLE_ACCOUNT` in `~/.claude/.env`

**Default Calendar ID:** same as primary account email (primary calendar)

**Timezone:** Europe/Lisbon (WET/WEST). Use `+00:00` in winter (last Sunday of October to last Sunday of March) and `+01:00` in summer (WEST). When in doubt, use `+00:00` for Lisbon local times.

**IMPORTANT:** Always specify `--account "$GOOGLE_ACCOUNT"` in all gog commands to avoid authentication errors. Read `GOOGLE_ACCOUNT` from `~/.claude/.env`.

## Core Capabilities

### 1. View Upcoming Events

**Default command for listing events:**
```bash
gog calendar events --account "$GOOGLE_ACCOUNT"
```

**Time range examples:**

```bash
# List all upcoming events (default)
gog calendar events --account "$GOOGLE_ACCOUNT"

# List events from a specific calendar
gog calendar events "$GOOGLE_ACCOUNT" --account "$GOOGLE_ACCOUNT"

# Get JSON output for parsing
gog calendar events --account "$GOOGLE_ACCOUNT" --json
```

**Get a specific event:**
```bash
gog calendar event "$GOOGLE_ACCOUNT" "<eventId>" --account "$GOOGLE_ACCOUNT"
```

### 2. Create Events

To create a new event:

```bash
gog calendar create "$GOOGLE_ACCOUNT" --summary "Event Title" --from "2026-01-30T14:00:00Z" --to "2026-01-30T15:00:00Z" --account "$GOOGLE_ACCOUNT"
```

Parameters:
- First argument: Calendar ID (usually "$GOOGLE_ACCOUNT")
- `--summary`: Event title (required)
- `--from`: Start time in RFC3339 format (required)
- `--to`: End time in RFC3339 format (required)
- `--description`: Event description (optional)
- `--location`: Event location (optional)
- `--attendees`: Comma-separated attendee emails (optional)
- `--account`: Account email (required)

Examples:

```bash
# Simple event
gog calendar create "$GOOGLE_ACCOUNT" --summary "Team Meeting" --from "2026-01-30T10:00:00Z" --to "2026-01-30T11:00:00Z" --account "$GOOGLE_ACCOUNT"

# Event with location and description
gog calendar create "$GOOGLE_ACCOUNT" --summary "Client Call" --from "2026-01-30T14:00:00Z" --to "2026-01-30T14:30:00Z" --description "Discuss Q1 roadmap" --location "Zoom" --account "$GOOGLE_ACCOUNT"

# Event with attendees
gog calendar create "$GOOGLE_ACCOUNT" --summary "Planning Meeting" --from "2026-01-30T15:00:00Z" --to "2026-01-30T16:00:00Z" --attendees "person1@gmail.com,person2@gmail.com" --account "$GOOGLE_ACCOUNT"

# All-day event (use date-only format with --all-day flag)
gog calendar create "$GOOGLE_ACCOUNT" --summary "Conference" --from "2026-02-01T00:00:00Z" --to "2026-02-02T00:00:00Z" --location "San Francisco" --all-day --account "$GOOGLE_ACCOUNT"
```

**Note:** Times must be in RFC3339 format (e.g., "2026-01-30T14:00:00Z" for UTC, or "2026-01-30T14:00:00+01:00" for timezone-specific).

### 3. Update Events

To update an existing event:

```bash
gog calendar update "$GOOGLE_ACCOUNT" "<eventId>" --summary "New Title" --account "$GOOGLE_ACCOUNT"
```

**Common update operations:**

```bash
# Update event title
gog calendar update "$GOOGLE_ACCOUNT" "<eventId>" --summary "New Title" --account "$GOOGLE_ACCOUNT"

# Update time
gog calendar update "$GOOGLE_ACCOUNT" "<eventId>" --from "2026-01-30T15:00:00Z" --to "2026-01-30T16:00:00Z" --account "$GOOGLE_ACCOUNT"

# Add attendees (preserves existing)
gog calendar update "$GOOGLE_ACCOUNT" "<eventId>" --add-attendee "new@gmail.com" --account "$GOOGLE_ACCOUNT"

# Replace all attendees
gog calendar update "$GOOGLE_ACCOUNT" "<eventId>" --attendees "person1@gmail.com,person2@gmail.com" --account "$GOOGLE_ACCOUNT"

# Update location
gog calendar update "$GOOGLE_ACCOUNT" "<eventId>" --location "New Location" --account "$GOOGLE_ACCOUNT"

# Update description
gog calendar update "$GOOGLE_ACCOUNT" "<eventId>" --description "New description" --account "$GOOGLE_ACCOUNT"
```

### 4. Search Events

To search for specific events:

```bash
gog calendar search "meeting" --account "$GOOGLE_ACCOUNT" --json
```

**Search options:**
- Use `--json` flag for structured output that's easier to parse
- Search query can include event title, description, or location text

### 5. Delete Events

To delete an event:

```bash
# Delete by event ID
gog calendar delete "$GOOGLE_ACCOUNT" "<eventId>" --account "$GOOGLE_ACCOUNT"

# Use --force to skip confirmation
gog calendar delete "$GOOGLE_ACCOUNT" "<eventId>" --account "$GOOGLE_ACCOUNT" --force
```

**Workflow:**
1. Search for the event to get its ID: `gog calendar search "Event Title" --account "$GOOGLE_ACCOUNT" --json`
2. Delete using the event ID from search results

## Usage Instructions

When the user requests calendar operations:

1. **For viewing upcoming events**:
   - Use `gog calendar events --account "$GOOGLE_ACCOUNT"`
   - Add `--json` flag for structured output that's easier to parse
   - Default command: `gog calendar events --account "$GOOGLE_ACCOUNT" --json`

2. **For creating events**:
   - Use `gog calendar create "$GOOGLE_ACCOUNT"` with required time parameters
   - Always specify `--account "$GOOGLE_ACCOUNT"`
   - Times must be in RFC3339 format (e.g., "2026-01-30T14:00:00Z")
   - To add attendees during creation, use `--attendees "email1@gmail.com,email2@gmail.com"`

3. **For updating events**:
   - First, get the event ID using search or events list
   - Use `gog calendar update "$GOOGLE_ACCOUNT" "<eventId>"` with fields to update
   - Use `--add-attendee` to preserve existing attendees when adding new ones
   - Use `--attendees` to replace all attendees

4. **For searching**:
   - Use `gog calendar search "query" --account "$GOOGLE_ACCOUNT" --json`
   - Always use `--json` flag for easier parsing of results

5. **For deleting**:
   - First search for the event to get its ID
   - Use `gog calendar delete "$GOOGLE_ACCOUNT" "<eventId>" --account "$GOOGLE_ACCOUNT"`

**CRITICAL:**
- ALWAYS include `--account "$GOOGLE_ACCOUNT"` in all commands
- When parsing dates/times from user input, convert to RFC3339 format
- Use `--json` flag when you need to parse output programmatically

## Common Patterns

### Check upcoming schedule
```bash
# List all upcoming events with details
gog calendar events --account "$GOOGLE_ACCOUNT" --json

# Get events from a specific calendar
gog calendar events "$GOOGLE_ACCOUNT" --account "$GOOGLE_ACCOUNT" --json
```

### Create a meeting with attendees
```bash
# Create event and invite attendees
gog calendar create "$GOOGLE_ACCOUNT" \
  --summary "Project Review" \
  --from "2026-01-30T14:00:00Z" \
  --to "2026-01-30T15:30:00Z" \
  --location "Conference Room A" \
  --attendees "person1@gmail.com,person2@gmail.com" \
  --account "$GOOGLE_ACCOUNT"
```

### Add attendee to existing event
```bash
# Search for event first
gog calendar search "Project Review" --account "$GOOGLE_ACCOUNT" --json

# Add attendee (preserves existing attendees)
gog calendar update "$GOOGLE_ACCOUNT" "<eventId>" \
  --add-attendee "newperson@gmail.com" \
  --account "$GOOGLE_ACCOUNT"
```

## Error Handling

If gog is not installed:
```bash
# Follow installation instructions at the gog repository
# https://github.com/googleworkspace/gam
```

If you get "missing --account" error:
```bash
# Always include --account flag
gog calendar events --account "$GOOGLE_ACCOUNT"
```

If authentication fails:
```bash
# Add/refresh authentication
gog auth add
gog auth manage
```

## Tips

- **ALWAYS specify --account** - Include `--account "$GOOGLE_ACCOUNT"` in all commands to avoid authentication errors
- **Use --json for parsing** - When you need to parse output, use `--json` flag for structured data
- **RFC3339 time format** - Times must be in RFC3339 format: "2026-01-30T14:00:00Z" (UTC) or "2026-01-30T14:00:00+01:00" (with timezone)
- **Add vs Replace attendees**:
  - Use `--add-attendee` to preserve existing attendees when adding new ones
  - Use `--attendees` to replace all attendees with a new list
- **Search before update/delete** - Always search for events first to get their event IDs
- **Event IDs** - Event IDs are returned in search results and event listings as the `id` field
- **Calendar IDs** - For most operations, use "$GOOGLE_ACCOUNT" as the calendar ID (primary calendar)
