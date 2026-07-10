# Coding Standards

A short checklist to review code against. Each item is a question — answer it
honestly for the code under review. The goal is code that a new reader (human or
agent) can understand, trust, and safely change.

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
