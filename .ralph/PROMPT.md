# Ralph — Project Mission and Guardrails

## Mission

Implement two new applications in this monorepo:

1. **`apps/manager-bot`** — Telegram group management and community administration bot (grammY / Bot API). Plans in `docs/plan/mb-*.md`.
2. **`apps/tg-client`** — Telegram MTProto client for automation (GramJS). Plans in `docs/plan/00-05.md`.

Both are independent apps sharing only the `@tg-allegro/db` Prisma layer and root monorepo config. Neither imports from the other or from `apps/bot`.

## Execution Order

**manager-bot first, then tg-client.** Rationale:
- manager-bot uses grammY (same framework as existing bot) — lower risk, more reusable patterns
- tg-client depends on GramJS (new dependency) and requires interactive MTProto auth — higher setup friction
- Both add models to the shared Prisma schema — manager-bot's migration runs first, tg-client's builds on it

Within each app, follow the phase order defined in the plan index docs.

## Source of Truth

All decisions are grounded in these documents (priority order):

1. **`CLAUDE.md`** — Monorepo conventions, commands, architecture (HIGHEST PRIORITY)
2. Plan docs per app:
   - **manager-bot**: `docs/plan/mb-03-architecture.md` (architecture), `mb-05-tasks.md` (tasks), `mb-02-features.md` (scope), `mb-04-risks.md` (risks), `mb-00-index.md` (execution order)
   - **tg-client**: `docs/plan/02-architecture.md` (architecture), `05-tasks.md` (tasks), `03-integration.md` (integration), `04-reliability.md` (reliability), `00-index.md` (execution order)

When in doubt, defer to `CLAUDE.md` for repo-wide conventions and the respective architecture doc for app-specific decisions.

## Scope Boundaries

### In Scope
- All work under `apps/manager-bot/` (new app)
- All work under `apps/tg-client/` (new app)
- New Prisma models added to `packages/db/prisma/schema.prisma` (additive only)
- Root `package.json` script additions (`"manager-bot"` and `"tg-client"` filters)
- Root `tsconfig.json` project reference additions
- `CLAUDE.md` updates reflecting both new apps (final tasks)
- `*.session` added to `.gitignore`

### Out of Scope — DO NOT TOUCH
- `apps/bot/` — The existing sales bot. Zero code coupling. Never modify.
- `apps/api/` — The NestJS API. Not modified (except Task TC-19 which is docs-only).
- `apps/frontend/` — The Next.js dashboard. Not modified.
- `packages/db/src/` — Do not change existing code. Only add new models to the Prisma schema.

### Separation Rules
- `apps/manager-bot` must NOT import from `apps/bot` or `apps/tg-client`
- `apps/tg-client` must NOT import from `apps/bot` or `apps/manager-bot`
- Both share only: `@tg-allegro/db`, `tsconfig.base.json`, Docker Compose PostgreSQL

## Implementation Guardrails

### Conventions (from CLAUDE.md)
- **Package manager**: pnpm (workspaces)
- **Module system**: ESM (`"type": "module"`) for both apps
- **TypeScript**: Strict mode, extends `../../tsconfig.base.json`
- **Config validation**: Valibot schemas with `process.loadEnvFile()`
- **Logging**: Pino with `pino-pretty` (debug) / `pino/file` (production)
- **Database**: `createPrismaClient()` from `@tg-allegro/db`
- **HTTP server**: Hono (webhooks for manager-bot, health for both)
- **Linting**: antfu ESLint config
- **Testing**: Vitest (native ESM)
- **Dev mode**: `tsc-watch --onSuccess "tsx ./src/main.ts"`

### manager-bot Specific
- **Framework**: grammY with Composer-based feature modules
- All moderation actions must log to `ModerationLog` table
- Anti-spam tracking is in-memory with LRU eviction (no Redis)
- Session keyed by chat ID (group-scoped), not user ID
- Admin lists cached with 5-minute TTL + `chat_member` invalidation
- Bot must request `chat_member` in `allowed_updates`

### tg-client Specific
- **Framework**: GramJS (`telegram` npm package) for MTProto
- Transport abstraction: `ITelegramTransport` interface wraps GramJS
- Session management: interactive `authenticate` script for first-time auth, string session in env var
- Database-backed job queue (AutomationJob table) for cross-app communication
- Error classification: FATAL / RATE_LIMITED / AUTH_EXPIRED / RETRYABLE
- Circuit breaker wrapping transport
- Session strings NEVER logged (Pino `redact` config)
- Serial job execution for rate limit safety

### Prisma Schema Rules (Both Apps)
- New models are ADDITIVE ONLY to `packages/db/prisma/schema.prisma`
- After schema changes: `pnpm db prisma:migrate` then `pnpm db generate`
- Verify existing apps still compile: `pnpm bot build` and `pnpm api build`

## Per-Task Workflow

For each task:
1. Read the task description in the relevant tasks doc
2. Implement according to the implementation notes
3. Run validation commands (lint, typecheck, test if applicable)
4. Verify acceptance criteria are met
5. Move to the next task

### Incremental Validation
After every meaningful change:
- `pnpm <app> typecheck` (once package exists)
- `pnpm <app> lint`
- `pnpm <app> test` (once test infrastructure exists)
- After Prisma changes: `pnpm bot build` and `pnpm api build`

## Documentation Updates
- Update `CLAUDE.md` as final task of each app
- Do not modify `docs/plan/` files during implementation
- If a task's acceptance criteria reveal a planning gap, note it and continue with the most reasonable interpretation
