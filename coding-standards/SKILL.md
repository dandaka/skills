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

Give every project two shared docs an agent (or human) can lean on:

- `docs/coding-standards.md` — a short, principle-based **review checklist**,
  consulted on every review. It stays true across languages and frameworks
  rather than rotting into framework-specific rules.
- `docs/project-setup.md` — the **default stack and layout** (Bun, TypeScript,
  Drizzle, Biome, Bun-workspaces monorepo, `docs/` + `docs/logs/`, red/green
  TDD). This is a one-time bootstrap reference, read when scaffolding a project.

Both are copied from this skill's `assets/` directory. Resolve those paths
relative to this SKILL.md (the skill directory).

## Behavior

When invoked, do the following in order:

### 1. Ensure the docs exist

Check whether `docs/coding-standards.md` and `docs/project-setup.md` exist in
the current project root.

- **If a doc exists** → read it and use it as-is. Do not overwrite it; the
  project may have tailored it.
- **If a doc is missing** → create the `docs/` directory if needed, then copy
  the corresponding template from this skill's `assets/` into `docs/`. Tell the
  user which files you created and where.

When the user is scaffolding/bootstrapping a new project, `docs/project-setup.md`
is the doc that matters; when reviewing code, `docs/coding-standards.md` is.
Seed whichever is missing rather than assuming both are needed every time.

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
