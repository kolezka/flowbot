# CLAUDE.md

## Project Overview

Multi-platform bot management platform ("Flowbot") with admin dashboard, group management bots (Telegram, Discord, WhatsApp, and more), visual flow builder, and Trigger.dev background job worker. pnpm monorepo with 13 workspaces, 35+ Prisma models, 130+ API endpoints, 44 dashboard pages, 7 Trigger.dev tasks.

### Multi-Platform Architecture

The platform uses a **Platform Discriminator** pattern: each entity (account, connection) has a `platform` string field. Platform-specific logic lives in strategy classes registered at runtime via `PlatformStrategyRegistry`.

### Workspaces

| Workspace | Stack | Module | Tests |
|-----------|-------|--------|-------|
| `apps/connector-pool` | Unified pool service, Hono, Reconciler, worker threads | ESM (tsx) | — |
| `apps/api` | NestJS 11, Swagger 11, class-validator, Socket.IO 4.8, Trigger SDK 3.3 | CJS | Jest |
| `apps/frontend` | Next.js 16.1, React 19.2, @xyflow/react 12.6, Recharts 3.8, Radix UI, Tailwind 4 | ESM | Playwright |
| `apps/trigger` | Trigger.dev SDK 3.x, mtcute (telegram), Pino 9.9 | ESM | Vitest |
| `packages/db` | Prisma 7, @prisma/adapter-pg 7 | ESM | None |
| `packages/telegram-user-connector` | mtcute (MTProto), platform-kit, Valibot 0.42 | ESM | Vitest |
| `packages/telegram-bot-connector` | grammY, platform-kit, Valibot 0.42 | ESM | Vitest |
| `packages/whatsapp-user-connector` | Baileys 6.7, platform-kit, Valibot 0.42 | ESM | Vitest |
| `packages/discord-bot-connector` | Discord.js 14, platform-kit, Valibot 0.42 | ESM | Vitest |
| `packages/platform-kit` | ActionRegistry, CircuitBreaker, EventForwarder, Hono server factory | ESM | Vitest |
| `packages/flow-shared` | Shared flow types/utils | ESM | None |

### Connector Pool Architecture

All connectors run in a single unified pool service (`apps/connector-pool`). The pool polls the database for active instances and spawns each connector as a worker thread. No tokens or credentials are needed at startup — everything comes from the database via the dashboard.

| Pool | DB Table | Filter | Worker Script |
|------|----------|--------|---------------|
| `telegram:bot` | `BotInstance` | `platform='telegram', isActive=true` | `packages/telegram-bot-connector/src/worker.ts` |
| `telegram:user` | `PlatformConnection` | `platform='telegram', connectionType='mtproto', status='active'` | `packages/telegram-user-connector/src/worker.ts` |
| `whatsapp:user` | `PlatformConnection` | `platform='whatsapp', status='active'` | `packages/whatsapp-user-connector/src/worker.ts` |
| `discord:bot` | `BotInstance` | `platform='discord', isActive=true` | `packages/discord-bot-connector/src/worker.ts` |

**Pool lifecycle:** Reconciler polls DB every 30s → compares desired vs running workers → spawns new / stops removed → workers run connectors in threads.

**Auth flows:** All authentication (bot tokens, MTProto sessions, WhatsApp QR, Discord tokens) happens via the dashboard and API. Credentials are stored in `BotInstance.botToken` or `PlatformConnection.credentials`. The pool only picks up already-authenticated instances.

**Connector packages:** Each connector package (`packages/*-connector`) contains the platform-specific logic including `worker.ts`, `connector.ts`, actions, events, and SDK transport. The pool service does not mix platform logic — it only configures which worker script to use and how to extract credentials from DB records.

**HTTP API:** Single Hono server on port 3010 with routes: `POST /execute`, `GET /health`, `GET /pools`, `GET /instances`, `GET /instances/:id/health`, `POST /instances/:id/restart`, `GET /metrics`.

### Path Aliases (`tsconfig.base.json`)
- `@flowbot/db` → `packages/db/src/index.ts`
- `@flowbot/*` → `packages/*/src`

## Commands

```bash
pnpm install                            # Install deps
docker compose up -d                    # Start PostgreSQL
pnpm db prisma:migrate                  # Run migrations
pnpm db prisma:push                     # Push schema (no migration)
pnpm db generate                        # Regenerate Prisma Client
pnpm db build                           # Compile db package

# Dev
pnpm connector-pool dev | pnpm api start:dev | pnpm frontend dev | pnpm trigger dev

# Build
pnpm api build | pnpm frontend build

# Typecheck
pnpm connector-pool typecheck | pnpm telegram-user-connector typecheck | pnpm telegram-bot-connector typecheck | pnpm trigger typecheck | pnpm whatsapp-user-connector typecheck | pnpm discord-bot-connector typecheck

# Lint
pnpm api lint | pnpm frontend lint
pnpm api format                         # Prettier (API only)

# Test
pnpm api test                           # Jest (238 tests)
pnpm api test -- --testPathPattern=X    # Specific test
pnpm telegram-user-connector test       # Vitest
pnpm telegram-bot-connector test        # Vitest
pnpm whatsapp-user-connector test       # Vitest (86 tests)
pnpm discord-bot-connector test         # Vitest
pnpm platform-kit test                  # Vitest (29 tests)
pnpm trigger test                       # Vitest

# Trigger.dev
pnpm trigger dev | pnpm trigger deploy
```

## Database Schema

Schema at `packages/db/prisma/schema.prisma`. After changes: `pnpm db generate && pnpm db build`.

