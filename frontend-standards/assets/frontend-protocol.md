# Frontend Protocol: Preflight, Intent Intake, Layout Debugging

Mandatory for all frontend work in this repo. The source of truth is the
**design** (Figma, read via `figma-use`); the outcome is **browser pixels**
(read via CDP). Both are directly measurable — so layout work is never
guesswork. Reasoning-only CSS edits, "should align now", and handing QA back
to the user are protocol violations.

Use the shared terms in [design-vocabulary.md](design-vocabulary.md) when
naming what's wrong and what's desired — precise vocabulary is part of the
intent contract.

<!-- TAILOR: replace tool names/ports below if this project uses a different
     design source or browser rig. Record breakpoint↔artboard mapping and
     CSS-architecture conventions in AGENTS.md. -->

---

## 1. Preflight — verify the harness before starting

Run **`scripts/preflight.sh`** before any frontend task. Which checks must
pass depends on the task:

| Task involves… | Required live | Check |
|---|---|---|
| Any frontend change | Dev server + browser CDP | `scripts/preflight.sh dev browser` |
| Comparing/matching layout to design | + Figma connection | `scripts/preflight.sh` (all) |

Rules:

- **A dead harness blocks the task.** Do not start editing "and verify later" —
  committing layout CSS that was never rendered has directly caused
  "layout is very off" recovery sessions. Restoring the rig is part of the task.
- If Figma is down, the script prints the relaunch command
  (`open -a Figma --args --remote-debugging-port=9222`). If it stays down, tell
  the user — **never** degrade to working from screenshots as design source.
- If Chrome MCP is unavailable, `agent-browser` is the standard fallback; raw
  CDP only when both fail.
- Preflight passing means *reachable*, not *valid* — measurement validity
  (viewport asserted, tab pinned, serve fresh) is Mode 0 below.

## 2. Intent intake — understand before you build

**The burden of understanding is on the agent, not the user.** The user will
not ask "is everything clear?" — it is your job to detect and close the gap.
Misread intent costs multi-minute build-show-frustrate cycles; a clarifying
exchange costs seconds. Target ≥90% confidence before building, not 40%.

Before any build/fix that came from a human report (especially screenshots):

1. **Locate the report precisely.** Which page/component, which breakpoint?
   If a screenshot is given, derive the viewport from its dimensions and match
   it to the design artboard. Screenshots of the wrong page or a hijacked tab
   have derailed sessions before — confirm what you're looking at.
2. **Restate the intent in measurable terms** — an *intent contract*:
   - current state: "subtitle renders at y=581 at 390px width"
   - desired state: "y=552, matching Figma node <id>"
   - out of scope: what you will NOT change (adjacent design decisions)
   Every vague word in the report ("off", "not aligned", "too big", "weird")
   must be resolved to an element + property + direction before building.
3. **Gate on confidence.** If you cannot state the contract, or there are ≥2
   plausible readings of the request, ask **targeted** questions with concrete
   options — never generic "can you clarify?". For bug reports, always
   establish reproduction conditions: every time or intermittent?
   scroll-dependent? does refresh fix it?
4. **Cheap preview for design-level ambiguity.** When the ambiguity is about
   *desired look* rather than facts, mock the change live via CDP (Mode 3
   below), screenshot it, and show the user — a 10-second live mock beats a
   multi-minute build of the wrong thing.
