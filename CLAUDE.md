# CLAUDE.md

## Project Overview

Multi-platform bot management platform ("Flowbot") with admin dashboard, group management bots (Telegram, Discord, WhatsApp, and more), visual flow builder, and Trigger.dev background job worker. pnpm monorepo with 13 workspaces, 35+ Prisma models, 130+ API endpoints, 44 dashboard pages, 7 Trigger.dev tasks.

### Multi-Platform Architecture

The platform uses a **Platform Discriminator** pattern: each entity (account, community, connection) has a `platform` string field. Platform-specific logic lives in strategy classes registered at runtime via `PlatformStrategyRegistry`. Design spec at `docs/superpowers/specs/2026-03-19-multi-platform-architecture-design.md`.

### Workspaces

| Workspace | Stack | Module | Tests |
|-----------|-------|--------|-------|
| `apps/telegram-bot` | Thin shell, platform-kit server | ESM (tsx) | Vitest |
| `apps/api` | NestJS 11, Swagger 11, class-validator, Socket.IO 4.8, Trigger SDK 3.3 | CJS | Jest |
| `apps/frontend` | Next.js 16.1, React 19.2, @xyflow/react 12.6, Recharts 3.8, Radix UI, Tailwind 4 | ESM | Playwright |
| `apps/trigger` | Trigger.dev SDK 3.x, GramJS (telegram), Pino 9.9 | ESM | Vitest |
| `apps/telegram-user` | Thin shell, platform-kit server | ESM (tsx) | Vitest |
| `apps/whatsapp-user` | Thin shell, platform-kit server | ESM (tsx) | Vitest |
| `apps/discord-bot` | Thin shell, platform-kit server | ESM (tsx) | Vitest |
| `packages/db` | Prisma 7, @prisma/adapter-pg 7 | ESM | None |
| `packages/telegram-user-connector` | GramJS (MTProto), platform-kit, Valibot 0.42 | ESM | Vitest |
| `packages/telegram-bot-connector` | grammY, platform-kit, Valibot 0.42 | ESM | Vitest |
| `packages/whatsapp-user-connector` | Baileys 6.7, platform-kit, Valibot 0.42 | ESM | Vitest |
| `packages/discord-bot-connector` | Discord.js 14, platform-kit, Valibot 0.42 | ESM | Vitest |
| `packages/platform-kit` | ActionRegistry, CircuitBreaker, EventForwarder, Hono server factory | ESM | Vitest |
| `packages/flow-shared` | Shared flow types/utils | ESM | None |

### Telegram Components (connector pattern)

| Component | Type | Protocol | Identity | Purpose |
|-----------|------|----------|----------|---------|
| `packages/telegram-bot-connector` | Package (library) | Bot API (grammY) | Bot account | Connector with ActionRegistry, event mapper, webhook auth, DB-backed state |
| `apps/telegram-bot` | App (thin shell) | — | — | Boots bot connector, starts platform-kit HTTP server |
| `packages/telegram-user-connector` | Package (library) | MTProto (GramJS) | User account | Connector with ActionRegistry, event mapper, QR/phone auth, DB-backed session |
| `apps/telegram-user` | App (thin shell) | — | — | Boots user connector, starts platform-kit HTTP server |
| `packages/platform-kit` | Package (shared) | — | — | ActionRegistry, CircuitBreaker, EventForwarder, server factory |

**Auth flow (bot):** Dashboard webhook config → grammY bot token stored in `PlatformConnection.credentials` → connector auto-reconnects.

**Auth flow (user):** Dashboard phone/QR auth → MTProto session string stored in `PlatformConnection.credentials` → connector auto-reconnects from stored session.

**Connector pattern:** `platform-kit` provides the shared infrastructure. Each connector registers typed action handlers via `ActionRegistry` with Valibot schemas. Events are forwarded via `EventForwarder`. The thin shell app uses `createConnectorServer()` to expose a standard HTTP contract: `POST /execute`, `GET /health`, `GET /actions`.

### WhatsApp Components (connector pattern)

| Component | Type | Protocol | Identity | Purpose |
|-----------|------|----------|----------|---------|
| `packages/whatsapp-user-connector` | Package (library) | Baileys (multi-device) | User account | Connector with ActionRegistry, event mapper, QR auth, DB-backed session |
| `apps/whatsapp-user` | App (thin shell) | — | — | Boots connector, starts platform-kit HTTP server |
| `packages/platform-kit` | Package (shared) | — | — | ActionRegistry, CircuitBreaker, EventForwarder, server factory |

**Auth flow:** Dashboard QR scan → Baileys auth keys stored in `PlatformConnection.credentials` → connector auto-reconnects from stored session.

