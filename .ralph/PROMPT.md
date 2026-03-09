# Ralph — Project Mission and Guardrails

## Mission

Implement the `apps/manager-bot` application: a Telegram group management and community administration bot, as defined in the planning documents under `docs/plan/mb-*.md`.

The manager-bot is a NEW grammY-based bot (separate from the existing `apps/bot` sales bot) that handles moderation, anti-spam, welcome flows, warning systems, and administrative commands for Telegram groups/supergroups.

## Source of Truth

All implementation decisions are grounded in these documents (in priority order):

1. **`CLAUDE.md`** — Monorepo conventions, commands, architecture, constraints
2. **`docs/plan/mb-03-architecture.md`** — Architecture proposal, directory structure, middleware stack, DB models, plugin choices
3. **`docs/plan/mb-05-tasks.md`** — Task breakdown with acceptance criteria (31 tasks across 8 phases)
4. **`docs/plan/mb-02-features.md`** — Feature scope and MVP/phase classification
5. **`docs/plan/mb-04-risks.md`** — Risks, assumptions, constraints, open questions
6. **`docs/plan/mb-00-index.md`** — Execution order and key decisions

When in doubt, defer to `CLAUDE.md` for repo-wide conventions and `docs/plan/mb-03-architecture.md` for app-specific architecture.

## Scope Boundaries

### In Scope
- All work under `apps/manager-bot/` (new application)
- New Prisma models added to `packages/db/prisma/schema.prisma` (additive only)
- Root `package.json` script addition (`"manager-bot"` filter)
- Root `tsconfig.json` project reference addition
- `CLAUDE.md` updates reflecting the new app (Task 31)

### Out of Scope — DO NOT TOUCH
- `apps/bot/` — The existing sales bot. Zero code coupling. Never modify.
- `apps/api/` — The NestJS API. Not modified during manager-bot work.
- `apps/frontend/` — The Next.js dashboard. Not modified.
- `packages/db/src/` — Do not change existing code in the db package. Only add new models to the Prisma schema.
- `docs/plan/00-05.md` — The tg-client plans. Unrelated to this effort.

### Separation Rule
The manager-bot must NOT import from `apps/bot`. It shares only:
- `@tg-allegro/db` (Prisma client factory + types)
- `tsconfig.base.json` (TypeScript config)
- Docker Compose PostgreSQL instance

## Implementation Guardrails

### Conventions (from CLAUDE.md)
- **Package manager**: pnpm (workspaces)
- **Module system**: ESM (`"type": "module"`)
- **TypeScript**: Strict mode, extends `../../tsconfig.base.json`
- **Config validation**: Valibot schemas with `process.loadEnvFile()`
- **Logging**: Pino with `pino-pretty` (debug) / `pino/file` (production)
- **Database**: `createPrismaClient()` from `@tg-allegro/db`
- **HTTP server**: Hono (for webhooks and health endpoints)
- **Bot framework**: grammY with Composer-based feature modules
- **Linting**: antfu ESLint config
- **Testing**: Vitest (native ESM)
- **Dev mode**: `tsc-watch --onSuccess "tsx ./src/main.ts"`

### Code Quality Rules
- Follow existing bot patterns (config.ts, logger.ts, database.ts, bot/index.ts, server/)
- All moderation actions must log to `ModerationLog` table
- Anti-spam tracking is in-memory with LRU eviction (no Redis)
- Session is keyed by chat ID (group-scoped), not user ID
- Admin lists are cached with 5-minute TTL + `chat_member` invalidation
- Bot must request `chat_member` in `allowed_updates`
- Fail-fast on invalid config or missing required env vars

### Prisma Schema Rules
- New models are ADDITIVE ONLY to `packages/db/prisma/schema.prisma`
- After schema changes: `pnpm db prisma:migrate` then `pnpm db generate`
- Verify existing apps still compile: `pnpm bot build` and `pnpm api build`

## Execution Strategy

### Phase Order (from mb-00-index.md)
Execute tasks in phase order. Do not skip ahead.

1. **Foundation** (Tasks 01–05): Scaffolding, config, logger, database, Prisma migration
2. **Bot Core** (Tasks 06–09): Context type, bot factory, error handler, server + main
3. **Permission System** (Tasks 10–12): Group data middleware, admin cache, permission filters
4. **Core Moderation** (Tasks 13–17): Warnings, mute/ban/kick, deletion, anti-spam, anti-link
5. **Community Features** (Tasks 18–20): Welcome messages, group config commands, audit log
6. **Post-MVP** (Tasks 21–27): Log channel, rules, filters, media restrictions, scheduling, CAPTCHA, health
7. **Testing & Polish** (Tasks 28–31): Unit tests, integration tests, i18n, docs

### Per-Task Workflow
For each task:
1. Read the task description in `docs/plan/mb-05-tasks.md`
2. Implement according to the implementation notes
3. Run validation commands (lint, typecheck, test if applicable)
4. Verify acceptance criteria are met
5. Move to the next task

### Incremental Validation
After every meaningful change:
- `pnpm manager-bot typecheck` (once package exists)
- `pnpm manager-bot lint`
- `pnpm manager-bot test` (once test infrastructure exists)
- After Prisma changes: `pnpm bot build` and `pnpm api build` to verify no breakage

## Documentation Updates
- Update `CLAUDE.md` as the final task (Task 31)
- Do not modify `docs/plan/` files during implementation
- If a task's acceptance criteria reveal a planning gap, note it but continue with the most reasonable interpretation
