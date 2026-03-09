# Ralph — Project Mission and Guardrails

## Mission

Implement and maintain the following applications and packages:

1. **`apps/manager-bot`** — Telegram group management and community administration bot (grammY / Bot API). Plans in `docs/plan/mb-*.md`. COMPLETE.
2. **`apps/tg-client`** — DEPRECATED. Code extracted to `packages/telegram-transport`. App being replaced by `apps/trigger`.
3. **`packages/telegram-transport`** — Shared package extracted from tg-client: GramJS transport, ActionRunner, CircuitBreaker, action executors. Imported by `apps/trigger`.
4. **`apps/trigger`** — Trigger.dev v3 worker. All background job task definitions. Connects to self-hosted instance at `trigger.raqz.link`. Design: `docs/plans/2026-03-09-trigger-dev-integration-design.md`.

Apps share `@tg-allegro/db` (Prisma), `@tg-allegro/telegram-transport`, and `@trigger.dev/sdk`. Neither imports from `apps/bot`.

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
- All work under `apps/manager-bot/` (existing, complete)
- All work under `apps/trigger/` (new — Trigger.dev worker)
- All work under `packages/telegram-transport/` (new — extracted from tg-client)
- `apps/api/` — Modifications to trigger tasks from services (broadcast, order events)
- `apps/bot/` — Modifications to trigger tasks (order notifications)
- `apps/frontend/` — Dashboard modifications
- New Prisma models added to `packages/db/prisma/schema.prisma` (additive only)
- Root `package.json` script additions
- Root `tsconfig.json` project reference additions
- `CLAUDE.md` updates

### Out of Scope — DO NOT TOUCH
- `packages/db/src/` — Do not change existing code. Only add new models to the Prisma schema.

### Separation Rules
- `apps/trigger` imports from `@tg-allegro/telegram-transport` and `@tg-allegro/db`
- `apps/api`, `apps/bot`, `apps/manager-bot` trigger tasks via `@trigger.dev/sdk` only — no direct imports from `apps/trigger`
- `packages/telegram-transport` has no app dependencies — only `telegram` (GramJS) and `pino`

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

### packages/telegram-transport Specific
- **Framework**: GramJS (`telegram` npm package) for MTProto
- Transport abstraction: `ITelegramTransport` interface wraps GramJS
- Error classification: FATAL / RATE_LIMITED / AUTH_EXPIRED / RETRYABLE
- Circuit breaker wrapping transport
- ActionRunner with retry/backoff/idempotency
- Action executors: broadcast, order-notification, cross-post, send-message
- Session strings NEVER logged

### apps/trigger Specific
- **Framework**: Trigger.dev v3 SDK
- Self-hosted instance: `trigger.raqz.link`
- Task definitions in `src/trigger/`, lib helpers in `src/lib/`
- Telegram queue: concurrency 1 (GramJS session constraint)
- Ops queue: no concurrency limit (scheduled messages, analytics, health)
- Lazy GramJS singleton initialization on first Telegram task
- Cron tasks for scheduled messages (1min), analytics (daily), health (5min)

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
