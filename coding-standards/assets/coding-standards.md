# Coding Standards

A short checklist to review code against. Each item is a question — answer it
honestly for the code under review. The goal is code that a new reader (human or
agent) can understand, trust, and safely change.

## Default stack & project structure

New projects start from this stack unless there's a concrete reason to deviate.
When reviewing, treat departures from it as something to justify, not a default.

- **Runtime & language**: [Bun](https://bun.sh) + TypeScript, `strict: true`. Run TS directly with `bun`; use `bun test` as the runner.
- **Package manager**: Bun (never npm/yarn/pnpm).
- **Monorepo**: Bun workspaces (`"workspaces": ["packages/*"]`). Cross-package commands via `bun --filter '@scope/pkg'`. No turborepo/nx unless the graph genuinely needs it. Each package owns its `package.json` and `tsconfig.json`.
- **Database**: Postgres or SQLite via [Drizzle ORM](https://orm.drizzle.team). Schema in `src/schema.ts`, numbered migrations in `drizzle/` (`0007_add_users.sql`), config in `drizzle.config.ts`.
- **Linter & formatter**: [Biome](https://biomejs.dev) (one tool for both) via `biome.json`. Run `biome check --write` on commit (git hook + `lint-staged`). No ESLint/Prettier.
- **Docs**: a `docs/` folder at the repo root for specs, plans, runbooks, research — kebab-case, date-prefixed where it's a dated artifact (`docs/research/2026-06-23-image-ocr-pipeline.md`).
- **Work logs**: a `docs/logs/` folder for dated session/work logs (`docs/logs/2026-07-10-<topic>.md`) — what was done, why, and what's next, so the next session (human or agent) has continuity.
- **Naming**: kebab-case for files and directories (`job-publisher.ts`). Organize by feature (a directory per feature) once a package grows; keep it flat while small.
- **Secrets**: injected at runtime via `infisical run` — never committed.

## Test-driven development (red/green)

Write the test first and watch it fail (red), write the minimum code to pass
(green), then refactor. This keeps behavior specified and prevents dead or
speculative code.

- [ ] Was a failing test written before the implementation (red), then made to pass (green)?
- [ ] Do tests live beside the code they cover (`foo.ts` → `foo.test.ts`), with integration tests named `*.integration.test.ts`?
- [ ] Do the tests actually exercise behavior, not just restate the implementation?

## Stack conformance

- [ ] Does the change use the default stack (Bun, TS, Drizzle, Biome), or is a deviation clearly justified?
- [ ] Does `biome check` pass and does the code follow the repo's naming/layout conventions?

## Tidiness & separation of concerns

- [ ] Is everything tidy — no dead code, commented-out blocks, or debug noise left behind?
- [ ] Does each component/module do one thing, with clear boundaries between them?
- [ ] Is logic in the layer where it belongs (no business rules leaking into UI, no data access mixed into handlers)?

## Understandable & maintainable

- [ ] Would a new reader understand what this does without asking the author?
- [ ] Are names, structure, and flow clear enough to change safely later?
- [ ] Is complexity justified — nothing clever where something simple would do?

## Assumptions

- [ ] Do any assumptions baked into the code still hold (inputs, invariants, external contracts)?
- [ ] Are there hardcoded values or conditions that may no longer be true?

## Leftover code

- [ ] Is anything left over from previous edits or experiments that no longer belongs?
- [ ] Are there unused imports, functions, files, or feature flags that can be removed?

## Documentation

- [ ] Does the documentation (README, comments, docs/) still represent the current state of the code?
- [ ] If behavior changed, were the docs updated to match?