5. **Acceptance criteria before building.** Write down the observable checks
   that will prove the task done (e.g. "rect.y == 552±1 at 390px; visual match
   to exported artboard PNG"). These are the same probes you re-run in Mode 4.

Trivial, unambiguous requests need only a one-line restatement in your reply —
the point is calibrated confidence, not ceremony.

## 3. Layout Debugging Protocol (evidence-based)

Follow the modes **in order**; do not skip ahead to editing source.

### Mode 0 — Rig validity (before trusting any measurement)

A silently-wrong measurement is worse than none (sessions have measured
"mobile" at a desktop viewport because a flag no-op'd). Before measuring:

1. **Browser pinned.** Create/pin a dedicated tab by CDP `targetId` — the
   active-tab fallback gets hijacked by the user's browsing.
2. **Viewport asserted.** Set device metrics (CDP
   `Emulation.setDeviceMetricsOverride` or `agent-browser set viewport`), then
   **assert** `window.innerWidth` matches the target breakpoint. Never assume.
3. **Serve freshness.** After rapid edits, HMR can wedge. If a render looks
   inexplicably wrong, `curl` the served HTML/CSS to separate "server is
   stale" from "CSS is wrong" from "wrong tab".
4. **Tool syntax.** Don't guess CLI flags — run `--help` (or
   `agent-browser skills get core`) once instead of burning round-trips on
   invented commands.

### Mode 1 — Reproduce, then measure

1. **Reproduce the reported symptom yourself, under the reported conditions,
   before theorizing.** Agents have built rigorous fixes against deterministic
   repros while the real bug was a scroll-dependent race — "fixed and
   verified" on scenarios that were never broken. If the symptom is
   intermittent, your repro must exhibit the broken frame at least once before
   you continue.
2. **Produce a numeric diff, not an impression.** "Looks too low" is not a
   debuggable state. Build a table: design value (via `figma-use eval` — node
   x/y/w/h, `getRangeFontSize`, `getStyledTextSegments`; never eyeball a
   screenshot) vs. rendered value (via `getBoundingClientRect` /
   `getComputedStyle` in the page) vs. delta. For visual acceptance,
   `figma-use export node <id> --format PNG` and view it next to a browser
   screenshot — but screenshots are the acceptance check, not the measuring
   instrument.
3. **Read resolved values, not source CSS.** Example of the payoff: dumping
   `getComputedStyle(el).gridTemplateColumns` exposed an implicit 10px grid
   track that no amount of source reading could show. Prefer computed styles,
   resolved tracks, actual rects; when the mechanism lives in a dependency,
   read its source in `node_modules`.
4. **Falsify cheap hypotheses by measurement.** Measuring can also *clear*
   suspects (e.g. `document.createRange()` proving line-wrapping already
   matches the design — no edit needed). An eliminated cause is progress.

### Mode 2 — Causal chain (no chain → research, not edit)

Before any change, write the chain explicitly:

> wrong pixels ← wrong computed value (which property, which element) ← winning
> CSS rule / JS / render mechanism ← why it produces that number

as a **falsifiable sentence** ("the 29px offset comes from the translate var
applied twice"). If you cannot complete the chain, the next step is research
(inspect containing block / stacking context, read the layout algorithm, read
dependency source) — not an exploratory source edit.

### Mode 3 — Live experiment (in-browser, zero source edits)

Prove the fix in the live DOM before touching source — it's sub-second per
iteration and cannot corrupt the codebase:

- Apply the candidate change via CDP evaluate: `el.style.x = …`, inject a
  `<style>` override, toggle a class, poke runtime objects (e.g. three.js /
  canvas layers) where the mechanism isn't CSS.
- **State the predicted measurement first** ("after this, rect.y reads 552±1"),
  apply, re-run the same probe. Prediction wrong → the *model* is wrong: reload
  to reset and return to Mode 2. Never stack a second guess on a failed one.
- Change **one variable at a time**; reload whenever page state gets muddy.
- Loop here until a live change provably produces the target numbers.

Where live tweaks can't reach (build-time structure, framework props), fall
back to source edits — but only with the Mode 2 chain written down and an
explicit prediction.

### Mode 4 — Commit to source & verify

1. Port the **proven** change to the right home per the project's conventions
   (design tokens/vars, the correct breakpoint block, the shared component —
   not a raw override where the experiment happened to work).
2. Fresh-load and re-run the *same probes*: the source edit must reproduce the
   live-experiment numbers (catches wrong-breakpoint edits and HMR staleness).
3. **Verify against the original repro conditions and the acceptance criteria
   from intent intake** — including the intermittent/scroll path if that's how
   it was reported. Only then say it's fixed; never write "fixed and verified"
   for scenarios that were already passing.
4. **Never ship unrendered, and never delegate QA to the user** ("please check
   in the browser") — you have the instruments.

## 4. Scope guard

Fixing a mismatch must not smuggle in a design decision. If the fix changes
visible design (column proportions, element placement), it is **departure
mode**: stop and ask before implementing — requirement churn from unsanctioned
redesigns has cost more rounds than any CSS bug.
