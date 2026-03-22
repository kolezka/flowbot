---
name: flowbot-connectors
description: Use when implementing a new platform integration, editing or updating an existing connector, reviewing connector PRs, creating a pool, adding actions or events, or asking about the connector architecture. Triggers on connector lifecycle, pool setup, action registration, event forwarding, scope filtering, worker thread patterns, or code review of connector packages.
---

# Flowbot Connector Architecture

## Overview

Three-layer pattern: **connector package** (library) → **thin shell app** (single instance) → **pool app** (multi-instance, optional). All built on `@flowbot/platform-kit`.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  packages/platform-kit                                  │
│  ActionRegistry · EventForwarder · CircuitBreaker       │
│  createConnectorServer() · createPoolServer()           │
│  runWorker()                                            │
└────────┬──────────────────────┬─────────────────────────┘
         │                      │
   ┌─────▼──────────┐   ┌──────▼──────────────┐
   │ Connector Pkg   │   │ Pool App (optional)  │
   │ packages/X-conn │   │ apps/X-pool          │
   │                 │   │                      │
   │ connector.ts    │   │ createPoolServer({   │
   │ sdk/types.ts    │   │   getInstances,      │
   │ sdk/<impl>.ts   │   │   toWorkerData,      │
   │ actions/        │   │ })                   │
   │ events/         │   │                      │
   │ worker.ts       │   │ Reconciles workers   │
   └────────┬────────┘   │ every 30s from DB    │
            │             └──────────────────────┘
   ┌────────▼────────┐
   │ Shell App        │
   │ apps/X           │
   │                  │
   │ createConnector  │
   │ Server({         │
   │   registry,      │
   │   healthCheck,   │
   │ })               │
   └──────────────────┘
```

## Existing Connectors

| Platform | Connector Package | SDK | Apps | Auth |
|----------|------------------|-----|------|------|
| Telegram Bot | `telegram-bot-connector` (grammY) | Bot API | `telegram-bot`, `telegram-bot-pool` | Bot token → getMe |
| Telegram User | `telegram-user-connector` (GramJS) | MTProto | `telegram-user` | Phone/QR → session |
| WhatsApp User | `whatsapp-user-connector` (Baileys 6.7) | Multi-device | `whatsapp-user` | QR → DB keys |
| Discord Bot | `discord-bot-connector` (Discord.js 14) | Gateway | `discord-bot` | Bot token |

## HTTP Endpoints

`createConnectorServer()` exposes:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Status, uptime, memory, action count |
| POST | `/execute` | Execute action: `{ action, params }` |
| POST | `/api/execute-action` | Alias for /execute |
| GET | `/api/actions` | List registered actions |

`createPoolServer()` adds routing by `instanceId` param and auto-selects if only one worker.

## Connector Package Structure

```
packages/<platform>-<type>-connector/
├── src/
│   ├── connector.ts         # Class: registry, connect(), disconnect(), isConnected()
│   ├── worker.ts            # runWorker() entry for pool — REQUIRED even if pool doesn't exist yet
│   ├── sdk/
│   │   ├── types.ts         # Transport interface (enables test injection)
│   │   ├── <impl>.ts        # Real SDK wrapper
│   │   └── fake-transport.ts # Test double
│   ├── actions/
│   │   ├── schemas.ts       # Valibot schemas
│   │   └── messaging.ts     # registerMessagingActions(registry, transport)
│   ├── events/
│   │   ├── mapper.ts        # SDK events → FlowTriggerEvent
│   │   └── listeners.ts     # registerEventListeners(client, forwarder, instanceId, logger)
│   ├── features/            # Optional: built-in command handlers (/start, /help)
│   └── __tests__/           # Vitest: actions, connector, events, scope-filter
├── package.json             # ESM, deps: platform-kit, pino, valibot
└── tsconfig.json            # extends ../../tsconfig.base.json, include: ["src/**/*"]
```

### Critical Details

- **ESM only** — use `.js` extensions in all imports (e.g., `'./sdk/types.js'`)
- **Valibot 0.42** for action schemas, **not** Zod or plain TypeScript types
- **Duck typing** — connectors are structurally compatible with `PoolConnector` (expose `registry`, `connect()`, `disconnect()`, `isConnected()`), but don't explicitly `implements PoolConnector`
- **Transport injection** — constructor takes optional `transport` param for tests; real transport created in `connect()` when absent
- **tsconfig.json must** extend `../../tsconfig.base.json` with `"include": ["src/**/*"]` for path alias resolution
- Verify the new package is picked up by `pnpm-workspace.yaml` glob patterns

## Platform-Kit API Quick Reference

```ts
// Construction
const registry = new ActionRegistry()                              // No args
const forwarder = new EventForwarder({ apiUrl, logger })           // Posts to ${apiUrl}/api/flow/webhook

