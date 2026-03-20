# WhatsApp User Connector (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate WhatsApp from the old bot+transport split into a unified `whatsapp-user-connector` package using `platform-kit`, with a thin `apps/whatsapp-user` shell. Delete old packages after verification.

**Architecture:** `packages/whatsapp-user-connector` imports `@flowbot/platform-kit` and composes ActionRegistry + EventForwarder + CircuitBreaker. It contains the Baileys SDK wrapper, action handlers (registered via ActionRegistry with Valibot schemas), event mappers, and QR auth logic. `apps/whatsapp-user` is a ~40 line shell that creates the connector, starts the server via `createConnectorServer()`, and wires shutdown. The dispatcher routes WhatsApp actions through `dispatchActionToCommunity()` instead of the prefix-based path.

**Tech Stack:** `@flowbot/platform-kit`, `@whiskeysockets/baileys@6.7.16`, Valibot 0.42, Pino 9.9, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-unified-connector-architecture-design.md` (Phase 2)

---

## File Map

### New Files

```
packages/whatsapp-user-connector/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                           # Public exports
    connector.ts                       # WhatsAppUserConnector class (composition)
    auth.ts                            # QR auth flow handler
    actions/
      messaging.ts                     # send_message, send_photo, send_video, etc.
      group-admin.ts                   # kick_user, promote_user, demote_user, etc.
      message-mgmt.ts                  # edit_message, delete_message, forward_message
      presence.ts                      # send_presence
      schemas.ts                       # Valibot schemas for all action params
    events/
      mapper.ts                        # Baileys events → FlowTriggerEvent (moved from whatsapp-bot)
      listeners.ts                     # Register Baileys ev.on() → EventForwarder
    sdk/
      baileys-client.ts               # BaileysTransport wrapper (moved from whatsapp-transport)
      auth-state.ts                    # DB-backed session persistence (moved from whatsapp-transport)
      types.ts                         # WhatsApp types (IWhatsAppTransport, etc.)
      fake-client.ts                   # FakeWhatsAppTransport (moved, for testing)
  src/__tests__/
    connector.test.ts                  # Integration: connector creates registry, executes actions
    actions.test.ts                    # Action handler tests (moved + adapted)
    events.test.ts                     # Event mapper tests (moved + adapted)
    schemas.test.ts                    # Valibot schema validation tests

apps/whatsapp-user/
  src/
    main.ts                            # ~40 line thin shell
    config.ts                          # Valibot env schema (moved from whatsapp-bot)
  package.json
  tsconfig.json
  vitest.config.ts
