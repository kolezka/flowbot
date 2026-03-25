# Connector Pool & Connector Packages

> Auto-generated: 2026-03-22

## Table of Contents

- [1. Architecture Overview](#1-architecture-overview)
- [2. apps/connector-pool](#2-appsconnector-pool)
  - [2.1 Overview](#21-overview)
  - [2.2 Configuration](#22-configuration)
  - [2.3 Pool Definitions](#23-pool-definitions)
  - [2.4 HTTP API](#24-http-api)
  - [2.5 Startup & Shutdown](#25-startup--shutdown)
- [3. packages/platform-kit](#3-packagesplatform-kit)
  - [3.1 ActionRegistry](#31-actionregistry)
  - [3.2 CircuitBreaker](#32-circuitbreaker)
  - [3.3 EventForwarder](#33-eventforwarder)
  - [3.4 Reconciler & WorkerWrapper](#34-reconciler--workerwrapper)
  - [3.5 Server Utilities](#35-server-utilities)
  - [3.6 Tests](#36-tests)
- [4. packages/telegram-bot-connector](#4-packagestelegram-bot-connector)
- [5. packages/telegram-user-connector](#5-packagestelegram-user-connector)
- [6. packages/whatsapp-user-connector](#6-packageswhatsapp-user-connector)
- [7. packages/discord-bot-connector](#7-packagesdiscord-bot-connector)

---

## 1. Architecture Overview

All platform connectors run inside a single unified pool service (`apps/connector-pool`). The pool polls the database for active instances and spawns each connector as a **worker thread**. No tokens or credentials are needed at startup — everything comes from the database via the dashboard.

```
connector-pool (main thread, port 3010)
├── Reconciler: telegram:bot  → BotInstance (platform=telegram)
│   └── Worker: TelegramBotConnector (grammY)
├── Reconciler: telegram:user → PlatformConnection (connectionType=mtproto)
│   └── Worker: TelegramUserConnector (mtcute)
├── Reconciler: whatsapp:user → PlatformConnection (platform=whatsapp)
│   └── Worker: WhatsAppUserConnector (Baileys)
└── Reconciler: discord:bot   → BotInstance (platform=discord)
    └── Worker: DiscordBotConnector (discord.js)
```

**Core pattern:** Each connector package implements the `PoolConnector` interface from `platform-kit`:

```typescript
interface PoolConnector {
  readonly registry: ActionRegistry
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
}
```

**Worker message protocol** (Main ↔ Worker via MessagePort):

| Direction | Type | Purpose |
|-----------|------|---------|
| Main → Worker | `execute` | Run action with params, returns result |
| Main → Worker | `shutdown` | Graceful shutdown |
| Worker → Main | `ready` | Worker initialized and connected |
| Worker → Main | `result` | Action execution result |
| Worker → Main | `health` | Periodic health (every 10s) |
| Worker → Main | `error` | Fatal error (worker exits) |

---

## 2. apps/connector-pool

### 2.1 Overview

Package: `@flowbot/connector-pool` (ESM, private)

The unified pool service that orchestrates all platform connectors. It runs a single Hono HTTP server and manages multiple Reconcilers, each responsible for one platform pool.

**Key dependencies:** `@flowbot/platform-kit`, all 4 connector packages, `@flowbot/db`, `hono`, `pino`, `valibot`

### 2.2 Configuration

Environment variables (Valibot-validated):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `API_URL` | No | `http://localhost:3000` | Main API URL for event forwarding |
| `POOL_HOST` | No | `0.0.0.0` | HTTP server bind host |
| `POOL_PORT` | No | `3010` | HTTP server port |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `TG_API_ID` | For TG user | — | Telegram API ID (numeric) |
| `TG_API_HASH` | For TG user | — | Telegram API hash |
| `MAX_WORKERS` | No | `100` | Max workers per process |
| `BATCH_SIZE` | No | `20` | Workers spawned per batch |
| `BATCH_DELAY_MS` | No | `1000` | Delay between batches |
| `RECONCILE_INTERVAL_MS` | No | `30000` | DB poll interval |
| `ENABLE_TELEGRAM_BOT` | No | `true` | Enable telegram:bot pool |
| `ENABLE_TELEGRAM_USER` | No | `true` | Enable telegram:user pool |
| `ENABLE_WHATSAPP_USER` | No | `true` | Enable whatsapp:user pool |
| `ENABLE_DISCORD_BOT` | No | `true` | Enable discord:bot pool |

### 2.3 Pool Definitions

Each pool is configured in `src/pools/`:

| Pool | DB Table | Filter | Worker Script |
|------|----------|--------|---------------|
| `telegram:bot` | `BotInstance` | `platform='telegram', isActive=true` | `packages/telegram-bot-connector/src/worker.ts` |
| `telegram:user` | `PlatformConnection` | `platform='telegram', connectionType='mtproto', status='active'` | `packages/telegram-user-connector/src/worker.ts` |
| `whatsapp:user` | `PlatformConnection` | `platform='whatsapp', status='active'` | `packages/whatsapp-user-connector/src/worker.ts` |
| `discord:bot` | `BotInstance` | `platform='discord', isActive=true` | `packages/discord-bot-connector/src/worker.ts` |

### 2.4 HTTP API

Single Hono server on port 3010:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/execute` | Execute action on a worker (`{ instanceId, action, params }`) |
| `GET` | `/health` | Aggregated health (status, uptime, memory, per-pool stats) |
| `GET` | `/pools` | List all pools with worker counts |
| `GET` | `/instances` | List all workers with status and health |
| `GET` | `/instances/:id/health` | Single worker health |
| `POST` | `/instances/:id/restart` | Restart a single worker |
| `GET` | `/metrics` | Worker metrics (actionCount, errorCount, uptime) |

**Health status codes:** 200 (healthy, >80% connected), 207 (degraded, 50-80%), 503 (unhealthy, <50%)

### 2.5 Startup & Shutdown

**Startup sequence:**
1. Load environment config via Valibot
2. Create Prisma client
3. Create enabled pool configs
4. Instantiate Reconciler for each pool
5. Build multiplexed Hono HTTP server
6. Start all reconcilers and HTTP server
7. Register graceful shutdown handlers

**Shutdown sequence:**
1. Set draining flag (503 on new requests)
2. Stop all reconcilers (which stops all workers)
3. Stop HTTP server
4. Disconnect Prisma

**Scripts:**

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch ./src/main.ts` | Development with auto-restart |
| `start` | `tsx ./src/main.ts` | Production start |
| `typecheck` | `tsc` | Type checking |

---

## 3. packages/platform-kit

Package: `@flowbot/platform-kit` (ESM, private)

Shared infrastructure for all connector packages. Provides ActionRegistry, CircuitBreaker, EventForwarder, Reconciler, WorkerWrapper, and HTTP server factories.

**Key dependencies:** `hono`, `pino`, `valibot`

### 3.1 ActionRegistry

Manages action registration and execution with Valibot schema validation.

```typescript
class ActionRegistry {
  register<TParams>(name: string, def: ActionDef<TParams>): void
  async execute(action: string, rawParams: unknown): Promise<ActionResult>
  getActions(): string[]
  supports(action: string): boolean
}
```

- Validates params against Valibot schema before execution
- Returns `{ success, data?, error? }`
- Supports observability hooks: `onExecute(action, durationMs, success)`, `onError(action, error)`

### 3.2 CircuitBreaker

Three-state circuit breaker (CLOSED → OPEN → HALF_OPEN) for fault tolerance.

| Config | Default | Description |
|--------|---------|-------------|
| `failureThreshold` | 5 | Failures to trip circuit |
| `resetTimeoutMs` | 30,000 | Wait before probe |
| `windowMs` | 60,000 | Sliding failure window |

### 3.3 EventForwarder

Posts flow trigger events to the API webhook endpoint (`/api/flow/webhook`).

```typescript
interface FlowTriggerEvent {
  platform: string              // 'telegram', 'discord', 'whatsapp'
  communityId?: string | null
  accountId?: string
  eventType: string             // 'message', 'member_join', etc.
  data?: Record<string, unknown>
  timestamp?: string
  botInstanceId?: string
}
```

### 3.4 Reconciler & WorkerWrapper

**Reconciler** manages worker thread lifecycle:
1. Query DB for desired instances via `config.getInstances()`
2. Compare with running workers
3. Stop removed workers immediately
4. Start missing workers in batches (default 20, 1s delay)
5. Optionally update `apiUrl` field in DB
6. Runs on configurable interval (default 30s)

**WorkerWrapper** wraps Node.js `Worker` thread:
- Status: `starting` → `ready` → `draining` → `dead`
- Health messages every 10s: `{ connected, uptime, actionCount, errorCount }`
- Configurable timeouts: ready (30s), execute (30s), shutdown (10s)

### 3.5 Server Utilities

- `createConnectorServer(config)` — Per-connector Hono server with `/health`, `/execute`, `/api/actions`
- `createServerManager(server, options)` — Generic server lifecycle wrapper

### 3.6 Tests

11 test files (104 tests total across platform-kit):

| File | Coverage |
|------|----------|
| `action-registry.test.ts` | Registration, execution, validation |
| `circuit-breaker.test.ts` | State transitions, failure counting |
| `circuit-breaker-integration.test.ts` | Integration scenarios |
| `connector-e2e.test.ts` | End-to-end connector flow |
| `connector-error.test.ts` | Error handling |
| `event-forwarder.test.ts` | Event forwarding to API |
| `pool-integration.test.ts` | Pool lifecycle integration |
| `pool-reconciler.test.ts` | Reconciliation logic |
| `pool-server.test.ts` | HTTP server routes |
| `pool-worker-wrapper.test.ts` | Worker lifecycle |
| `server.test.ts` | Server factory |

---

## 4. packages/telegram-bot-connector

Package: `@flowbot/telegram-bot-connector` (ESM, private)

Telegram Bot API connector using **grammY**.

**Key dependencies:** `@flowbot/platform-kit`, `grammy` 1.36, `pino`, `valibot`

**Connector class:** `TelegramBotConnector`

| Config | Description |
|--------|-------------|
| `botToken` | Telegram bot token |
| `botInstanceId` | BotInstance ID |
| `logger` | Pino logger |
| `apiUrl` | API URL for event forwarding |
| `scope` | Optional BotScope for chat/user filtering |

**Actions (25+):**

| Category | Actions |
|----------|---------|
| Messaging | send_message, send_photo, send_video, send_document, send_audio, send_voice, send_sticker, send_location, send_contact, send_poll |
| Admin | kick_user, ban_user, unban_user, restrict_user, unrestrict_user, promote_user, demote_user |
| Chat | set_chat_title, set_chat_description, set_chat_photo, delete_chat_photo, export_invite_link |
| Message Mgmt | edit_message, delete_message, pin_message, unpin_message, copy_message |

**Events forwarded:** message, chat_member (join/leave), callback_query

**Tests:** 5 files (actions, connector, event-pipeline, events, scope-filter) — 106 tests

---

## 5. packages/telegram-user-connector

Package: `@flowbot/telegram-user-connector` (ESM, private)

Telegram MTProto user account connector using **mtcute**.

**Key dependencies:** `@flowbot/platform-kit`, `@mtcute/node` 0.29, `pino`, `valibot`

**Connector class:** `TelegramUserConnector`

| Config | Description |
|--------|-------------|
| `sessionString` | Encrypted MTProto session from DB |
| `apiId` | Telegram API ID |
| `apiHash` | Telegram API hash |
| `logger` | Pino logger |

**Actions (35+):**

| Category | Actions |
|----------|---------|
| Messaging | send_message, send_photo, send_video, send_document, send_audio, send_voice, send_sticker, send_animation, send_location, send_contact, send_venue, send_dice, forward_message, edit_message, delete_message, pin_message, unpin_message, copy_message |
| User API | ban_user, restrict_user, promote_user, set_chat_title, set_chat_description, export_invite_link, get_chat_member, leave_chat, create_poll, send_media_group, create_forum_topic, resolve_username |
| Flow Actions (18 user_*) | user_get_chat_history, user_search_messages, user_get_all_members, user_get_chat_info, and 14+ more mtcute operations |

**Tests:** 3 files (actions, connector, schemas) — 95 tests

---

## 6. packages/whatsapp-user-connector

Package: `@flowbot/whatsapp-user-connector` (ESM, private)

WhatsApp user account connector using **Baileys**.

**Key dependencies:** `@flowbot/platform-kit`, `@whiskeysockets/baileys` 6.7, `pino`, `valibot`

**Connector class:** `WhatsAppUserConnector`

| Config | Description |
|--------|-------------|
| `connectionId` | PlatformConnection ID |
| `botInstanceId` | BotInstance ID |
| `prisma` | PrismaClient for session storage |
| `logger` | Pino logger |
| `apiUrl` | API URL for event forwarding |

**Note:** WhatsApp workers create their own PrismaClient because Baileys requires DB access for session/auth state storage.

**Auth flow:** QR code generated by Baileys → pushed to API via webhook → user scans in mobile app → session persisted to DB.

**Actions (20+):**

| Category | Actions |
|----------|---------|
| Messaging | send_message, send_media, send_location, send_contact |
| Group Admin | create_group, add_member, remove_member, promote_member, demote_member, set_group_title, set_group_description |
| Message Mgmt | edit_message, delete_message, mark_read |
| Presence | set_presence (online/away/typing) |

**Events forwarded:** messages.upsert (new/edited), connection.update (auth status)

**Tests:** 5 files (actions, connector, event-pipeline, events, schemas) — 105 tests

---

## 7. packages/discord-bot-connector

Package: `@flowbot/discord-bot-connector` (ESM, private)

Discord bot connector using **discord.js 14**.

**Key dependencies:** `@flowbot/platform-kit`, `discord.js` 14, `pino`, `valibot`

**Connector class:** `DiscordBotConnector`

| Config | Description |
|--------|-------------|
| `botToken` | Discord bot token |
| `botInstanceId` | BotInstance ID |
| `logger` | Pino logger |
| `apiUrl` | API URL for event forwarding |

**Actions (25+):**

| Category | Actions |
|----------|---------|
| Messaging | send_message, send_embed, send_dm, edit_message, delete_message, pin_message, unpin_message, add_reaction, remove_reaction |
| Admin | kick_user, ban_user, timeout_member, unban_user, assign_role, remove_role, change_nickname |
| Channel | create_channel, delete_channel, create_thread, archive_thread, create_role, create_invite, schedule_event |

**Events forwarded (7):** messageCreate, guildMemberAdd, guildMemberRemove, interactionCreate, messageReactionAdd, messageReactionRemove, voiceStateUpdate

**Tests:** 5 files (actions, connector, event-pipeline, events, schemas) — 143 tests

---

## Summary

| Package | Transport | Actions | Test Files | Tests |
|---------|-----------|---------|-----------|-------|
| connector-pool | Hono (HTTP) | 7 endpoints | — | — |
| platform-kit | Worker threads | Registry + infra | 11 | 104 |
| telegram-bot-connector | grammY | 25+ | 5 | 106 |
| telegram-user-connector | mtcute (MTProto) | 35+ | 3 | 95 |
| whatsapp-user-connector | Baileys | 20+ | 5 | 105 |
| discord-bot-connector | discord.js | 25+ | 5 | 143 |
