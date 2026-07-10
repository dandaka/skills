# Coding Standards

A short checklist to review code against. Each item is a question — answer it
honestly for the code under review. The goal is code that a new reader (human or
agent) can understand, trust, and safely change.

> The default stack and project layout live in `docs/project-setup.md` — that's a
> one-time bootstrap reference. This file is the recurring review checklist.

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