**Domains:**
- **Identity (new):** PlatformAccount (multi-platform user), UserIdentity (cross-platform umbrella linking accounts)
- **Connections (new):** PlatformConnection, PlatformConnectionLog
- **Legacy (kept for migration):** User, ManagedGroup, GroupConfig, GroupMember, Warning, ModerationLog, ScheduledMessage, GroupAnalyticsSnapshot
- **Bot Config:** BotInstance (multi-platform), BotCommand, BotResponse, BotMenu, BotMenuButton
- **Flow Engine:** FlowDefinition, FlowFolder, FlowExecution, FlowVersion, UserFlowContext, FlowEvent
- **Webhooks:** WebhookEndpoint

## App Structure

**Connector Pool (`apps/connector-pool/src/`):** Unified pool service managing all platform connectors. Pools config in `pools/` (telegram-bot, telegram-user, whatsapp-user, discord-bot). Multiplexed Hono HTTP server in `server.ts`. Each pool runs a `Reconciler` from platform-kit that polls DB and spawns worker threads running connector instances. Workers forward events via `EventForwarder` to `POST /api/flow/webhook`.

**Trigger (`apps/trigger/src/`):** Tasks in `trigger/` (flow-event-cleanup, flow-execution, health-check, scheduled-message). Libs in `lib/` (prisma, telegram, telegram-bot, flow-engine/).

**API (`apps/api/src/`):** NestJS modules:
- **New multi-platform:** platform (global strategy registry), identity (accounts + identity linking), connections (CRUD + auth state machine + health + strategies)
- **Updated:** analytics (time series), bot-config (heartbeat endpoint)
- **Legacy (kept):** users, moderation (groups, members, warnings, logs, scheduled-messages)
- **Unchanged:** auth, system, flows, webhooks, events (EventBus, WsGateway, SSE)
- **Flow webhook:** `FlowWebhookController` at `/api/flow/webhook` receives events from connectors, matches against active flow triggers, creates `FlowExecution` records
- All endpoints under `/api/`.

**Frontend (`apps/frontend/src/`):** Next.js App Router. Dashboard pages under `app/dashboard/`. API client in `lib/api.ts`. shadcn/ui components in `components/ui/`. WebSocket in `lib/websocket.tsx`. Multi-platform components: `PlatformBadge`, `PlatformFilter`, `PlatformProvider` context. New pages: `identity/accounts`, `identity/linked`, `connections/`.

### Frontend UI Stack

- **Component library:** [shadcn/ui](https://ui.shadcn.com) — copy-paste Radix UI primitives styled with Tailwind CSS. Config at `apps/frontend/components.json`.
- **Styling:** Tailwind CSS v4 with CSS variables (`cssVariables: true`), base color `slate`. Global styles in `app/globals.css`.
- **Icons:** Lucide React (`iconLibrary: "lucide"` in components.json).
- **Adding components:** Run `npx shadcn@latest add <component>` from `apps/frontend/`. Components land in `src/components/ui/`.
- **Path aliases:** `@/components`, `@/lib`, `@/hooks` (configured in `components.json` and `tsconfig.json`).
- **Utility function:** `cn()` from `@/lib/utils` for merging Tailwind classes (uses `clsx` + `tailwind-merge`).

## Environment Variables

| App | Required |
|-----|----------|
| Shared | `DATABASE_URL` |
| Connector Pool | `DATABASE_URL`, `API_URL`, `POOL_HOST`, `POOL_PORT` (default 3010), `TG_API_ID`, `TG_API_HASH` (for telegram-user), `LOG_LEVEL`, `ENABLE_TELEGRAM_BOT`, `ENABLE_TELEGRAM_USER`, `ENABLE_WHATSAPP_USER`, `ENABLE_DISCORD_BOT` (all default true) |
| Trigger | `DATABASE_URL`, `TG_CLIENT_API_ID`, `TG_CLIENT_API_HASH`, `TG_CLIENT_SESSION`, `TELEGRAM_BOT_API_URL`, `CONNECTOR_POOL_URL` (default `http://localhost:3010`) |
| API | `DATABASE_URL`, `PORT`, `FRONTEND_URL` |
| Frontend | `API_INTERNAL_URL` (server-side proxy to API, default `http://localhost:3000`) |

Docker Compose: PostgreSQL on `127.0.0.1:5432` (postgres/postgres/flowbot_db).

### Local Dev Quick Reference

- **Dashboard password:** `change-me-in-production` (set via `DASHBOARD_SECRET` env var)
- **Default ports:** API `:3000` (or set `PORT`), Frontend `:3001`, Connector Pool `:3010`
- **Flow node format:** Nodes store `category` inside `data.category` (React Flow format), not at top level. Match with `n.data?.category ?? n.category`.

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
- **Project ref:** `proj_cjvcqgulcerjdqdcrqhy` (configured in `apps/trigger/trigger.config.ts`)
- **SDK version:** `@trigger.dev/sdk@4.4.3` — CLI version must match
- **Login required:** first run needs `npx trigger.dev@4.4.3 login --api-url https://trigger.raqz.link` (opens browser auth flow)
- **Auth config:** stored in `~/.config/trigger/config.json` after login
- **Start command:** `pnpm trigger dev` (runs `npx trigger.dev@4.4.3 dev --api-url https://trigger.raqz.link`)

### User Account Actions (user_* prefix)
- Nodes prefixed with `user_` require MTProto transport via PlatformConnection
- Dispatched through `dispatchUserAction()` in `lib/flow-engine/user-actions.ts`
- Routed via HTTP `POST /execute` to the connector pool (same as bot actions)
- The pool routes to the correct telegram-user worker by `connectionId` as `instanceId`
- 18 `user_*` actions registered in `packages/telegram-user-connector/src/actions/flow-actions.ts`
- `CONNECTOR_POOL_URL` env var (default `http://localhost:3010`) configures the pool endpoint
- Flow validation enforces `platformConnectionId` or per-node `connectionOverride`
