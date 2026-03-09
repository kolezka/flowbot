# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram e-commerce bot ("Strefa Ruchu") with admin dashboard, group management bot, and Trigger.dev background job worker. pnpm monorepo with eight workspaces:

- **`apps/bot`** — Telegram e-commerce bot (grammY framework, Hono for webhooks, Pino logging, Valibot config validation). ESM module using tsx runtime.
- **`apps/manager-bot`** — Telegram group management/moderation bot (grammY, Hono, Pino, Valibot). Full moderation suite: warnings, bans, anti-spam, anti-link, CAPTCHA, scheduled messages, keyword filters. ESM module using tsx runtime.
- **`apps/trigger`** — Trigger.dev v3 worker for background jobs. Defines tasks for broadcast, order notifications, cross-posting, scheduled messages, analytics snapshots, and health checks. Connects to self-hosted Trigger.dev at `trigger.raqz.link`.
- **`apps/api`** — REST API (NestJS 11, Swagger/OpenAPI, class-validator DTOs). Serves the admin dashboard. Triggers Trigger.dev tasks for broadcasts and order notifications.
- **`apps/frontend`** — Admin dashboard (Next.js 16 App Router, Radix UI, Tailwind CSS 4). Runs on port 3001.
- **`apps/tg-client`** — DEPRECATED. Only contains `scripts/authenticate.ts` for interactive MTProto session authentication. Code extracted to `packages/telegram-transport`.
- **`packages/db`** — Shared database layer (Prisma 7, PostgreSQL). Exports `createPrismaClient()` consumed by bot, manager-bot, api, and trigger.
- **`packages/telegram-transport`** — Shared GramJS transport layer extracted from tg-client. Provides `ITelegramTransport`, `GramJsTransport`, `CircuitBreaker`, `ActionRunner`, and action executors.

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
pnpm trigger dev                        # Trigger.dev dev worker

# Build
pnpm bot build                          # Compile bot TypeScript
pnpm manager-bot build                  # Compile manager-bot TypeScript
pnpm api build                          # NestJS build
pnpm frontend build                     # Next.js production build
pnpm db build                           # Compile db package

# Type Check
pnpm manager-bot typecheck              # TypeScript type checking
pnpm trigger typecheck                  # TypeScript type checking
pnpm telegram-transport typecheck       # TypeScript type checking

# Lint & Format
pnpm bot lint                           # ESLint (antfu config)
pnpm manager-bot lint                   # ESLint (antfu config)
pnpm api lint                           # ESLint with --fix
pnpm api format                         # Prettier
pnpm frontend lint                      # ESLint

# Test
pnpm api test                           # Jest unit tests (API)
pnpm api test -- --testPathPattern=<pattern>  # Run specific test
pnpm api test:e2e                       # E2E tests (jest-e2e.json config)
pnpm manager-bot test                   # Vitest unit tests
pnpm manager-bot test:integration       # Integration tests (requires INTEGRATION_TESTS_ENABLED)

# Trigger.dev
pnpm trigger dev                        # Start Trigger.dev dev worker
pnpm trigger deploy                     # Deploy to Trigger.dev instance