// Server factories
const server = createConnectorServer({ registry, logger, healthCheck: () => boolean })
const mgr = createServerManager(server, { host, port })            // Returns { start(), stop() }
await mgr.start()                                                  // Binds and listens

// All imported from '@flowbot/platform-kit'
// Types: FlowTriggerEvent, ActionRegistry, EventForwarder, PoolConnector
```

## Key Patterns

### Action Registration

```ts
// packages/<connector>/src/actions/messaging.ts
import type { ActionRegistry } from '@flowbot/platform-kit'
import { sendMessageSchema } from './schemas.js'

export function registerMessagingActions(registry: ActionRegistry, transport: ITransport): void {
  registry.register('send_message', {
    schema: sendMessageSchema,        // Valibot schema
    handler: async (params) =>        // Typed from schema
      transport.sendMessage(params.chatId, params.text),
  })
}
```

Called from `connector.ts` in a private `registerActions()` method during `connect()`.

### Event Forwarding

```ts
import type { FlowTriggerEvent } from '@flowbot/platform-kit'

// FlowTriggerEvent shape:
{
  platform: string
  communityId?: string | null
  accountId?: string
  eventType: string              // e.g., 'message', 'member_joined'
  data?: Record<string, unknown>
  timestamp?: string
  botInstanceId?: string
}
```

`forwarder.send(event)` POSTs to `${apiUrl}/api/flow/webhook`. That's it — one HTTP call.

### Scope Filtering (Optional)

Middleware installed **before** event listeners. Reads `BotScope` from `BotInstance.metadata`:

```ts
{ groupIds?: string[], userIds?: string[] }
```

Uses `shouldProcessMessage(scope, chatId, userId)` from `scope-filter.ts`. Currently Telegram bot only.

### Worker Entry Point (for Pool)

```ts
// packages/<connector>/src/worker.ts
import { runWorker } from '@flowbot/platform-kit'
import { MyConnector } from './connector.js'