**Connector pattern:** `platform-kit` provides the shared infrastructure. The connector registers typed action handlers via `ActionRegistry` with Valibot schemas. Events are forwarded via `EventForwarder`. The thin shell app uses `createConnectorServer()` to expose a standard HTTP contract: `POST /execute`, `GET /health`, `GET /actions`.

### Discord Components (connector pattern)

| Component | Type | Protocol | Identity | Purpose |
|-----------|------|----------|----------|---------|
| `packages/discord-bot-connector` | Package (library) | Discord.js (gateway) | Bot account | Connector with ActionRegistry, event mapper, DB-backed state |
| `apps/discord-bot` | App (thin shell) | — | — | Boots bot connector, starts platform-kit HTTP server |
| `packages/platform-kit` | Package (shared) | — | — | ActionRegistry, CircuitBreaker, EventForwarder, server factory |

**Auth flow:** Dashboard bot token config → token stored in env/config → connector connects via Discord gateway.

**Connector pattern:** `platform-kit` provides the shared infrastructure. The connector registers typed action handlers via `ActionRegistry` with Valibot schemas. Events are forwarded via `EventForwarder`. The thin shell app uses `createConnectorServer()` to expose a standard HTTP contract: `POST /execute`, `GET /health`, `GET /actions`.

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
pnpm telegram-bot dev | pnpm telegram-user dev | pnpm whatsapp-user dev | pnpm discord-bot dev | pnpm api start:dev | pnpm frontend dev | pnpm trigger dev

# Build
pnpm telegram-bot build | pnpm api build | pnpm frontend build

# Typecheck
pnpm telegram-bot typecheck | pnpm telegram-user-connector typecheck | pnpm telegram-bot-connector typecheck | pnpm trigger typecheck | pnpm whatsapp-user-connector typecheck | pnpm discord-bot-connector typecheck

# Lint
pnpm telegram-bot lint | pnpm api lint | pnpm frontend lint
pnpm api format                         # Prettier (API only)

# Test
pnpm api test                           # Jest (238 tests)
pnpm api test -- --testPathPattern=X    # Specific test
pnpm telegram-bot test                  # Vitest
pnpm telegram-user-connector test       # Vitest
pnpm telegram-bot-connector test        # Vitest
pnpm whatsapp-user-connector test       # Vitest (86 tests)
pnpm discord-bot-connector test         # Vitest
pnpm platform-kit test                  # Vitest (29 tests)
pnpm trigger test                       # Vitest
pnpm telegram-user dev                  # Start telegram-user connector app

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

**Telegram Bot (`apps/telegram-bot/src/`):** grammY bot with flow-event forwarding. Basic features in `bot/features/` (welcome, menu, profile, language, admin). Flow integration middlewares (flow-events, flow-trigger). HTTP server with `/api/execute-action`, `/api/flow-event`, `/api/send-message`. i18n in `locales/`.

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
| Telegram Bot | `BOT_TOKEN`, `BOT_MODE`, `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT`, `API_SERVER_HOST`, `API_SERVER_PORT` |
| WhatsApp User | `WA_CONNECTION_ID`, `WA_BOT_INSTANCE_ID`, `DATABASE_URL`, `API_URL`, `SERVER_PORT` (default 3004), `LOG_LEVEL` |
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
- **Project ref:** `proj_hilpmfmsfxxbgutxovgl` (configured in `apps/trigger/trigger.config.ts`)
- **SDK version:** `@trigger.dev/sdk@3.3.17` — CLI must match, do NOT use `@latest` (currently 4.x, incompatible)
- **Login required:** first run needs `npx trigger.dev@3.3.17 login --api-url https://trigger.raqz.link` (opens browser auth flow)
- **Auth config:** stored in `~/.config/trigger/config.json` after login
- **Start command:**
  ```bash
  TRIGGER_SECRET_KEY=tr_dev_pd7r4ISDoUW36jlJSVLH npx trigger.dev@3.3.17 dev --api-url https://trigger.raqz.link --skip-update-check
  ```
- **Note:** `pnpm trigger dev` uses `npx trigger.dev@latest` which causes version mismatch errors — use the explicit command above instead

### User Account Actions (user_* prefix)
- Nodes prefixed with `user_` require MTProto transport via PlatformConnection
- Dispatched through `dispatchUserAction()` in `lib/flow-engine/user-actions.ts`
- Transport cached per connection ID in `lib/flow-engine/connection-transport.ts`
- Never routed through Bot API — always direct GramJS via `getClient()`
- Flow validation enforces `platformConnectionId` or per-node `connectionOverride`
