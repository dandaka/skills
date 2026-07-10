# Project Setup — Default Stack & Structure

The default stack and layout for a **new** project. This is a bootstrap
reference — read it once when scaffolding a project, not on every review. Start
here unless there's a concrete reason to deviate.

- **Runtime & language**: [Bun](https://bun.sh) + TypeScript, `strict: true`. Run TS directly with `bun`; use `bun test` as the runner.
- **Package manager**: Bun (never npm/yarn/pnpm).
- **Monorepo**: Bun workspaces (`"workspaces": ["packages/*"]`). Cross-package commands via `bun --filter '@scope/pkg'`. No turborepo/nx unless the graph genuinely needs it. Each package owns its `package.json` and `tsconfig.json`.
- **Database**: Postgres or SQLite via [Drizzle ORM](https://orm.drizzle.team). Schema in `src/schema.ts`, numbered migrations in `drizzle/` (`0007_add_users.sql`), config in `drizzle.config.ts`.
- **Linter & formatter**: [Biome](https://biomejs.dev) (one tool for both) via `biome.json`. Run `biome check --write` on commit (git hook + `lint-staged`). No ESLint/Prettier.
- **Docs**: a `docs/` folder at the repo root for specs, plans, runbooks, research — kebab-case, date-prefixed where it's a dated artifact (`docs/research/2026-06-23-image-ocr-pipeline.md`).
- **Work logs**: a `docs/logs/` folder for dated session/work logs (`docs/logs/2026-07-10-<topic>.md`) — what was done, why, and what's next, so the next session (human or agent) has continuity.
- **Naming**: kebab-case for files and directories (`job-publisher.ts`). Organize by feature (a directory per feature) once a package grows; keep it flat while small.
- **Testing**: red/green TDD — colocated `foo.ts` → `foo.test.ts`, integration tests named `*.integration.test.ts`. See `coding-standards.md` for the review checklist.
- **Secrets**: injected at runtime via `infisical run` — never committed.