```

### Deleted Files (after verification)

```
packages/whatsapp-transport/           # Entire package — replaced by whatsapp-user-connector/sdk/
apps/whatsapp-bot/                     # Entire app — replaced by apps/whatsapp-user/
```

### Modified Files

```
apps/trigger/src/lib/flow-engine/dispatcher.ts    # Remove whatsapp_* prefix routing, use dispatchActionToCommunity
package.json                                       # Update workspace scripts
.github/workflows/test.yml                         # Rename CI jobs
```

---

## Task 1: `packages/whatsapp-user-connector` Scaffold

**Files:**
- Create: `packages/whatsapp-user-connector/package.json`
- Create: `packages/whatsapp-user-connector/tsconfig.json`
- Create: `packages/whatsapp-user-connector/vitest.config.ts`
- Create: `packages/whatsapp-user-connector/src/index.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@flowbot/whatsapp-user-connector",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20.0.0" },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc",
    "build": "tsc --noEmit false",
    "test": "vitest run"
  },
  "dependencies": {
    "@flowbot/platform-kit": "workspace:*",
    "@whiskeysockets/baileys": "6.7.16",
    "pino": "9.9.0",
    "valibot": "0.42.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "typescript": "^5.9.2",
    "vitest": "^3.2.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` and `vitest.config.ts`**

Same pattern as platform-kit (extends `../../tsconfig.base.json`, ESM, `vitest.config.ts` with globals).

- [ ] **Step 3: Create placeholder `index.ts`**

```typescript
// Connector
export { WhatsAppUserConnector } from './connector.js'
```

- [ ] **Step 4: Install deps**

Run: `pnpm install`

- [ ] **Step 5: Commit**

```bash
git add packages/whatsapp-user-connector/
git commit -m "feat(whatsapp-user-connector): scaffold package"
```

---

## Task 2: Move SDK Layer (Baileys Client + Auth State + Types)

**Files:**
- Create: `packages/whatsapp-user-connector/src/sdk/types.ts` (from `whatsapp-transport/transport/IWhatsAppTransport.ts`)
- Create: `packages/whatsapp-user-connector/src/sdk/baileys-client.ts` (from `whatsapp-transport/transport/BaileysTransport.ts`)
- Create: `packages/whatsapp-user-connector/src/sdk/auth-state.ts` (from `whatsapp-transport/transport/auth-state.ts`)
- Create: `packages/whatsapp-user-connector/src/sdk/fake-client.ts` (from `whatsapp-transport/transport/FakeWhatsAppTransport.ts`)

- [ ] **Step 1: Copy and adapt types**

Copy `packages/whatsapp-transport/src/transport/IWhatsAppTransport.ts` to `packages/whatsapp-user-connector/src/sdk/types.ts`. Keep the interface and all type definitions unchanged.

- [ ] **Step 2: Copy and adapt auth-state**

Copy `packages/whatsapp-transport/src/transport/auth-state.ts` to `packages/whatsapp-user-connector/src/sdk/auth-state.ts`. Update imports to use local paths.

- [ ] **Step 3: Copy and adapt BaileysTransport**

Copy `packages/whatsapp-transport/src/transport/BaileysTransport.ts` to `packages/whatsapp-user-connector/src/sdk/baileys-client.ts`. Update imports:
- `IWhatsAppTransport` → from `./types.js`
- `createDbAuthState` → from `./auth-state.js`
- `WhatsAppTransportError` → replace with `ConnectorError` from `@flowbot/platform-kit`

- [ ] **Step 4: Copy FakeWhatsAppTransport**

Copy to `packages/whatsapp-user-connector/src/sdk/fake-client.ts`. Update imports to local `./types.js`.

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @flowbot/whatsapp-user-connector typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/whatsapp-user-connector/src/sdk/
git commit -m "feat(whatsapp-user-connector): move SDK layer from whatsapp-transport"
```

---

## Task 3: Valibot Action Schemas + Action Handlers via ActionRegistry

**Files:**
- Create: `packages/whatsapp-user-connector/src/actions/schemas.ts`
- Create: `packages/whatsapp-user-connector/src/actions/messaging.ts`
- Create: `packages/whatsapp-user-connector/src/actions/group-admin.ts`
- Create: `packages/whatsapp-user-connector/src/actions/message-mgmt.ts`
- Create: `packages/whatsapp-user-connector/src/actions/presence.ts`
- Create: `packages/whatsapp-user-connector/src/__tests__/actions.test.ts`
- Create: `packages/whatsapp-user-connector/src/__tests__/schemas.test.ts`

- [ ] **Step 1: Create Valibot schemas**

Create `src/actions/schemas.ts` with Valibot schemas for every action's params. Example:

```typescript
import * as v from 'valibot'

export const sendMessageSchema = v.object({
  chatId: v.string(),
  text: v.string(),
})

export const sendPhotoSchema = v.object({
  chatId: v.string(),
  photoUrl: v.string(),
  caption: v.optional(v.string()),
})

export const kickUserSchema = v.object({
  chatId: v.string(),
  userId: v.string(),
})

// ... schemas for all 19 actions
```

- [ ] **Step 2: Write action handler tests**

Test that each action handler registers with the ActionRegistry and can be executed with the FakeWhatsAppTransport:

```typescript
import { describe, it, expect } from 'vitest'
import { ActionRegistry } from '@flowbot/platform-kit'
import { FakeWhatsAppTransport } from '../sdk/fake-client.js'
import { registerMessagingActions } from '../actions/messaging.js'

describe('messaging actions', () => {
  it('registers send_message and executes', async () => {
    const transport = new FakeWhatsAppTransport()
    await transport.connect()
    const registry = new ActionRegistry()
    registerMessagingActions(registry, transport)

    const result = await registry.execute('send_message', { chatId: '123@s.whatsapp.net', text: 'hello' })
    expect(result.success).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Implement action handlers**

Each action file exports a `registerXActions(registry: ActionRegistry, transport: IWhatsAppTransport)` function that registers handlers:

```typescript
// actions/messaging.ts
import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IWhatsAppTransport } from '../sdk/types.js'
import { sendMessageSchema, sendPhotoSchema, ... } from './schemas.js'

export function registerMessagingActions(registry: ActionRegistry, transport: IWhatsAppTransport): void {
  registry.register('send_message', {
    schema: sendMessageSchema,
    handler: async (params) => {
      return transport.sendMessage(params.chatId, params.text)
    },
  })

  registry.register('send_photo', {
    schema: sendPhotoSchema,
    handler: async (params) => {
      return transport.sendMedia(params.chatId, 'image', params.photoUrl, { caption: params.caption })
    },
  })
  // ... all messaging actions
}
```

Same pattern for `group-admin.ts`, `message-mgmt.ts`, `presence.ts`.

- [ ] **Step 4: Write schema validation tests**

```typescript
describe('schemas', () => {
  it('sendMessageSchema requires chatId and text', () => {
    expect(() => v.parse(sendMessageSchema, {})).toThrow()
    expect(() => v.parse(sendMessageSchema, { chatId: '123', text: 'hi' })).not.toThrow()
  })
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @flowbot/whatsapp-user-connector test`
Expected: All action + schema tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/whatsapp-user-connector/src/actions/ packages/whatsapp-user-connector/src/__tests__/
git commit -m "feat(whatsapp-user-connector): add action handlers with Valibot schemas via ActionRegistry"
```

---

## Task 4: Event Mapper + Listeners via EventForwarder

**Files:**
- Create: `packages/whatsapp-user-connector/src/events/mapper.ts` (from `whatsapp-bot/bot/event-mapper.ts`)
- Create: `packages/whatsapp-user-connector/src/events/listeners.ts` (replaces `whatsapp-bot/bot/events.ts`)
- Create: `packages/whatsapp-user-connector/src/__tests__/events.test.ts` (from `whatsapp-bot/__tests__/event-mapper.test.ts`)

- [ ] **Step 1: Move event mapper**

Copy `apps/whatsapp-bot/src/bot/event-mapper.ts` to `packages/whatsapp-user-connector/src/events/mapper.ts`. Change the `FlowTriggerEvent` type import to use `@flowbot/platform-kit`:

```typescript
import type { FlowTriggerEvent } from '@flowbot/platform-kit'
```

Remove the local `FlowTriggerEvent` interface definition — use platform-kit's.

- [ ] **Step 2: Create event listeners using EventForwarder**

Create `packages/whatsapp-user-connector/src/events/listeners.ts`:

```typescript
import type { IWhatsAppTransport } from '../sdk/types.js'
import type { EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import { mapMessageUpsert, mapGroupParticipantsUpdate, mapGroupsUpdate, mapPresenceUpdate } from './mapper.js'

export function registerEventListeners(
  transport: IWhatsAppTransport,
  forwarder: EventForwarder,
  botInstanceId: string,
  logger: Logger,
): void {
  const sock = transport.getClient() as any
  if (!sock?.ev) {
    logger.warn('Transport client has no event emitter — events will not be forwarded')
    return
  }

  sock.ev.on('messages.upsert', async (upsert: any) => {
    try {
      const events = mapMessageUpsert(upsert, botInstanceId)
      for (const event of events) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle messages.upsert')
    }
  })

  // Same for group-participants.update, groups.update, presence.update
  // ...
}
```

Key difference from old `events.ts`: uses `EventForwarder.send()` instead of manual `fetch()`.

- [ ] **Step 3: Move and adapt tests**

Copy `apps/whatsapp-bot/src/__tests__/event-mapper.test.ts` to `packages/whatsapp-user-connector/src/__tests__/events.test.ts`. Update imports to point to `../events/mapper.js`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @flowbot/whatsapp-user-connector test`

- [ ] **Step 5: Commit**

```bash
git add packages/whatsapp-user-connector/src/events/ packages/whatsapp-user-connector/src/__tests__/events.test.ts
git commit -m "feat(whatsapp-user-connector): add event mapper and listeners via EventForwarder"
```

---

## Task 5: WhatsAppUserConnector Class + Auth

**Files:**
- Create: `packages/whatsapp-user-connector/src/connector.ts`
- Create: `packages/whatsapp-user-connector/src/auth.ts`
- Create: `packages/whatsapp-user-connector/src/__tests__/connector.test.ts`
- Modify: `packages/whatsapp-user-connector/src/index.ts`

- [ ] **Step 1: Create connector class**

```typescript
import { ActionRegistry, EventForwarder, CircuitBreaker } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import { BaileysTransport } from './sdk/baileys-client.js'
import type { IWhatsAppTransport } from './sdk/types.js'
import { registerMessagingActions } from './actions/messaging.js'
import { registerGroupAdminActions } from './actions/group-admin.js'
import { registerMessageMgmtActions } from './actions/message-mgmt.js'
import { registerPresenceActions } from './actions/presence.js'
import { registerEventListeners } from './events/listeners.js'

export interface WhatsAppUserConnectorConfig {
  connectionId: string
  botInstanceId: string
  prisma: unknown  // duck-typed PrismaLike
  logger: Logger
  apiUrl: string
}

export class WhatsAppUserConnector {
  readonly registry = new ActionRegistry()
  private readonly transport: IWhatsAppTransport
  private readonly breaker: CircuitBreaker
  private readonly forwarder: EventForwarder
  private readonly logger: Logger
  private readonly config: WhatsAppUserConnectorConfig

  constructor(config: WhatsAppUserConnectorConfig) {
    this.config = config
    this.logger = config.logger

    this.transport = new BaileysTransport({
      connectionId: config.connectionId,
      prisma: config.prisma,
      logger: config.logger,
    })

    this.breaker = new CircuitBreaker(
      this.registry.execute.bind(this.registry),
      {},
      config.logger,
    )

    this.forwarder = new EventForwarder({
      apiUrl: config.apiUrl,
      logger: config.logger,
    })

    this.registerActions()
  }

  async connect(): Promise<void> {
    await this.transport.connect()
    registerEventListeners(this.transport, this.forwarder, this.config.botInstanceId, this.logger)
    this.logger.info('WhatsApp user connector connected')
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect()
    this.logger.info('WhatsApp user connector disconnected')
  }

  isConnected(): boolean {
    return this.transport.isConnected()
  }

  getTransport(): IWhatsAppTransport {
    return this.transport
  }

  private registerActions(): void {
    registerMessagingActions(this.registry, this.transport)
    registerGroupAdminActions(this.registry, this.transport)
    registerMessageMgmtActions(this.registry, this.transport)
    registerPresenceActions(this.registry, this.transport)
  }
}
```

- [ ] **Step 2: Create auth handler**

Move QR auth logic from `apps/whatsapp-bot/src/server/qr-auth.ts` to `packages/whatsapp-user-connector/src/auth.ts`. Adapt to work with the connector's transport.

- [ ] **Step 3: Write connector test**

```typescript
import { describe, it, expect } from 'vitest'
import { WhatsAppUserConnector } from '../connector.js'

// Test with mock/fake transport that the connector:
// - Creates an ActionRegistry with all expected actions registered
// - Can execute actions via the registry
// - Reports health status
```

- [ ] **Step 4: Update index.ts exports**

Export `WhatsAppUserConnector`, `WhatsAppUserConnectorConfig`, auth handler, SDK types.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @flowbot/whatsapp-user-connector test`

- [ ] **Step 6: Commit**

```bash
git add packages/whatsapp-user-connector/
git commit -m "feat(whatsapp-user-connector): add WhatsAppUserConnector class with auth"
```

---

## Task 6: `apps/whatsapp-user` Thin Shell

**Files:**
- Create: `apps/whatsapp-user/package.json`
- Create: `apps/whatsapp-user/tsconfig.json`
- Create: `apps/whatsapp-user/vitest.config.ts`
- Create: `apps/whatsapp-user/src/main.ts`
- Create: `apps/whatsapp-user/src/config.ts` (from `whatsapp-bot/config.ts`)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@flowbot/whatsapp-user",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "dev": "tsx watch ./src/main.ts",
    "start": "tsx ./src/main.ts",
    "typecheck": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@flowbot/whatsapp-user-connector": "workspace:*",
    "@flowbot/platform-kit": "workspace:*",
    "@flowbot/db": "workspace:*",
    "pino": "9.9.0",
    "pino-pretty": "13.0.0",
    "tsx": "4.20.4",
    "valibot": "0.42.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "typescript": "^5.9.2",
    "vitest": "^3.2.1"
  }
}
```

- [ ] **Step 2: Create config.ts**

Copy from `apps/whatsapp-bot/src/config.ts`. Same env vars: `WA_CONNECTION_ID`, `WA_BOT_INSTANCE_ID`, `DATABASE_URL`, `API_URL`, `SERVER_HOST`, `SERVER_PORT`, `LOG_LEVEL`, `DEBUG`.

- [ ] **Step 3: Create main.ts (~40 lines)**

```typescript
#!/usr/bin/env tsx

import process from 'node:process'
import { PrismaClient } from '@flowbot/db'
import { createConnectorServer, createServerManager } from '@flowbot/platform-kit'
import { WhatsAppUserConnector } from '@flowbot/whatsapp-user-connector'
import { createConfigFromEnvironment } from './config.js'
import { pino } from 'pino'

const config = createConfigFromEnvironment()
const logger = pino({ level: config.logLevel })
const prisma = new PrismaClient()

const connector = new WhatsAppUserConnector({
  connectionId: config.waConnectionId,
  botInstanceId: config.waBotInstanceId,
  prisma,
  logger,
  apiUrl: config.apiUrl,
})

const server = createConnectorServer({
  registry: connector.registry,
  logger,
  healthCheck: () => connector.isConnected(),
})

const serverManager = createServerManager(server, {
  host: config.apiServerHost,
  port: config.apiServerPort,
})

async function start() {
  await connector.connect()
  const info = await serverManager.start()
  logger.info({ url: info.url }, 'WhatsApp user connector started')
}

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  await connector.disconnect()
  await serverManager.stop()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

start().catch((err) => { logger.error(err); process.exit(1) })
```

- [ ] **Step 4: Install and verify**

Run: `pnpm install && pnpm --filter @flowbot/whatsapp-user typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/whatsapp-user/
git commit -m "feat(whatsapp-user): add thin shell app using platform-kit connector server"
```

---

## Task 7: Update Dispatcher + Workspace Scripts + CI

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`
- Modify: `package.json` (root)
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Update dispatcher**

In `apps/trigger/src/lib/flow-engine/dispatcher.ts`, simplify WhatsApp routing. Replace the `whatsapp_*` prefix branch (lines ~175-180) to use `dispatchActionToCommunity()` directly. The WhatsApp connector handles all actions via its ActionRegistry — no prefix stripping needed.

Remove:
- `whatsapp_*` prefix check and `action.replace(/^whatsapp_/, '')`
- `whatsappBotInstanceId` from transportConfig

WhatsApp actions now go through the same `dispatchActionToCommunity()` path as any other platform.

- [ ] **Step 2: Update root workspace scripts**

In root `package.json`, replace:
```json
"whatsapp-bot": "pnpm --filter @flowbot/whatsapp-bot",
"whatsapp-transport": "pnpm --filter @flowbot/whatsapp-transport"
```
with:
```json
"whatsapp-user": "pnpm --filter @flowbot/whatsapp-user",
"whatsapp-user-connector": "pnpm --filter @flowbot/whatsapp-user-connector"
```

- [ ] **Step 3: Update CI jobs**

In `.github/workflows/test.yml`, rename WhatsApp jobs:
- `whatsapp-transport-unit` → `whatsapp-user-connector-unit` (run `pnpm whatsapp-user-connector test`)
- `whatsapp-bot-unit` → remove (thin shell has no tests)

- [ ] **Step 4: Verify**

Run: `pnpm whatsapp-user-connector test && pnpm trigger typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/trigger/ package.json .github/
git commit -m "refactor(trigger): simplify WhatsApp dispatch to use community-based routing"
```

---

## Task 8: Delete Old Packages + Final Verification

**Files:**
- Delete: `packages/whatsapp-transport/` (entire directory)
- Delete: `apps/whatsapp-bot/` (entire directory)

- [ ] **Step 1: Run all new tests**

```bash
pnpm whatsapp-user-connector test
pnpm platform-kit test
```

- [ ] **Step 2: Verify no other packages import old packages**

```bash
grep -rn 'whatsapp-transport\|whatsapp-bot' apps/ packages/ --include='*.ts' --include='*.json' | grep -v node_modules | grep -v whatsapp-user
```

Should return no results (except possibly CLAUDE.md/README docs which we update separately).

- [ ] **Step 3: Delete old packages**

```bash
rm -rf packages/whatsapp-transport/
rm -rf apps/whatsapp-bot/
```

- [ ] **Step 4: Reinstall and verify clean**

```bash
pnpm install
pnpm whatsapp-user-connector test
pnpm platform-kit test
pnpm api build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete old whatsapp-transport and whatsapp-bot packages

Replaced by packages/whatsapp-user-connector + apps/whatsapp-user
using the unified platform-kit connector architecture."
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update workspace tables**

Replace `whatsapp-transport` and `whatsapp-bot` entries with `whatsapp-user-connector` and `whatsapp-user`.

- [ ] **Step 2: Update architecture diagrams**

Update mermaid diagrams to show the new connector model for WhatsApp.

- [ ] **Step 3: Update commands section**

Replace `pnpm whatsapp-bot dev` with `pnpm whatsapp-user dev`, etc.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update README and CLAUDE.md for WhatsApp user connector migration"
```