# MTProto Authentication
pnpm tg-client authenticate             # Interactive MTProto session authentication
```

## Architecture

### Path Aliases
Configured in root `tsconfig.base.json`:
- `@tg-allegro/db` → `packages/db/src/index.ts`
- `@tg-allegro/*` → `packages/*/src`

### Database Schema (Prisma)
Models across multiple domains:

**E-commerce (apps/bot):** **User** (Telegram users with ban/referral tracking), **Category** (self-referential hierarchy via parentId), **Product** (with inventory, pricing, images), **Cart** (one-per-user), **CartItem** (cart-product junction with denormalized product data).

**Group management (apps/manager-bot):** **ManagedGroup** (tracked groups), **GroupConfig** (per-group settings: anti-spam, anti-link, welcome, CAPTCHA, etc.), **GroupMember** (members with roles), **Warning** (with expiry and escalation), **ModerationLog** (audit trail), **ScheduledMessage** (cron-like scheduled messages).

**Cross-app:** **CrossPostTemplate**, **OrderEvent**, **UserIdentity**, **ReputationScore**, **BroadcastMessage**, **GroupAnalyticsSnapshot**, **ClientLog**, **ClientSession**.

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
- `bot/features/` — Command handlers: moderation (warn/mute/ban/kick), anti-spam, anti-link, welcome, rules, filters, CAPTCHA, deletion, schedule, media-restrict, audit, setup, permissions, crosspost, promote, stats
- `bot/middlewares/` — Session (chat-keyed), group-data (upsert ManagedGroup+GroupConfig), admin-cache (5-min TTL), update-logger, rate-tracker
- `bot/filters/` — is-group, is-admin, is-moderator
- `bot/helpers/` — permissions (requirePermission), time (duration parsing), logging, deeplink
- `bot/i18n.ts` — Fluent-based i18n, locales in `locales/en.ftl`
- `repositories/` — GroupRepository, GroupConfigRepository, MemberRepository, WarningRepository, ModerationLogRepository, CrossPostTemplateRepository, ProductRepository
- `services/` — anti-spam (flood+duplicate detection), admin-cache, moderation (escalation engine), log-channel (forward to private channel), scheduler (scheduled messages), analytics, reputation, ai-classifier
- `server/` — Hono HTTP server with health endpoint and POST `/api/send-message`

Supports **polling** (dev) and **webhook** (prod) modes via `BOT_MODE`. In both modes, an HTTP API server runs for health checks and the send-message endpoint used by Trigger.dev.

### Trigger Worker Structure (`apps/trigger/src/`)
Trigger.dev v3 task definitions:
- `lib/telegram.ts` — Lazy GramJS singleton with CircuitBreaker
- `lib/prisma.ts` — Shared Prisma client
- `lib/manager-bot.ts` — HTTP client for manager-bot send-message endpoint
- `trigger/broadcast.ts` — Broadcast delivery (telegram queue, concurrency: 1)
- `trigger/order-notification.ts` — Order social-proof notifications (telegram queue)
- `trigger/cross-post.ts` — Multi-group cross-posting (telegram queue)
- `trigger/scheduled-message.ts` — Cron every 1 minute, sends due messages via manager-bot
- `trigger/analytics-snapshot.ts` — Cron daily at 2am, aggregates group analytics
- `trigger/health-check.ts` — Cron every 5 minutes, checks DB and manager-bot

### Telegram Transport (`packages/telegram-transport/src/`)
Shared GramJS transport layer:
- `transport/` — `ITelegramTransport` interface, `GramJsTransport`, `FakeTelegramTransport`, `CircuitBreaker`
- `actions/` — `ActionRunner` (retry/backoff/idempotency), action types and executors
- `errors/` — Error classifier (FATAL/RATE_LIMITED/AUTH_EXPIRED/RETRYABLE), exponential backoff

### API Structure (`apps/api/src/`)
Standard NestJS module organization: `users/`, `products/`, `categories/`, `cart/`, `broadcast/`, `automation/`, `analytics/`, `moderation/`, `reputation/`, `system/` — each with module, controller, service, and `dto/` directory. `PrismaModule` is global. All endpoints prefixed with `/api/`. Triggers Trigger.dev tasks via `@trigger.dev/sdk`.

### Frontend Structure (`apps/frontend/src/`)
Next.js App Router. Dashboard pages under `app/dashboard/` for users, products, categories, carts, broadcast, moderation (groups, logs, members, warnings, analytics). API client with TypeScript interfaces in `lib/api.ts`. UI components are Radix-based in `components/ui/`.

## Environment Variables

**Required (shared)**: `DATABASE_URL`
**Bot (apps/bot)**: `BOT_TOKEN`, `BOT_MODE` (polling|webhook), `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT`
**Manager Bot (apps/manager-bot)**: `BOT_TOKEN` (separate token), `BOT_MODE` (polling|webhook), `BOT_ADMINS`, `BOT_ALLOWED_UPDATES`, `LOG_LEVEL`, `DEBUG`, `SERVER_HOST`, `SERVER_PORT`, `TRIGGER_SECRET_KEY` (optional), `TRIGGER_API_URL` (optional), `API_SERVER_HOST` (default 0.0.0.0), `API_SERVER_PORT` (default 3001)
**Trigger (apps/trigger)**: `DATABASE_URL`, `TG_CLIENT_API_ID`, `TG_CLIENT_API_HASH`, `TG_CLIENT_SESSION`, `MANAGER_BOT_API_URL` (default http://localhost:3001), `LOG_LEVEL`
**API (apps/api)**: `DATABASE_URL`, `PORT` (default 3000), `FRONTEND_URL` (default http://localhost:3001), `TRIGGER_SECRET_KEY` (optional), `TRIGGER_API_URL` (optional)
**Frontend**: `NEXT_PUBLIC_API_URL` (default: http://localhost:3000)
**TG Client (authenticate only)**: `TG_CLIENT_API_ID`, `TG_CLIENT_API_HASH`, `TG_CLIENT_SESSION` (optional)

Docker Compose provides PostgreSQL on port 5432 (user: postgres, password: postgres, db: strefaruchu_db).

## TypeScript Configuration

Strict mode enabled. Notable flags: `noUncheckedIndexedAccess`, `noImplicitOverride`, `experimentalDecorators` + `emitDecoratorMetadata` (for NestJS). The bot is ESM (`"type": "module"`), API is CommonJS.
