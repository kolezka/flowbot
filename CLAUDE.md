# CLAUDE.md

## Project Overview

Multi-platform bot management platform ("Flowbot") with admin dashboard, group management bots (Telegram, Discord, and more), visual flow builder, and Trigger.dev background job worker. pnpm monorepo with 11 workspaces, 35+ Prisma models, 130+ API endpoints, 44 dashboard pages, 7 Trigger.dev tasks.

### Multi-Platform Architecture

The platform uses a **Platform Discriminator** pattern: each entity (account, community, connection) has a `platform` string field. Platform-specific logic lives in strategy classes registered at runtime via `PlatformStrategyRegistry`. Design spec at `docs/superpowers/specs/2026-03-19-multi-platform-architecture-design.md`.

### Workspaces

| Workspace | Stack | Module | Tests |
|-----------|-------|--------|-------|
| `apps/bot` | grammY 1.36, Hono 4.10, Pino 9.9, Valibot 0.42 | ESM (tsx) | None |
| `apps/manager-bot` | grammY 1.36, Hono 4.10, Pino 9.9, Valibot 0.42, Anthropic SDK | ESM (tsx) | Vitest |
| `apps/api` | NestJS 11, Swagger 11, class-validator, Socket.IO 4.8, Trigger SDK 3.3 | CJS | Jest |
| `apps/frontend` | Next.js 16.1, React 19.2, @xyflow/react 12.6, Recharts 3.8, Radix UI, Tailwind 4 | ESM | Playwright |
| `apps/trigger` | Trigger.dev SDK 3.x, GramJS (telegram), Pino 9.9 | ESM | Vitest |
| `apps/tg-client` | GramJS (telegram), tsx | ESM | Vitest |
| `apps/discord-bot` | Discord.js (TBD) | ESM | None |
| `packages/db` | Prisma 7, @prisma/adapter-pg 7 | ESM | None |
| `packages/telegram-transport` | GramJS (telegram), Pino 9.9, Valibot 0.42 | ESM | Vitest |
| `packages/discord-transport` | (TBD) | ESM | None |
| `packages/flow-shared` | Shared flow types/utils | ESM | None |

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
pnpm bot dev | pnpm manager-bot dev | pnpm api start:dev | pnpm frontend dev | pnpm trigger dev

# Build
pnpm bot build | pnpm manager-bot build | pnpm api build | pnpm frontend build

# Typecheck
pnpm manager-bot typecheck | pnpm trigger typecheck | pnpm telegram-transport typecheck

# Lint
pnpm bot lint | pnpm manager-bot lint | pnpm api lint | pnpm frontend lint
pnpm api format                         # Prettier (API only)

# Test
pnpm api test                           # Jest (238 tests)
pnpm api test -- --testPathPattern=X    # Specific test
pnpm manager-bot test                   # Vitest (73 tests)
pnpm telegram-transport test            # Vitest (24 tests)
pnpm trigger test                       # Vitest
pnpm tg-client test                     # Vitest

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

**Bot (`apps/bot/src/`):** Feature-based under `bot/` — `features/`, `keyboards/`, `callback-data/`, `middlewares/`, `filters/`, `context.ts`. Polling (dev) / webhook (prod) via `BOT_MODE`. i18n in `locales/`.

**Manager Bot (`apps/manager-bot/src/`):** Mirrors bot structure — `bot/features/` (moderation, anti-spam, CAPTCHA, schedule, crosspost, etc.), `bot/middlewares/`, `repositories/`, `services/`, `server/` (Hono with `/api/send-message`).

**Trigger (`apps/trigger/src/`):** Tasks in `trigger/` (analytics-snapshot, broadcast, cross-post, flow-event-cleanup, flow-execution, health-check, scheduled-message). Libs in `lib/` (prisma, telegram, manager-bot, flow-engine/).

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
| Bot | `BOT_TOKEN`, `BOT_MODE`, `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT` |
| Manager Bot | `BOT_TOKEN`, `BOT_MODE`, `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT`, `API_SERVER_HOST`, `API_SERVER_PORT` |
| Trigger | `DATABASE_URL`, `TG_CLIENT_API_ID`, `TG_CLIENT_API_HASH`, `TG_CLIENT_SESSION`, `MANAGER_BOT_API_URL` |
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
