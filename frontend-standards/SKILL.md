---
name: frontend-standards
description: Evidence-based frontend development protocol for matching a Figma source of truth to browser-rendered pixels. Ensures the project has docs/frontend-protocol.md (preflight harness checks, intent intake, measure→causal-chain→live-experiment→commit debugging modes), docs/design-vocabulary.md (shared industry design terms), and scripts/preflight.sh. Use this skill whenever the user asks to set up frontend standards, debug a layout issue, match a design or Figma artboard ("layout is off", "doesn't match the design", "pixel-perfect"), review frontend debugging practice, or when starting frontend work in a project that lacks these docs.
compatibility: Requires a project with a docs/ directory (created if missing). Tooling assumes figma-use CLI (Figma over CDP) and agent-browser or Chrome MCP (browser over CDP) are available.
metadata:
  author: dandaka
  version: "1.0"
---

# Frontend Standards

## Purpose

Frontend work has two directly measurable endpoints: the design source of
truth (Figma, readable via `figma-use` over CDP) and the rendered outcome
(browser, readable via CDP). So layout work is never guesswork — yet agents
default to guess-edit-look loops that burn multi-minute iterations and user
patience. This skill gives every project three artifacts that enforce an
evidence-based loop instead:

- `docs/frontend-protocol.md` — the **working protocol**: preflight harness
  checks, intent intake (agent must reach ~90% understanding before building),
  and debugging modes 0–4 (validate rig → reproduce + measure → causal chain →
  live in-browser experiment → commit + verify).
- `docs/design-vocabulary.md` — **shared design terms** (register, rhythm,
  measure, modular scale, identity lock, departure mode, P0–P3, …) so human
  and agent mean the same thing.
- `scripts/preflight.sh` — a **runnable harness check** (dev server, browser
  CDP, Figma connection) run before any frontend task.

Templates live in this skill's `assets/` directory; resolve paths relative to
this SKILL.md.

## Behavior

When invoked, do the following in order:

### 1. Ensure the artifacts exist

Check for `docs/frontend-protocol.md`, `docs/design-vocabulary.md`, and
`scripts/preflight.sh` in the project root.

- **If a file exists** → read it and use it as-is. Do not overwrite; the
  project may have tailored it.
- **If missing** → create the directory if needed, copy the template from
  `assets/`, and `chmod +x` the script. Tell the user what you created.

**Reference mode:** a project may instead reference this skill's `assets/`
files directly (via its AGENTS.md/CLAUDE.md pointing at
`~/.claude/skills/frontend-standards/assets/`), keeping no local copies. In
that case skip the copy step, read the assets in place, run the preflight as
`bash ~/.claude/skills/frontend-standards/assets/preflight.sh`, and keep
project-specific tailoring (ports, breakpoints, CSS conventions) in the
project's own AGENTS.md.

### 2. Tailor to the project (on first setup)

The templates are project-agnostic. After copying, fill in the project
specifics — ask the user or read the repo for:

- Dev server URL/port (set `DEV_URL` default in `scripts/preflight.sh`).
- Breakpoints and their matching Figma artboards (design widths, node IDs).
- Where fixes belong (the project's CSS architecture: tokens/vars, breakpoint
  blocks, shared components) — record in the project's AGENTS.md/CLAUDE.md.
- Add a short pointer section to AGENTS.md (or CLAUDE.md) marking the protocol
  as mandatory for frontend work, summarizing: preflight before starting,
  intent contract before building, no source edits before a proven live
  experiment, never delegate QA to the user.

### 3. Follow the protocol (when doing frontend work)

Read `docs/frontend-protocol.md` and follow it literally. The load-bearing
rules, in one breath:

1. **Preflight**: verify the harness (dev server + browser CDP; plus Figma if
   comparing to design) before starting. A dead harness blocks the task —
   restore it, never "verify later", never degrade to screenshots as design
   source.
2. **Intent intake**: the burden of understanding is on the agent. Restate
   the request as a measurable intent contract (element + property + current →
   desired value, breakpoint identified). If two readings are plausible, ask a
   targeted question or show a 10-second live CDP mock — before building.
3. **Debug by evidence**: reproduce the symptom under reported conditions;
   produce a numeric Figma-vs-rendered diff (never an impression); write a
   falsifiable causal chain (no chain → research, not edit); prove the fix as
   a live in-browser experiment with a stated predicted measurement; only then
   port to source and re-verify with the same probes against the original
   repro conditions.
4. **Scope guard**: taste-driven changes are *departure mode* (see the
   vocabulary doc) and require explicit user sanction — the design is fixed in
   the source of truth.

Use the terms in `docs/design-vocabulary.md` when naming what's wrong and
what's desired.
