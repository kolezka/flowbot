# CLAUDE.md

## Project Overview

Multi-platform bot management platform ("Flowbot") with admin dashboard, group management bots (Telegram, Discord, WhatsApp, and more), visual flow builder, and Trigger.dev background job worker. pnpm monorepo with 13 workspaces, 35+ Prisma models, 130+ API endpoints, 44 dashboard pages, 7 Trigger.dev tasks.

### Multi-Platform Architecture

The platform uses a **Platform Discriminator** pattern: each entity (account, community, connection) has a `platform` string field. Platform-specific logic lives in strategy classes registered at runtime via `PlatformStrategyRegistry`. Design spec at `docs/superpowers/specs/2026-03-19-multi-platform-architecture-design.md`.

### Workspaces

| Workspace | Stack | Module | Tests |
|-----------|-------|--------|-------|
| `apps/connector-pool` | Unified pool service, Hono, Reconciler, worker threads | ESM (tsx) | — |
| `apps/api` | NestJS 11, Swagger 11, class-validator, Socket.IO 4.8, Trigger SDK 3.3 | CJS | Jest |
| `apps/frontend` | Next.js 16.1, React 19.2, @xyflow/react 12.6, Recharts 3.8, Radix UI, Tailwind 4 | ESM | Playwright |
| `apps/trigger` | Trigger.dev SDK 3.x, GramJS (telegram), Pino 9.9 | ESM | Vitest |
| `packages/db` | Prisma 7, @prisma/adapter-pg 7 | ESM | None |
| `packages/telegram-user-connector` | GramJS (MTProto), platform-kit, Valibot 0.42 | ESM | Vitest |
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
- **Communities (new):** Community, CommunityConfig, CommunityTelegramConfig, CommunityDiscordConfig, CommunityMember
- **Connections (new):** PlatformConnection, PlatformConnectionLog (replaces TG Client)
- **Analytics (new):** CommunityAnalyticsSnapshot
- **Legacy (kept for migration):** User, ManagedGroup, GroupConfig, GroupMember, Warning, ModerationLog, ScheduledMessage, GroupAnalyticsSnapshot, ReputationScore, ClientLog, ClientSession, CrossPostTemplate, BroadcastMessage
- **Bot Config:** BotInstance (multi-platform), BotCommand, BotResponse, BotMenu, BotMenuButton
- **Flow Engine:** FlowDefinition, FlowFolder, FlowExecution, FlowVersion, UserFlowContext, FlowEvent
- **Webhooks:** WebhookEndpoint

## App Structure

**Connector Pool (`apps/connector-pool/src/`):** Unified pool service managing all platform connectors. Pools config in `pools/` (telegram-bot, telegram-user, whatsapp-user, discord-bot). Multiplexed Hono HTTP server in `server.ts`. Each pool runs a `Reconciler` from platform-kit that polls DB and spawns worker threads running connector instances.

**Trigger (`apps/trigger/src/`):** Tasks in `trigger/` (analytics-snapshot, broadcast, cross-post, flow-event-cleanup, flow-execution, health-check, scheduled-message). Libs in `lib/` (prisma, telegram, telegram-bot, flow-engine/).

**API (`apps/api/src/`):** NestJS modules:
- **New multi-platform:** platform (global strategy registry), identity (accounts + identity linking), communities (CRUD + config + members + strategies + community-scoped warnings/logs/scheduled-messages), connections (CRUD + auth state machine + health + strategies)
- **Updated:** broadcast (multi-platform support), reputation (account/identity/community endpoints), analytics (community time series), bot-config (heartbeat endpoint)
- **Legacy (kept):** users, moderation (groups, members, warnings, logs, crosspost, scheduled-messages), tg-client
- **Unchanged:** auth, automation, system, flows, webhooks, events (EventBus, WsGateway, SSE)
- All endpoints under `/api/`.

**Frontend (`apps/frontend/src/`):** Next.js App Router. Dashboard pages under `app/dashboard/`. API client in `lib/api.ts`. Radix UI components in `components/ui/`. WebSocket in `lib/websocket.tsx`. Multi-platform components: `PlatformBadge`, `PlatformFilter`, `PlatformProvider` context. New pages: `identity/accounts`, `identity/linked`, `communities/`, `connections/`.

## Environment Variables

| App | Required |
|-----|----------|
| Shared | `DATABASE_URL` |
| Connector Pool | `DATABASE_URL`, `API_URL`, `POOL_HOST`, `POOL_PORT` (default 3010), `TG_API_ID`, `TG_API_HASH` (for telegram-user), `LOG_LEVEL`, `ENABLE_TELEGRAM_BOT`, `ENABLE_TELEGRAM_USER`, `ENABLE_WHATSAPP_USER`, `ENABLE_DISCORD_BOT` (all default true) |
| Trigger | `DATABASE_URL`, `TG_CLIENT_API_ID`, `TG_CLIENT_API_HASH`, `TG_CLIENT_SESSION`, `TELEGRAM_BOT_API_URL` |
| API | `DATABASE_URL`, `PORT`, `FRONTEND_URL` |
| Frontend | `NEXT_PUBLIC_API_URL` |

Docker Compose: PostgreSQL on port 5432 (postgres/postgres/flowbot_db).

## Migration Scripts

Data migration scripts in `scripts/` for the multi-platform refactoring. Run in order:

```bash
npx --package=tsx tsx scripts/migrate-slice1-identity.ts         # User → PlatformAccount + UserIdentity
npx --package=tsx tsx scripts/migrate-slice2-communities.ts      # ManagedGroup → Community + configs + members
npx --package=tsx tsx scripts/migrate-slice3-connections.ts       # ClientSession → PlatformConnection
npx --package=tsx tsx scripts/migrate-slice4-broadcast.ts         # Annotate broadcasts with multi-platform metadata
npx --package=tsx tsx scripts/migrate-slice5-reputation-analytics.ts  # Copy analytics to Community model
npx --package=tsx tsx scripts/migrate-slice7-cleanup.ts           # Verification report (what's safe to drop)
```

Requires `DATABASE_URL` env var. All scripts are idempotent (safe to re-run).

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
- Transport cached per connection ID in `lib/flow-engine/connection-transport.ts`
- Never routed through Bot API — always direct GramJS via `getClient()`
- Flow validation enforces `platformConnectionId` or per-node `connectionOverride`
