# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram e-commerce bot ("Strefa Ruchu") with admin dashboard and group management bot. pnpm monorepo with five workspaces:

- **`apps/bot`** — Telegram e-commerce bot (grammY framework, Hono for webhooks, Pino logging, Valibot config validation). ESM module using tsx runtime.
- **`apps/manager-bot`** — Telegram group management/moderation bot (grammY, Hono, Pino, Valibot). Full moderation suite: warnings, bans, anti-spam, anti-link, CAPTCHA, scheduled messages, keyword filters. ESM module using tsx runtime.
- **`apps/api`** — REST API (NestJS 11, Swagger/OpenAPI, class-validator DTOs). Serves the admin dashboard.
- **`apps/frontend`** — Admin dashboard (Next.js 16 App Router, Radix UI, Tailwind CSS 4). Runs on port 3001.
- **`packages/db`** — Shared database layer (Prisma 7, PostgreSQL). Exports `createPrismaClient()` consumed by bot, manager-bot, and API.

## Common Commands

```bash
# Install dependencies
pnpm install

# Database (PostgreSQL via Docker)
docker compose up -d                    # Start PostgreSQL
pnpm db prisma:migrate                  # Run migrations
pnpm db prisma:push                     # Push schema without migration
pnpm db prisma:studio                   # Open Prisma Studio
pnpm db generate                        # Regenerate Prisma Client

# Development
pnpm bot dev                            # Bot with watch mode (tsc-watch + tsx)
pnpm manager-bot dev                    # Manager bot with watch mode
pnpm api start:dev                      # API with NestJS watch mode
pnpm frontend dev                       # Next.js dev server (port 3001)

# Build
pnpm bot build                          # Compile bot TypeScript
pnpm manager-bot build                  # Compile manager-bot TypeScript
pnpm api build                          # NestJS build
pnpm frontend build                     # Next.js production build
pnpm db build                           # Compile db package

# Lint & Format
pnpm bot lint                           # ESLint (antfu config)
pnpm manager-bot lint                   # ESLint (antfu config)
pnpm api lint                           # ESLint with --fix
pnpm api format                         # Prettier
pnpm frontend lint                      # ESLint

# Type Check
pnpm manager-bot typecheck              # TypeScript type checking

# Test
pnpm api test                           # Jest unit tests (API)
pnpm api test -- --testPathPattern=<pattern>  # Run specific test
pnpm api test:e2e                       # E2E tests (jest-e2e.json config)
pnpm manager-bot test                   # Vitest unit tests
pnpm manager-bot test:integration       # Integration tests (requires INTEGRATION_TESTS_ENABLED)
```

## Architecture

### Path Aliases
Configured in root `tsconfig.base.json`:
- `@tg-allegro/db` → `packages/db/src/index.ts`
- `@tg-allegro/*` → `packages/*/src`

### Database Schema (Prisma)
Eleven models across two domains:

**E-commerce (apps/bot):** **User** (Telegram users with ban/referral tracking), **Category** (self-referential hierarchy via parentId), **Product** (with inventory, pricing, images), **Cart** (one-per-user), **CartItem** (cart-product junction with denormalized product data).

**Group management (apps/manager-bot):** **ManagedGroup** (tracked groups), **GroupConfig** (per-group settings: anti-spam, anti-link, welcome, CAPTCHA, etc.), **GroupMember** (members with roles), **Warning** (with expiry and escalation), **ModerationLog** (audit trail), **ScheduledMessage** (cron-like scheduled messages).

Schema at `packages/db/prisma/schema.prisma`. After schema changes, run `pnpm db generate` to regenerate the client.

### Bot Structure (`apps/bot/src/`)
Feature-based organization under `bot/`:
- `features/` — Command/conversation handlers (welcome, menu, products, profile, admin, language)
- `keyboards/` — Inline/reply keyboard builders
- `callback-data/` — Type-safe callback query data definitions
- `middlewares/` — Session, user-data enrichment, update logging
- `filters/` — Composer filters (is-admin, is-banned)
- `context.ts` — Extended grammY Context type with session, config, logger

Bot supports two modes: **polling** (dev) and **webhook** (prod, via Hono HTTP server). Configured via `BOT_MODE` env var.

i18n locales are in `apps/bot/locales/`.

### Manager Bot Structure (`apps/manager-bot/src/`)
Feature-based organization mirroring `apps/bot`:
- `bot/features/` — Command handlers: moderation (warn/mute/ban/kick), anti-spam, anti-link, welcome, rules, filters, CAPTCHA, deletion, schedule, media-restrict, audit, setup, permissions
- `bot/middlewares/` — Session (chat-keyed), group-data (upsert ManagedGroup+GroupConfig), admin-cache (5-min TTL), update-logger, rate-tracker
- `bot/filters/` — is-group, is-admin, is-moderator
- `bot/helpers/` — permissions (requirePermission), time (duration parsing), logging
- `bot/i18n.ts` — Fluent-based i18n, locales in `locales/en.ftl`
- `repositories/` — GroupRepository, GroupConfigRepository, MemberRepository, WarningRepository, ModerationLogRepository
- `services/` — anti-spam (flood+duplicate detection), admin-cache, moderation (escalation engine), log-channel (forward to private channel), scheduler (scheduled messages)
- `server/` — Hono HTTP server with health endpoint

Supports **polling** (dev) and **webhook** (prod) modes via `BOT_MODE`.

### API Structure (`apps/api/src/`)
Standard NestJS module organization: `users/`, `products/`, `categories/`, `cart/` — each with module, controller, service, and `dto/` directory. `PrismaModule` is global. All endpoints prefixed with `/api/`.

### Frontend Structure (`apps/frontend/src/`)
Next.js App Router. Dashboard pages under `app/dashboard/` for users, products, categories, carts. API client with TypeScript interfaces in `lib/api.ts`. UI components are Radix-based in `components/ui/`.

## Environment Variables

**Required (shared)**: `DATABASE_URL`
**Bot (apps/bot)**: `BOT_TOKEN`, `BOT_MODE` (polling|webhook), `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT`
**Manager Bot (apps/manager-bot)**: `BOT_TOKEN` (separate token), `BOT_MODE` (polling|webhook), `BOT_ADMINS`, `BOT_ALLOWED_UPDATES`, `LOG_LEVEL`, `DEBUG`, `SERVER_HOST`, `SERVER_PORT`
**Frontend**: `NEXT_PUBLIC_API_URL` (default: http://localhost:3000)

Docker Compose provides PostgreSQL on port 5432 (user: postgres, password: postgres, db: strefaruchu_db).

## TypeScript Configuration

Strict mode enabled. Notable flags: `noUncheckedIndexedAccess`, `noImplicitOverride`, `experimentalDecorators` + `emitDecoratorMetadata` (for NestJS). The bot is ESM (`"type": "module"`), API is CommonJS.
