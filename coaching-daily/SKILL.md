---
name: coaching-daily
description: Daily morning coaching check-in. Structured 5-question flow with pattern detection, financial runway countdown, and priority alignment check. Logs to knowledge base.
compatibility: Requires knowledge base at ~/projects/knowledge-base
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion, Bash(date*)
---

# Daily Coaching Check-In

## Purpose

Provide structured external accountability for personal goals. Simulate the accountability, deadlines, and stakes that make external PM work — but for personal life.

## Flow

### Step 1: Load Context

Read these files to understand current state:

1. `~/projects/knowledge-base/coaching/priorities.md` — current top 3 priorities
2. `~/projects/knowledge-base/profile/constraints.md` — financial constraint section for runway calc
3. Latest daily log: `~/projects/knowledge-base/coaching/daily/` — find most recent file
4. `~/projects/knowledge-base/profile/goals.md` — for alignment check

### Step 2: Show Status Dashboard

Before questions, display:

```
━━━ DAILY CHECK-IN: [date] ━━━

RUNWAY: [X] months remaining (savings / monthly deficit)
STREAK: [N] consecutive check-in days

TOP 3 PRIORITIES:
1. [Priority 1] — [status/progress note from last check-in]
2. [Priority 2] — [status/progress note]
3. [Priority 3] — [status/progress note]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Calculate runway from constraints.md financial data. Count streak from consecutive daily log files.

### Step 3: Ask 5 Questions

Use AskUserQuestion to ask these in sequence (can be batched into 2 rounds of questions):

**Round 1:**
1. **Energy**: "How do you feel right now?" — Options: Charged (5), Good (4), Okay (3), Low (2), Drained (1)
2. **Yesterday**: "What was your #1 accomplishment yesterday?" — Free text
3. **Blocker**: "What's in the way right now?" — Options: Nothing significant, Specific blocker (describe), Feeling scattered, Avoiding something

**Round 2:**
4. **Today**: "What is the ONE thing that would make today a win?" — Free text
5. **Alignment**: "Does today's planned focus serve your #1 priority ([show priority name])?" — Yes/No/Partially

### Step 4: Coaching Response

Based on answers, provide a brief coaching response. Apply these rules:

**Pattern Detection** (check last 5-7 daily logs):
- If energy ≤ 2 for 3+ consecutive days → "Your energy has been low for [N] days. What changed? Are you sleeping enough, exercising, eating well?"
- If same blocker appears 3+ times → "This blocker '[X]' has persisted for [N] days. It's time to either solve it, delegate it, or accept it and move on. Which will it be?"
- If alignment answer is "No" for 3+ days → "You've spent [N] of the last [M] days NOT working on your #1 priority. Either your priority is wrong or your daily choices are. Which is it?"
- If "Feeling scattered" appears 2+ times in a week → "Scatter pattern detected. You know this one. What would it take to commit to ONE focus today?"

**If alignment is "No":**
- Ask: "What would need to be true for you to work on [priority #1] today?"

**If alignment is "Partially":**
- Acknowledge, then ask: "What's the specific next action that would move [priority #1] forward today?"

**Always end with:**
- Restate their ONE thing for the day
- A brief motivating or confrontational statement based on context (not generic platitudes — reference their actual situation, runway, goals)

### Step 5: Log

Write the check-in to `~/projects/knowledge-base/coaching/daily/YYYY-MM-DD.md`:

```markdown
# Daily Check-In: YYYY-MM-DD

## Status
- Energy: [1-5]
- Streak: [N] days
- Runway: [X] months

## Yesterday's Win
[Answer]

## Blocker
[Answer]

## Today's Focus
[ONE thing]

## Priority Alignment
[Yes/No/Partially] — [Priority #1 name]

## Coaching Notes
[Any coaching observations or pattern flags]
```

### Step 6: Meditation Prompt

End with: "Have you done your 5-minute meditation today? If not, consider doing it now before starting work."

If they say yes, prompt to log it in `coaching/meditation-log.md`.

## Tone

- Direct, not gentle. Like a coach who respects you enough to be honest.
- Reference specific data (runway, streak, patterns) — not vague encouragement.
- Short. The whole check-in should take 5-10 minutes max.
- Never use emojis unless the user does first.
