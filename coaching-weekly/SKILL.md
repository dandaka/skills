---
name: coaching-weekly
description: Weekly structured coaching review. Analyzes daily check-in patterns, scores priority progress, conducts time audit, sets next week's commitments. Logs to knowledge base.
compatibility: Requires knowledge base at ~/projects/knowledge-base
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion, Bash(date*)
---

# Weekly Coaching Review

## Purpose

Deep structured review of the past week. This is where patterns get surfaced, priorities get challenged, and commitments get set. The weekly review is the single most important habit in the system.

## Flow

### Step 1: Load Data

Read ALL daily logs from the past 7 days:
- `~/projects/knowledge-base/coaching/daily/` — all files from this week
- `~/projects/knowledge-base/coaching/priorities.md` — current priorities
- `~/projects/knowledge-base/coaching/weekly/` — last week's review (if exists)
- `~/projects/knowledge-base/profile/goals.md` — quarterly targets
- `~/projects/knowledge-base/profile/constraints.md` — for financial update
- `~/projects/knowledge-base/coaching/meditation-log.md` — meditation consistency

### Step 2: Week Summary Dashboard

Display before questions:

```
━━━ WEEKLY REVIEW: Week [N], [date range] ━━━

CHECK-INS: [X]/7 days completed
MEDITATION: [X]/7 days
AVG ENERGY: [X.X]/5
RUNWAY: [X] months remaining

PRIORITY SCORECARD:
1. [Priority 1] — worked on [X]/7 days
2. [Priority 2] — worked on [X]/7 days
3. [Priority 3] — worked on [X]/7 days

PATTERNS DETECTED:
- [List any patterns from daily log analysis]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Analyze daily logs to compute: days each priority was the focus, average energy, recurring blockers, alignment trend.

### Step 3: Structured Review Questions

Use AskUserQuestion in 3 rounds:

**Round 1: Looking Back**
1. **Wins**: "What moved the needle this week? What are you genuinely proud of?" — Free text
2. **Lessons**: "What did you learn this week — about yourself, your work, or your situation?" — Free text

**Round 2: Priority Assessment**
3. **Priority scoring**: For each of the 3 priorities, ask: "Score your progress on [priority] this week (1-10). Why that score?" — Use scale options 1-10
4. **Priority check**: "Looking at these scores, are the top 3 priorities still right? Or does something need to change?" — Options: Keep as is, Swap one out, Reorder them, Major rethink needed

**Round 3: Next Week**
5. **Commitments**: "Name 3 specific, measurable things you will accomplish next week. Be concrete — 'apply to 10 jobs' not 'work on job search'." — Free text
6. **Time audit**: "Where did your time actually go this week vs where it should have gone? Be honest." — Free text

### Step 4: Coaching Analysis

Based on the full week's data, provide analysis:

**Check-in consistency**: If < 5/7 days → "You completed [X]/7 check-ins. The system only works if you show up. What got in the way?"

**Energy trends**: If average < 3 → "Your average energy was [X]. This isn't sustainable. What's draining you?"

**Priority alignment**: If focus doesn't match priorities for 4+ days → Direct confrontation about the gap.

**Progress stall**: If any priority scored 3 or below for 2 consecutive weeks → "You've scored [priority] at [score] for two weeks straight. Is this still the right priority, or are you avoiding it?"

**Venture scatter**: If daily logs show work on 3+ different ventures → "You worked on [list ventures] this week. That's the scatter pattern. Which ONE moves the needle most?"

**Financial update**: Recalculate runway based on any changes. Compare to last week.

### Step 5: Set Next Week's Priorities

If priorities changed based on the review:
- Update `~/projects/knowledge-base/coaching/priorities.md`
- Log the change with reason in the priority change log

### Step 6: Log

Write the review to `~/projects/knowledge-base/coaching/weekly/YYYY-WXX.md`:

```markdown
# Weekly Review: Week XX (YYYY-MM-DD to YYYY-MM-DD)

## Dashboard
- Check-ins: X/7
- Meditation: X/7
- Avg energy: X.X/5
- Runway: X months

## Wins
[Answer]

## Lessons
[Answer]

## Priority Scores
1. [Priority 1]: X/10 — [reason]
2. [Priority 2]: X/10 — [reason]
3. [Priority 3]: X/10 — [reason]

## Time Audit
[Where time actually went]

## Next Week's Commitments
1. [Specific, measurable commitment]
2. [Specific, measurable commitment]
3. [Specific, measurable commitment]

## Priority Changes
[Any changes made and why, or "No changes"]

## Coaching Notes
[Pattern observations, flags, recommendations]
```

### Step 7: Update Constraints if Needed

If financial situation changed or new patterns emerged:
- Update `~/projects/knowledge-base/profile/constraints.md`

## Tone

- More reflective than daily check-in, but still direct.
- Use data from the week — never generic advice.
- Challenge when patterns emerge. Comfort when there are genuine wins.
- End with clear, actionable next steps — never vague encouragement.
