# flowbot-connectors Skill Design

**Date:** 2026-03-22
**Status:** Draft
**Type:** Skill specification for `superpowers:writing-skills`

## Purpose

Create a skill called `flowbot-connectors` that serves as both architecture reference and implementation guide for the Flowbot connector/pool/app system. It should be used when adding new platform connectors, modifying existing ones, or creating pools.

## When to Trigger

When the user wants to add a new platform connector, create a pool for an existing connector, modify connector behavior, add actions/events to a connector, or asks about the connector architecture.

## Skill Content

### Architecture Overview

**Three-layer pattern:** connector package (library) → thin shell app (single instance) → pool app (multi-instance, optional).

- `@flowbot/platform-kit` — shared foundation: ActionRegistry, CircuitBreaker, EventForwarder, Hono server factories
- `createConnectorServer()` — single-instance HTTP contract: POST /execute, GET /health, GET /actions
- `createPoolServer()` — multi-instance: worker threads, DB reconciliation every 30s, request routing by instanceId

### Existing Connectors

| Platform | Connector Package | SDK | Apps | Auth |
|----------|------------------|-----|------|------|
| Telegram Bot | `@flowbot/telegram-bot-connector` (grammY) | Bot API | `telegram-bot` (shell), `telegram-bot-pool` (pool) | Bot token → getMe validation |
| Telegram User | `@flowbot/telegram-user-connector` (GramJS) | MTProto | `telegram-user` (shell) | Phone/QR → session string |
| WhatsApp User | `@flowbot/whatsapp-user-connector` (Baileys 6.7) | Multi-device | `whatsapp-user` (shell) | QR → DB-backed keys |
| Discord Bot | `@flowbot/discord-bot-connector` (Discord.js 14) | Gateway | `discord-bot` (shell) | Bot token |

### How to Add a New Connector

Reference files to copy from (use telegram-bot-connector as template):

**1. Create connector package** at `packages/<platform>-connector/`:
- `src/connector.ts` — class structurally compatible with `PoolConnector` (must expose `registry`, `connect()`, `disconnect()`, `isConnected()`). Note: existing connectors use duck typing, not explicit `implements PoolConnector`.
- `src/sdk/types.ts` — transport interface abstraction (enables test injection via `transport` config option)
- `src/sdk/<sdk-impl>.ts` — concrete SDK implementation (e.g., `grammy-bot.ts`, `baileys-client.ts`)
- `src/actions/` — action handlers registered via `ActionRegistry` with Valibot schemas
- `src/events/listeners.ts` — event mapper forwarding to `EventForwarder`
- `src/features/` — (optional) built-in command handlers, platform-specific (e.g., /start, /help for Telegram bots)
- `src/worker.ts` — worker entry point calling `runWorker()` from platform-kit
- `src/__tests__/` — Vitest tests: separate files for actions, connector lifecycle, event pipeline, scope filter
- `tsconfig.json` — must extend `../../tsconfig.base.json` with `"include": ["src/**/*"]` for path alias resolution
- `package.json` — ESM module, deps on `@flowbot/platform-kit`, `@flowbot/db`, `pino`, `valibot`
- Verify the new package is picked up by `pnpm-workspace.yaml` glob patterns

**2. Create thin shell app** at `apps/<platform>/`:
- `src/main.ts` — boots connector, calls `createConnectorServer()` to create Hono server, then `createServerManager(server, { host, port })` to bind and listen
- `src/config.ts` — Valibot schema for environment variables
- `tsconfig.json` — extends `../../tsconfig.base.json`
- Exposes: POST /execute, GET /health, GET /actions
- Verify the new app is picked up by `pnpm-workspace.yaml`

**3. Create pool app** (optional) at `apps/<platform>-pool/`:
- `src/main.ts` — calls `createPoolServer()` with `getInstances` (DB query), `toWorkerData` (transform), `updateApiUrl` (callback)
- `src/config.ts` — env vars: `DATABASE_URL` (required), `API_URL`, `POOL_HOST`, `POOL_PORT`, `LOG_LEVEL`, `MAX_WORKERS`, `BATCH_SIZE`, `BATCH_DELAY_MS`, `RECONCILE_INTERVAL_MS`
- Pool reads `BotInstance` table, reconciles workers automatically

**4. API integration:**
- Add connection strategy in `apps/api/src/connections/strategies/`
- Register in `connections.module.ts` providers
- Add platform constant in `apps/api/src/platform/platform.constants.ts`

**5. Frontend integration:**
- Add auth flow component in `apps/frontend/src/app/dashboard/connections/auth/page.tsx`
- Add platform to `PlatformBadge` and `PlatformFilter` components

### Key Patterns to Follow

- **Connector config:** interface with required fields (token/credentials, instanceId, logger, apiUrl) + optional transport override for tests
- **Action registration:** `registerXxxActions(registry, transport)` — each action has Valibot input schema, handler function
- **Event forwarding:** `registerEventListeners(bot, forwarder, instanceId, logger)` — maps SDK events to platform-agnostic events sent to API
- **Scope filtering:** optional SDK middleware installed before event listeners. Reads `BotScope` (`{ groupIds?: string[], userIds?: string[] }`) from `BotInstance.metadata`. Uses `shouldProcessMessage(scope, chatId, userId)` from `scope-filter.ts`. Currently implemented for Telegram bot only — optional for new connectors.
- **Worker data:** pool passes `{ instanceId, token, apiUrl, logLevel, scope }` via `toWorkerData`
- **All packages are ESM** — use `.js` extensions in imports, Vitest for tests
- **API is CommonJS** (NestJS) — Jest for tests, class-validator DTOs, Swagger decorators

### How to Add a Pool for Existing Connector

1. Ensure connector has `src/worker.ts` calling `runWorker()`
2. Ensure connector class is structurally compatible with `PoolConnector` (exposes `registry`, `connect()`, `disconnect()`, `isConnected()`)
3. Create pool app with `createPoolServer()` config
4. Pool reads from `BotInstance` table — ensure records exist with correct `platform` and `isActive: true`
5. No changes needed to platform-kit — pool infrastructure is generic

### How to Add Actions to Existing Connector

1. Create handler file in `packages/<connector>/src/actions/<category>.ts`
2. Register with `registry.register('action_name', { schema, handler })`
3. Call registration function from `connector.ts` in `registerActions()`
4. Action becomes available via POST /execute `{ action: "action_name", params: { ... } }`

### How to Add Events to Existing Connector

1. Add listener in `packages/<connector>/src/events/listeners.ts`
2. Map SDK event to platform-agnostic event shape
3. Forward via `forwarder.send({ platform, eventType, data, botInstanceId, ... })` using the `FlowTriggerEvent` shape
4. API receives event via EventBus → flow engine triggers matching flows

## Non-Goals

- This skill does not cover flow engine internals
- This skill does not cover Trigger.dev task patterns
- This skill does not cover API module architecture beyond connection strategies
