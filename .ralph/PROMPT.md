# Ralph — Project Mission and Guardrails

## Mission

Maintain and evolve the tg-allegro monorepo — a Telegram e-commerce platform with admin dashboard, group management bot, visual flow builder, and background job worker.

## Workspaces

| Workspace | Role | Stack |
|-----------|------|-------|
| `apps/bot` | Sales bot | grammY, Hono, ESM |
| `apps/manager-bot` | Group management bot | grammY, Hono, ESM |
| `apps/trigger` | Background jobs | Trigger.dev v3, ESM |
| `apps/api` | REST API | NestJS 11, CommonJS |
| `apps/frontend` | Admin dashboard | Next.js 16, React 19, Radix UI |
| `packages/db` | Database | Prisma 7, PostgreSQL |
| `packages/telegram-transport` | Telegram MTProto | GramJS, CircuitBreaker |

## Source of Truth

1. **`CLAUDE.md`** — Monorepo conventions, commands, architecture (HIGHEST PRIORITY)
2. **`docs/plans/`** — Active design docs and specs
3. **`docs/architecture.md`** — System architecture reference
4. **`docs/flow-builder.md`** — Flow builder documentation

## Scope Boundaries

### Shared Resources
- `packages/db/prisma/schema.prisma` — 28 models, additive changes only
- After Prisma changes: `pnpm db generate && pnpm db build`

### Cross-App Integration
- Apps trigger background jobs via `@trigger.dev/sdk` — no direct imports from `apps/trigger`
- `packages/telegram-transport` imported by `apps/trigger` only
- Trigger.dev self-hosted at `trigger.raqz.link`

## Implementation Guardrails

### Conventions (from CLAUDE.md)
- **Package manager**: pnpm (workspaces)
- **Module system**: ESM for bot/manager-bot/trigger/frontend, CommonJS for API
- **TypeScript**: Strict mode
- **Config validation**: Valibot (bots), class-validator (API)
- **Logging**: Pino
- **Database**: `createPrismaClient()` from `@tg-allegro/db`
- **Testing**: Vitest (bots, trigger, transport), Jest (API), Playwright (frontend E2E)
- **Linting**: antfu ESLint config (bots, trigger), NestJS ESLint (API), Next.js ESLint (frontend)

## Per-Task Workflow

1. Read task description and relevant code
2. Implement according to requirements
3. Run validation: typecheck → lint → test → build
4. Verify acceptance criteria
5. Commit with task ID
