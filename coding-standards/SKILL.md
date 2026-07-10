---
name: coding-standards
description: Ensure the current project has a docs/coding-standards.md checklist and use it to review code against the default stack (Bun, TypeScript, Drizzle, Biome, Bun-workspaces monorepo, red/green TDD) and quality principles — tidiness, separation of concerns, maintainability, stale assumptions, leftover experimental code, and doc drift. Use this skill whenever the user asks to check coding standards, review code quality, "is this tidy", "does this follow our standards", set up a coding standards doc, scaffold a new project's conventions, or before finishing/merging a change.
compatibility: Requires a project with a docs/ directory (created if missing)
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Coding Standards

## Purpose

Give every project a single, shared checklist — `docs/coding-standards.md` — that
an agent (or human) can review code against. The checklist is short and
principle-based so it stays true across languages and frameworks, rather than
rotting into a list of framework-specific rules.

## Behavior

When invoked, do the following in order:

### 1. Ensure the checklist exists

Check whether `docs/coding-standards.md` exists in the current project root.

- **If it exists** → read it and use it as-is. Do not overwrite it; the project
  may have tailored it. Skip to step 2.
- **If it does not exist** → create the `docs/` directory if needed, then copy
  the template from this skill's `assets/coding-standards.md` into
  `docs/coding-standards.md`. Tell the user you created it and where.

The template lives alongside this SKILL.md at `assets/coding-standards.md`.
Resolve its absolute path relative to this file (the skill directory).

### 2. Review against the checklist (when asked to review)

If the user asked you to actually review code — not just set up the doc —
read `docs/coding-standards.md` and evaluate the relevant code (the current
diff, a named file, or the change under discussion) against each bullet.

Report findings grouped by the checklist's principles. For each issue, name the
file and line, state which principle it violates, and suggest the fix. If a
principle is fully satisfied, say so briefly rather than staying silent — the
user wants to know the code was actually checked, not skipped.

Keep the review honest: if something is out of scope or you couldn't verify a
principle (e.g. you didn't run the code), say that plainly instead of implying
a clean pass.
