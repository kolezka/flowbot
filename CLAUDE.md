# CLAUDE.md

## Project Overview

Telegram e-commerce bot ("Strefa Ruchu") with admin dashboard, group management bot, visual flow builder, and Trigger.dev background job worker. pnpm monorepo with 8 workspaces, 28 Prisma models, 80+ API endpoints, 35+ dashboard pages, 7 Trigger.dev tasks.

### Workspaces

| Workspace | Stack | Module |
|-----------|-------|--------|
| `apps/bot` | grammY, Hono, Pino, Valibot | ESM (tsx) |
| `apps/manager-bot` | grammY, Hono, Pino, Valibot | ESM (tsx) |
| `apps/trigger` | Trigger.dev v3 | ESM |
| `apps/api` | NestJS 11, Swagger, class-validator | CommonJS |
| `apps/frontend` | Next.js 16, Radix UI, Tailwind CSS 4 | ESM |
| `apps/tg-client` | DEPRECATED — only MTProto auth script | ESM |
| `packages/db` | Prisma 7, PostgreSQL | — |
| `packages/telegram-transport` | GramJS, CircuitBreaker, ActionRunner | ESM |

### Path Aliases (`tsconfig.base.json`)
- `@tg-allegro/db` → `packages/db/src/index.ts`
- `@tg-allegro/*` → `packages/*/src`

## Commands

```bash
pnpm install                            # Install deps
docker compose up -d                    # Start PostgreSQL
pnpm db prisma:migrate                  # Run migrations
pnpm db prisma:push                     # Push schema (no migration)
pnpm db generate                        # Regenerate Prisma Client
pnpm db build                           # Compile db package

# Dev
pnpm bot dev | pnpm manager-bot dev | pnpm api start:dev | pnpm frontend dev | pnpm trigger dev

# Build
pnpm bot build | pnpm manager-bot build | pnpm api build | pnpm frontend build

# Typecheck
pnpm manager-bot typecheck | pnpm trigger typecheck | pnpm telegram-transport typecheck

# Lint
pnpm bot lint | pnpm manager-bot lint | pnpm api lint | pnpm frontend lint
pnpm api format                         # Prettier (API only)

# Test
pnpm api test                           # Jest (135 tests)
pnpm api test -- --testPathPattern=X    # Specific test
pnpm manager-bot test                   # Vitest (73 tests)
pnpm telegram-transport test            # Vitest (24 tests)
pnpm trigger test                       # Vitest

# Trigger.dev
pnpm trigger dev | pnpm trigger deploy
```

## Database Schema

Schema at `packages/db/prisma/schema.prisma`. After changes: `pnpm db generate && pnpm db build`.

**Domains:** E-commerce (User, Category, Product, Cart, CartItem), Group management (ManagedGroup, GroupConfig, GroupMember, Warning, ModerationLog, ScheduledMessage), Cross-app (CrossPostTemplate, OrderEvent, UserIdentity, ReputationScore, BroadcastMessage, GroupAnalyticsSnapshot, ClientLog, ClientSession), Bot Config (BotInstance, BotCommand, BotResponse, BotMenu, BotMenuButton), Flow Engine (FlowDefinition, FlowExecution, FlowVersion), Webhooks (WebhookEndpoint).

## App Structure

**Bot (`apps/bot/src/`):** Feature-based under `bot/` — `features/`, `keyboards/`, `callback-data/`, `middlewares/`, `filters/`, `context.ts`. Polling (dev) / webhook (prod) via `BOT_MODE`. i18n in `locales/`.

**Manager Bot (`apps/manager-bot/src/`):** Mirrors bot structure — `bot/features/` (moderation, anti-spam, CAPTCHA, schedule, crosspost, etc.), `bot/middlewares/`, `repositories/`, `services/`, `server/` (Hono with `/api/send-message`).

**Trigger (`apps/trigger/src/`):** Tasks in `trigger/` (broadcast, order-notification, cross-post, scheduled-message, analytics-snapshot, health-check, flow-execution). Libs in `lib/` (prisma, telegram, manager-bot, flow-engine/).

**API (`apps/api/src/`):** NestJS modules: users, products, categories, cart, broadcast, automation, analytics, moderation, reputation, system, bot-config, tg-client, flows, webhooks, events (EventBus, WsGateway, SSE). All endpoints `/api/`.

**Frontend (`apps/frontend/src/`):** Next.js App Router. Dashboard pages under `app/dashboard/`. API client in `lib/api.ts`. Radix UI components in `components/ui/`. WebSocket in `lib/websocket.tsx`.

## Environment Variables

| App | Required |
|-----|----------|
| Shared | `DATABASE_URL` |
| Bot | `BOT_TOKEN`, `BOT_MODE`, `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT` |
| Manager Bot | `BOT_TOKEN`, `BOT_MODE`, `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT`, `API_SERVER_HOST`, `API_SERVER_PORT` |
| Trigger | `DATABASE_URL`, `TG_CLIENT_API_ID`, `TG_CLIENT_API_HASH`, `TG_CLIENT_SESSION`, `MANAGER_BOT_API_URL` |
| API | `DATABASE_URL`, `PORT`, `FRONTEND_URL` |
| Frontend | `NEXT_PUBLIC_API_URL` |

Docker Compose: PostgreSQL on port 5432 (postgres/postgres/strefaruchu_db).

## TypeScript

Strict mode. `noUncheckedIndexedAccess`, `noImplicitOverride`, `experimentalDecorators` + `emitDecoratorMetadata` (NestJS). Bot is ESM, API is CommonJS.

## Trigger.dev Patterns (Project-Specific)

- Use `@trigger.dev/sdk` v3/v4 API — NEVER `client.defineJob` (v2 deprecated)
- Tasks use `getPrisma()` lazy singleton from `lib/prisma.ts`, not direct import
- Telegram tasks use shared `telegram` queue with concurrency limits
- `triggerAndWait()` returns `Result` with `.ok`/`.output`/`.error` — check `.ok` before accessing `.output`
- Never wrap `triggerAndWait`/`batchTriggerAndWait`/`wait` in `Promise.all`
- Self-hosted at `trigger.raqz.link`
- For full Trigger.dev API reference, use the trigger MCP server (`search_docs`)

### Running Trigger.dev Worker

- **Secret key:** stored in `.trigger-secret-key` file (contains `TRIGGER_SECRET_KEY=...`)
- **Project ref:** `proj_hilpmfmsfxxbgutxovgl` (configured in `apps/trigger/trigger.config.ts`)
- **SDK version:** `@trigger.dev/sdk@3.3.17` — CLI must match, do NOT use `@latest` (currently 4.x, incompatible)
- **Login required:** first run needs `npx trigger.dev@3.3.17 login --api-url https://trigger.raqz.link` (opens browser auth flow)
- **Auth config:** stored in `~/.config/trigger/config.json` after login
- **Start command:**
  ```bash
  TRIGGER_SECRET_KEY=tr_dev_pd7r4ISDoUW36jlJSVLH npx trigger.dev@3.3.17 dev --api-url https://trigger.raqz.link --skip-update-check
  ```
- **Note:** `pnpm trigger dev` uses `npx trigger.dev@latest` which causes version mismatch errors — use the explicit command above instead
