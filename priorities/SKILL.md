---
name: priorities
description: View or update current top 3 priorities. Quick access to what matters most right now.
compatibility: Requires knowledge base at ~/projects/knowledge-base
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Read, Write, Edit, AskUserQuestion
---

# Priorities Manager

## Purpose

Quick access to view, update, or challenge current priorities. Enforces the hard limit of 3.

## Flow

### View Mode (default)

Read and display `~/projects/knowledge-base/coaching/priorities.md`.

Show current priorities with their status, definition of done, and weekly measures.

Also show the financial runway from `~/projects/knowledge-base/profile/constraints.md`.

### Update Mode (when user wants to change priorities)

1. Show current priorities
2. Ask what they want to change
3. **Enforce the rule**: Maximum 3 active priorities. Adding a 4th requires explicitly removing one.
4. For any change, ask: "Why this change? What happened?"
5. Update `coaching/priorities.md` with the change
6. Add entry to the Priority Change Log at the bottom of the file

### Challenge Mode (when user seems scattered)

If the user is asking about priorities frequently or seems uncertain:
- "You're questioning your priorities again. Last time you set them was [date]. What changed?"
- "Is this a genuine reassessment or are you avoiding the hard work on your current priorities?"

## Rules

- NEVER allow more than 3 active priorities
- Every change must have a logged reason
- Changes should be rare (weekly, not daily). If changing more than once a week, flag it.
