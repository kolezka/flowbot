# 01 — Repository Discovery

## Monorepo Structure

pnpm monorepo ("flowbot") with four workspaces:

| Workspace | Package | Type | Framework | Purpose |
|-----------|---------|------|-----------|---------|
| `apps/bot` | `@flowbot/bot` | ESM | grammY, Hono, Pino, Valibot | Telegram e-commerce bot |
| `apps/api` | `@flowbot/api` | CJS | NestJS 11, Swagger | REST API + admin backend |
| `apps/frontend` | `@flowbot/frontend` | ESM | Next.js 16, Radix UI, Tailwind | Admin dashboard |
| `packages/db` | `@flowbot/db` | ESM | Prisma 7, PostgreSQL | Shared database layer |

`pnpm-workspace.yaml` also declares `workers/*` but the directory does not exist — placeholder for future use.

## Package Manager & Build System

- **pnpm** with workspace protocol
- Root `package.json` defines filter shortcuts: `pnpm bot dev`, `pnpm api start:dev`, etc.
- Root `tsconfig.base.json` shared by all workspaces: ESNext target, strict mode, `experimentalDecorators` + `emitDecoratorMetadata` (NestJS), `noUncheckedIndexedAccess`
- Path aliases: `@flowbot/db` → `packages/db/src/index.ts`, `@flowbot/*` → `packages/*/src`
- Docker Compose: PostgreSQL 18 Alpine on port 5432

## Bot App Conventions (Reference for New App)

The bot establishes the patterns the new app should follow:

### Entry Point (`src/main.ts`)
- Dual-mode: polling (dev) vs webhook (prod) via `BOT_MODE` env var
- Graceful shutdown on SIGINT/SIGTERM
- Config loaded first, then bot created, then mode-specific startup

### Configuration (`src/config.ts`)
- Valibot schemas with discriminated union (polling vs webhook config)
- `process.loadEnvFile()` for `.env` loading
- SNAKE_CASE env vars auto-converted to camelCase
- Fails fast on invalid config with structured error

### Logging (`src/logger.ts`)
- Pino with `pino-pretty` in debug mode, `pino/file` in production
- Child loggers scoped per-operation (e.g., `logger.child({ update_id })`)

### Database (`src/database.ts`)
- Two-line singleton: `import { createPrismaClient } from '@flowbot/db'` → `export const prismaClient = createPrismaClient(config.databaseUrl)`

### Bot Structure
- Feature-based organization: `src/bot/features/` with Composer instances
- Adapters: transform external data to internal DTOs
- Repositories: data access layer over Prisma
- Middlewares: session, user enrichment, logging
- Filters: boolean predicates for update routing
- Callback data: type-safe callback query packing via `callback-data` library
- Error boundary: `bot.errorBoundary()` with structured logging

### Dev Workflow
- `tsc-watch --onSuccess "tsx ./src/main.ts"` — type-check + auto-restart
- ESLint with antfu config
- No tests in bot (API has Jest)

## Database Schema

Five models: User, Category, Product, Cart, CartItem. Relevant to the new app:
- **User**: has `telegramId` (BigInt), could be referenced by automation targets
- Schema at `packages/db/prisma/schema.prisma`

## What's Missing

- No CI/CD pipelines
- No ADR/RFC convention
- No docs/ directory (until now)
- No deployment configuration
- Bot has no test infrastructure

## Assumptions

1. The new app follows bot conventions (ESM, Valibot, Pino, same dev workflow)
2. `@flowbot/db` is the single source of truth for database access
3. New Prisma models can be added to the shared schema
4. The new app gets its own bot token / Telegram credentials
5. Docker Compose additions are acceptable for new services if needed

## Risks / Unknowns

1. MTProto client libraries have varying quality in the Node.js ecosystem
2. Telegram client session management is fundamentally different from bot tokens
3. Telegram client API rate limits are undocumented and dynamically enforced
4. Account safety: automated MTProto usage can trigger account bans
5. No existing test infrastructure in the bot to reference — testing patterns must be established