runWorker((config) => {
  const logger = pino({ name: `my-bot:${config.instanceId}` })
  return new MyConnector({
    botToken: config['botToken'] as string,
    botInstanceId: config.instanceId,
    apiUrl: config['apiUrl'] as string,
    logger,
  })
})
```

## How to Add a Pool

1. Ensure connector has `src/worker.ts` calling `runWorker()`
2. Create `apps/<platform>-pool/src/main.ts`:

```ts
createPoolServer({
  platform: '<platform>',
  type: 'bot',
  workerScript: '<path-to-connector>/src/worker.ts',
  getInstances: async () =>
    prisma.botInstance.findMany({ where: { platform: '<platform>', isActive: true } }),
  toWorkerData: (instance) => ({
    instanceId: instance.id,
    botToken: instance.botToken ?? '',
    apiUrl: config.apiUrl,
    logLevel: config.logLevel,
    scope: (instance.metadata as Record<string, unknown> | null)?.scope,
  }),
  // ... host, port, logger, reconcileIntervalMs, maxWorkersPerProcess, batchSize, batchDelayMs
})
```

Pool env vars: `DATABASE_URL` (required), `API_URL`, `POOL_HOST`, `POOL_PORT`, `LOG_LEVEL`, `MAX_WORKERS`, `BATCH_SIZE`, `BATCH_DELAY_MS`, `RECONCILE_INTERVAL_MS`.

## API & Frontend Integration

**API** (NestJS, CommonJS, Jest):
1. Add connection strategy in `apps/api/src/connections/strategies/<platform>-connection.strategy.ts`
2. Strategy must call `this.registry.register('connections', this)` in `onModuleInit()`
3. Register strategy in `connections.module.ts` providers
4. Add platform constant in `apps/api/src/platform/platform.constants.ts`

**Frontend** (Next.js, ESM):
1. Add auth flow in `apps/frontend/src/app/dashboard/connections/auth/page.tsx`
2. Add platform to `PlatformBadge` and `PlatformFilter` components

## Flow Engine Dispatch

When the flow engine executes actions targeting a connector, it dispatches via `apps/trigger/src/lib/flow-engine/actions.ts`. Add a case for the new platform's action prefix there. Bot actions route through the connector's `/execute` endpoint; `user_*` prefixed actions route through MTProto connections instead.

## Editing an Existing Connector

When modifying a connector, respect the existing layering:

- **Adding actions** — new file in `actions/`, register in `connector.ts`'s `registerActions()`. Do NOT add actions inline in `connector.ts`.
- **Changing event mapping** — edit `events/mapper.ts`. Mappers return `FlowTriggerEvent | null` (null = skip). Do NOT throw from mappers.
- **Changing connect/disconnect lifecycle** — order matters: transport init → `registerActions()` → `registerEventListeners()` → `transport.start()`. Scope middleware (if present) installs before event listeners.
- **Changing transport** — update `sdk/types.ts` interface first, then impl. Fake transport must stay in sync for tests.
- **Updating the shell app** — only touches `apps/<platform>/src/main.ts` and `config.ts`. Shell must stay thin — no business logic.

## Reviewing Connector Code

### Invariants to Verify

| Invariant | Why |
|-----------|-----|
| Actions registered in `connect()`, not constructor | Transport not available until connect |
| Scope middleware installed before event listeners | Late install means unfiltered events leak through |
| Event mappers filter bot's own messages (`return null`) | Prevents self-triggering loops |
| Mappers return `null` to skip, never throw | Throwing breaks the listener; null filters gracefully |
| `ActionRegistry` rejects duplicate action names | Check across all action files for collisions |
| All imports use `.js` extensions | ESM requirement — `.ts` extensions fail at runtime |
| Valibot `v.picklist()` values use `as const` | Without it, type inference fails silently |
| Transport injection preserved in config interface | Required for testability with fake transports |
| `communityId: null` for DMs is intentional | Flow rules checking communityId won't match DMs — by design |
| Empty/undefined scope means "allow all" | `{}`, `undefined`, and `{ groupIds: [] }` all pass |

### Review Checklist by PR Type

**Connector class changes** — verify lifecycle order, null guards on transport, logger includes `botInstanceId`, all action registration functions still called.

**New action** — schema in `schemas.ts` (Valibot), handler in action file, registration in `registerActions()`, corresponding transport method exists, test covers valid/invalid params + execution.

**Event mapping changes** — mapper returns complete `FlowTriggerEvent` (platform, eventType, botInstanceId required), bot messages filtered, partial objects fetched before mapping (Discord), listener has try-catch with error logging.

**Pool changes** — `toWorkerData` shape matches what `worker.ts` destructures, `getInstances` query filters by platform + `isActive: true`, reconcile interval defaults to 30s.

## Scaffolding

Use the `new-connector` skill to scaffold a new connector package and shell app. It generates all boilerplate files with correct naming conventions.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting `worker.ts` | Always include — pool can't work without it |
| Using `.ts` extensions in imports | ESM requires `.js` extensions |
| Using Zod for schemas | Codebase uses Valibot 0.42 exclusively |
| Registering actions in constructor | Must be in `connect()` after transport is ready |
| Missing `onModuleInit` in API strategy | Strategy won't register with PlatformStrategyRegistry |
| Not verifying `pnpm-workspace.yaml` pickup | New package won't be linked |
| CJS patterns in connector package | Connector packages are ESM; API is CJS |
