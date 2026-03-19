# WhatsApp Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WhatsApp as a fully interactive platform via Baileys, enabling flows, broadcast, messaging, group management, and presence — following the existing transport + bot shell architecture.

**Architecture:** `packages/whatsapp-transport` wraps Baileys behind `IWhatsAppTransport` with circuit breaker and action executors. `apps/whatsapp-bot` is a thin Hono HTTP server that initializes the transport, listens for WhatsApp events, forwards them to the flow engine, and exposes `/api/execute-action`. API strategies register WhatsApp in the platform registry. The flow dispatcher gains `whatsapp_*` routing and `UNIFIED_TO_WHATSAPP` mappings. QR auth flows through the existing Socket.IO gateway.

**Tech Stack:** `@whiskeysockets/baileys@6.7.16`, Hono 4.10, Pino 9.9, Valibot 0.42, Vitest, Prisma 7

**Spec:** `docs/superpowers/specs/2026-03-19-whatsapp-integration-design.md`

---

## File Map

### New Files

```
packages/whatsapp-transport/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                                 # Public exports
    logger.ts                                # Pino logger type re-export
    transport/
      IWhatsAppTransport.ts                  # Interface definition
      BaileysTransport.ts                    # Baileys implementation
      CircuitBreaker.ts                      # Circuit breaker decorator
      FakeWhatsAppTransport.ts               # Test double
      errors.ts                              # WhatsAppTransportError
      auth-state.ts                          # DB-backed Baileys auth adapter
    actions/
      types.ts                               # Action type enum + payload types
      runner.ts                              # Action executor dispatcher
      executors/
        send-message.ts                      # Text messaging
        send-media.ts                        # Media (image, video, audio, doc, sticker)
        group-admin.ts                       # Kick, promote, demote, metadata, invite
        message-mgmt.ts                      # Edit, delete, forward, read history
        presence.ts                          # Presence updates
  src/__tests__/
    whatsapp-transport.test.ts               # Transport unit tests
    circuit-breaker.test.ts                  # Circuit breaker tests
    auth-state.test.ts                       # Auth adapter tests
    action-runner.test.ts                    # Action runner tests

apps/whatsapp-bot/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    main.ts                                  # Entry point
    config.ts                                # Valibot env schema
    logger.ts                                # Pino setup
    database.ts                              # Prisma client factory
    bot/
      index.ts                               # Bot class: init + event registration
      events.ts                              # Baileys event handlers
      event-mapper.ts                        # Baileys events → FlowTriggerEvent
    server/
      index.ts                               # Hono server factory + routes
      actions.ts                             # execute-action handler → transport
      qr-auth.ts                             # QR auth HTTP endpoints (push to API)
  src/__tests__/
    event-mapper.test.ts                     # Event mapping tests
    actions.test.ts                          # Action dispatch tests
    config.test.ts                           # Config validation tests
    events.test.ts                           # Event forwarding tests

apps/api/src/connections/strategies/
  whatsapp-baileys.strategy.ts               # WhatsApp connection auth strategy

apps/api/src/communities/strategies/
  whatsapp-community.strategy.ts             # WhatsApp community strategy
```

### Modified Files

```
packages/db/prisma/schema.prisma:640         # BotInstance.botToken → optional
apps/api/src/bot-config/dto/index.ts         # Make botToken optional in CreateBotInstanceDto
apps/frontend/src/lib/api.ts                 # Make botToken optional in BotInstance interface
package.json:4-11                            # Add workspace scripts
apps/api/src/connections/connections.module.ts:4,9  # Import + register WhatsApp strategy
apps/api/src/communities/communities.module.ts:7,27 # Import + register WhatsApp strategy
apps/api/src/events/event-bus.service.ts     # Add QR auth event channel
apps/api/src/events/ws.gateway.ts:31,56      # Add QR auth room + relay
apps/api/src/events/event-types.ts           # Add QrAuthEvent type
apps/trigger/src/lib/flow-engine/dispatcher.ts:158,503-504,510-530,532-602  # WhatsApp routing
.github/workflows/test.yml:87+              # Add WhatsApp CI jobs
docker-compose.yml                           # Add whatsapp-bot service
```

Note: `pnpm-workspace.yaml` does NOT need changes — the existing `apps/*` and `packages/*` globs already cover the new workspaces.

---

## Task 1: Database Schema + DTO — Make `BotInstance.botToken` Optional

**Files:**
- Modify: `packages/db/prisma/schema.prisma:640`
- Modify: `apps/api/src/bot-config/dto/index.ts` (make `botToken` optional in CreateBotInstanceDto)
- Modify: `apps/frontend/src/lib/api.ts` (make `botToken` optional in BotInstance interface)

- [ ] **Step 1: Update Prisma schema**

In `packages/db/prisma/schema.prisma`, change line 640 from:
```prisma
  botToken    String
```
to:
```prisma
  botToken    String?  // Optional: WhatsApp instances use session-based auth, not tokens
```

- [ ] **Step 2: Generate migration**

Run: `cd /root/Development/tg-allegro && pnpm db prisma:migrate -- --name make-bot-token-optional`
Expected: Migration created successfully.

- [ ] **Step 3: Regenerate Prisma client**

Run: `pnpm db generate && pnpm db build`
Expected: Clean build, no errors.

- [ ] **Step 4: Audit `botToken` references**

Search for all `botToken` accesses across the codebase:
Run: `grep -rn 'botToken' apps/ packages/ --include='*.ts' | grep -v node_modules | grep -v '.d.ts'`

For each reference that accesses `botInstance.botToken` without a null check, add a guard. Common patterns:
- `botInstance.botToken` → `botInstance.botToken ?? ''` or guard with `if (!botInstance.botToken) throw ...`
- Telegram-specific code can safely assert non-null since Telegram instances always have tokens

- [ ] **Step 5: Update `CreateBotInstanceDto`**

In `apps/api/src/bot-config/dto/index.ts`, find the `botToken` field and add `@IsOptional()`:
```typescript
@ApiProperty({ required: false })
@IsOptional()
@IsString()
botToken?: string;
```

- [ ] **Step 6: Update frontend `BotInstance` interface**

In `apps/frontend/src/lib/api.ts`, find the `BotInstance` interface and change `botToken: string` to `botToken?: string | null`. Also update `createBotInstance` method to accept optional `botToken`.

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/ apps/api/src/bot-config/ apps/frontend/src/lib/api.ts
git commit -m "feat(db): make BotInstance.botToken optional for non-token platforms"
```

---

## Task 2: `packages/whatsapp-transport` — Package Scaffold

> **Note:** Unlike `telegram-transport`, `whatsapp-transport` depends on `@flowbot/db` because the Baileys auth state adapter reads/writes session keys directly from PlatformConnection via Prisma. Telegram stores its session in Trigger.dev config instead. `valibot` is included for action payload validation consistency.

**Files:**
- Create: `packages/whatsapp-transport/package.json`
- Create: `packages/whatsapp-transport/tsconfig.json`
- Create: `packages/whatsapp-transport/vitest.config.ts`
- Create: `packages/whatsapp-transport/src/index.ts`
- Create: `packages/whatsapp-transport/src/logger.ts`
- Create: `packages/whatsapp-transport/src/transport/errors.ts`
- Modify: `package.json` (root — add workspace scripts)

- [ ] **Step 1: Create `package.json`**

Create `packages/whatsapp-transport/package.json`:
```json
{
  "name": "@flowbot/whatsapp-transport",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=20.0.0"
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc",
    "build": "tsc --noEmit false",
    "test": "vitest run"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "6.7.16",
    "pino": "9.9.0",
    "@flowbot/db": "workspace:*",
    "valibot": "0.42.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "typescript": "^5.9.2",
    "vitest": "^3.2.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

Create `packages/whatsapp-transport/tsconfig.json`:
```json
{
  "$schema": "https://json-schema.store.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "noEmit": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `packages/whatsapp-transport/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

- [ ] **Step 4: Create `errors.ts`**

Create `packages/whatsapp-transport/src/transport/errors.ts`:
```typescript
export class WhatsAppTransportError extends Error {
  public readonly original: unknown

  constructor(message: string, original?: unknown) {
    super(message)
    this.name = 'WhatsAppTransportError'
    this.original = original

    if (original instanceof Error && original.stack) {
      this.stack = `${this.stack}\nCaused by: ${original.stack}`
    }
  }
}
```

- [ ] **Step 5: Create `logger.ts`**

Create `packages/whatsapp-transport/src/logger.ts`:
```typescript
import type { Logger as PinoLogger } from 'pino'

export type Logger = PinoLogger
```

- [ ] **Step 6: Create placeholder `index.ts`**

Create `packages/whatsapp-transport/src/index.ts`:
```typescript
// Logger type
export type { Logger } from './logger.js'

// Errors
export { WhatsAppTransportError } from './transport/errors.js'
```

- [ ] **Step 7: Add root workspace scripts**

In root `package.json`, add to `scripts`:
```json
"whatsapp-bot": "pnpm --filter @flowbot/whatsapp-bot",
"whatsapp-transport": "pnpm --filter @flowbot/whatsapp-transport"
```

- [ ] **Step 8: Install dependencies**

Run: `cd /root/Development/tg-allegro && pnpm install`
Expected: All dependencies installed, whatsapp-transport linked.

- [ ] **Step 9: Verify typecheck**

Run: `pnpm whatsapp-transport typecheck`
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add packages/whatsapp-transport/ package.json pnpm-lock.yaml
git commit -m "feat(whatsapp-transport): scaffold package with errors, logger, config"
```

---

## Task 3: `IWhatsAppTransport` Interface + `FakeWhatsAppTransport`

**Files:**
- Create: `packages/whatsapp-transport/src/transport/IWhatsAppTransport.ts`
- Create: `packages/whatsapp-transport/src/transport/FakeWhatsAppTransport.ts`
- Create: `packages/whatsapp-transport/src/__tests__/whatsapp-transport.test.ts`
- Modify: `packages/whatsapp-transport/src/index.ts`

- [ ] **Step 1: Write the test**

Create `packages/whatsapp-transport/src/__tests__/whatsapp-transport.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { FakeWhatsAppTransport } from '../src/transport/FakeWhatsAppTransport.js'
import type { IWhatsAppTransport } from '../src/transport/IWhatsAppTransport.js'

describe('FakeWhatsAppTransport', () => {
  it('implements IWhatsAppTransport', () => {
    const transport: IWhatsAppTransport = new FakeWhatsAppTransport()
    expect(transport).toBeDefined()
    expect(transport.connect).toBeTypeOf('function')
    expect(transport.disconnect).toBeTypeOf('function')
    expect(transport.isConnected).toBeTypeOf('function')
    expect(transport.sendMessage).toBeTypeOf('function')
    expect(transport.sendMedia).toBeTypeOf('function')
    expect(transport.editMessage).toBeTypeOf('function')
    expect(transport.deleteMessage).toBeTypeOf('function')
    expect(transport.kickParticipant).toBeTypeOf('function')
    expect(transport.promoteParticipant).toBeTypeOf('function')
    expect(transport.demoteParticipant).toBeTypeOf('function')
    expect(transport.getGroupMetadata).toBeTypeOf('function')
    expect(transport.sendPresenceUpdate).toBeTypeOf('function')
    expect(transport.getClient).toBeTypeOf('function')
  })

  it('starts disconnected', () => {
    const transport = new FakeWhatsAppTransport()
    expect(transport.isConnected()).toBe(false)
  })

  it('connects and disconnects', async () => {
    const transport = new FakeWhatsAppTransport()
    await transport.connect()
    expect(transport.isConnected()).toBe(true)
    await transport.disconnect()
    expect(transport.isConnected()).toBe(false)
  })

  it('sends a message', async () => {
    const transport = new FakeWhatsAppTransport()
    await transport.connect()
    const result = await transport.sendMessage('123@s.whatsapp.net', 'hello')
    expect(result).toEqual({
      key: { remoteJid: '123@s.whatsapp.net', fromMe: true, id: expect.any(String) },
      status: 'sent',
    })
  })

  it('records sent messages', async () => {
    const transport = new FakeWhatsAppTransport()
    await transport.connect()
    await transport.sendMessage('123@s.whatsapp.net', 'hello')
    await transport.sendMessage('456@g.us', 'world')
    expect(transport.sentMessages).toHaveLength(2)
    expect(transport.sentMessages[0]!.jid).toBe('123@s.whatsapp.net')
    expect(transport.sentMessages[1]!.jid).toBe('456@g.us')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm whatsapp-transport test`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Create `IWhatsAppTransport.ts`**

Create `packages/whatsapp-transport/src/transport/IWhatsAppTransport.ts`:
```typescript
export interface WhatsAppMessageKey {
  remoteJid: string
  fromMe: boolean
  id: string
}

export interface WhatsAppMessageResult {
  key: WhatsAppMessageKey
  status: 'sent' | 'pending' | 'error'
}

export interface WhatsAppSendOptions {
  quotedMessageKey?: WhatsAppMessageKey
  ephemeral?: boolean
}

export type WhatsAppMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker'

export interface WhatsAppMediaOptions {
  caption?: string
  fileName?: string
  mimetype?: string
  ptt?: boolean // push-to-talk (voice note)
}

export interface WhatsAppGroupMetadata {
  id: string
  subject: string
  description?: string
  owner?: string
  participants: Array<{
    id: string
    admin: 'admin' | 'superadmin' | null
  }>
  size: number
  creation: number
}

export interface WhatsAppContact {
  fullName: string
  phoneNumber: string
  organization?: string
}

export type WhatsAppPresenceType = 'available' | 'composing' | 'recording' | 'paused' | 'unavailable'

export interface IWhatsAppTransport {
  // Connection
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  onQrCode(callback: (qr: string) => void): void
  onConnectionUpdate(callback: (update: { connection?: string; lastDisconnect?: unknown }) => void): void
  getClient(): unknown

  // Messaging
  sendMessage(jid: string, text: string, options?: WhatsAppSendOptions): Promise<WhatsAppMessageResult>
  sendMedia(jid: string, type: WhatsAppMediaType, urlOrBuffer: string | Buffer, options?: WhatsAppMediaOptions & WhatsAppSendOptions): Promise<WhatsAppMessageResult>
  sendLocation(jid: string, latitude: number, longitude: number): Promise<WhatsAppMessageResult>
  sendContact(jid: string, contact: WhatsAppContact): Promise<WhatsAppMessageResult>
  sendDocument(jid: string, urlOrBuffer: string | Buffer, options?: WhatsAppMediaOptions & WhatsAppSendOptions): Promise<WhatsAppMessageResult>

  // Message management
  editMessage(jid: string, messageKey: WhatsAppMessageKey, newText: string): Promise<WhatsAppMessageResult>
  deleteMessage(jid: string, messageKey: WhatsAppMessageKey): Promise<boolean>
  forwardMessage(fromJid: string, toJid: string, messageKey: WhatsAppMessageKey): Promise<WhatsAppMessageResult>
  readHistory(jid: string, count?: number): Promise<unknown[]>

  // Group admin
  kickParticipant(groupJid: string, userJid: string): Promise<boolean>
  promoteParticipant(groupJid: string, userJid: string): Promise<boolean>
  demoteParticipant(groupJid: string, userJid: string): Promise<boolean>
  getGroupMetadata(groupJid: string): Promise<WhatsAppGroupMetadata>
  getGroupInviteLink(groupJid: string): Promise<string>

  // Presence
  sendPresenceUpdate(jid: string, type: WhatsAppPresenceType): Promise<void>
  getPresence(jid: string): Promise<{ lastKnownPresence: string; lastSeen?: number }>
}
```

- [ ] **Step 4: Create `FakeWhatsAppTransport.ts`**

Create `packages/whatsapp-transport/src/transport/FakeWhatsAppTransport.ts`:
```typescript
import type {
  IWhatsAppTransport,
  WhatsAppContact,
  WhatsAppGroupMetadata,
  WhatsAppMediaOptions,
  WhatsAppMediaType,
  WhatsAppMessageKey,
  WhatsAppMessageResult,
  WhatsAppPresenceType,
  WhatsAppSendOptions,
} from './IWhatsAppTransport.js'

let messageCounter = 0
function generateId(): string {
  return `fake_${++messageCounter}_${Date.now()}`
}

function makeResult(jid: string): WhatsAppMessageResult {
  return {
    key: { remoteJid: jid, fromMe: true, id: generateId() },
    status: 'sent',
  }
}

export interface SentMessage {
  jid: string
  content: string
  type: 'text' | 'media' | 'location' | 'contact' | 'document'
  options?: unknown
}

export class FakeWhatsAppTransport implements IWhatsAppTransport {
  private connected = false
  private qrCallback?: (qr: string) => void
  private connectionCallback?: (update: { connection?: string; lastDisconnect?: unknown }) => void

  public readonly sentMessages: SentMessage[] = []
  public readonly deletedMessages: WhatsAppMessageKey[] = []
  public readonly kickedParticipants: Array<{ groupJid: string; userJid: string }> = []

  async connect(): Promise<void> {
    this.connected = true
    this.connectionCallback?.({ connection: 'open' })
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.connectionCallback?.({ connection: 'close' })
  }

  isConnected(): boolean {
    return this.connected
  }

  onQrCode(callback: (qr: string) => void): void {
    this.qrCallback = callback
  }

  onConnectionUpdate(callback: (update: { connection?: string; lastDisconnect?: unknown }) => void): void {
    this.connectionCallback = callback
  }

  getClient(): unknown {
    return null
  }

  async sendMessage(jid: string, text: string, _options?: WhatsAppSendOptions): Promise<WhatsAppMessageResult> {
    this.sentMessages.push({ jid, content: text, type: 'text' })
    return makeResult(jid)
  }

  async sendMedia(jid: string, type: WhatsAppMediaType, _urlOrBuffer: string | Buffer, options?: WhatsAppMediaOptions & WhatsAppSendOptions): Promise<WhatsAppMessageResult> {
    this.sentMessages.push({ jid, content: options?.caption ?? `[${type}]`, type: 'media', options: { mediaType: type } })
    return makeResult(jid)
  }

  async sendLocation(jid: string, _lat: number, _lng: number): Promise<WhatsAppMessageResult> {
    this.sentMessages.push({ jid, content: '[location]', type: 'location' })
    return makeResult(jid)
  }

  async sendContact(jid: string, contact: WhatsAppContact): Promise<WhatsAppMessageResult> {
    this.sentMessages.push({ jid, content: contact.fullName, type: 'contact' })
    return makeResult(jid)
  }

  async sendDocument(jid: string, _urlOrBuffer: string | Buffer, options?: WhatsAppMediaOptions & WhatsAppSendOptions): Promise<WhatsAppMessageResult> {
    this.sentMessages.push({ jid, content: options?.fileName ?? '[document]', type: 'document' })
    return makeResult(jid)
  }

  async editMessage(jid: string, _key: WhatsAppMessageKey, _newText: string): Promise<WhatsAppMessageResult> {
    return makeResult(jid)
  }

  async deleteMessage(_jid: string, key: WhatsAppMessageKey): Promise<boolean> {
    this.deletedMessages.push(key)
    return true
  }

  async forwardMessage(_from: string, toJid: string, _key: WhatsAppMessageKey): Promise<WhatsAppMessageResult> {
    return makeResult(toJid)
  }

  async readHistory(_jid: string, _count?: number): Promise<unknown[]> {
    return []
  }

  async kickParticipant(groupJid: string, userJid: string): Promise<boolean> {
    this.kickedParticipants.push({ groupJid, userJid })
    return true
  }

  async promoteParticipant(_groupJid: string, _userJid: string): Promise<boolean> {
    return true
  }

  async demoteParticipant(_groupJid: string, _userJid: string): Promise<boolean> {
    return true
  }

  async getGroupMetadata(groupJid: string): Promise<WhatsAppGroupMetadata> {
    return {
      id: groupJid,
      subject: 'Test Group',
      participants: [],
      size: 0,
      creation: Date.now(),
    }
  }

  async getGroupInviteLink(_groupJid: string): Promise<string> {
    return 'https://chat.whatsapp.com/fake-invite-link'
  }

  async sendPresenceUpdate(_jid: string, _type: WhatsAppPresenceType): Promise<void> {}

  async getPresence(_jid: string): Promise<{ lastKnownPresence: string; lastSeen?: number }> {
    return { lastKnownPresence: 'unavailable' }
  }

  // Test helpers
  emitQr(qr: string): void {
    this.qrCallback?.(qr)
  }
}
```

- [ ] **Step 5: Update `index.ts`**

Update `packages/whatsapp-transport/src/index.ts`:
```typescript
// Logger type
export type { Logger } from './logger.js'

// Transport layer
export { type IWhatsAppTransport } from './transport/IWhatsAppTransport.js'
export type {
  WhatsAppMessageKey,
  WhatsAppMessageResult,
  WhatsAppSendOptions,
  WhatsAppMediaType,
  WhatsAppMediaOptions,
  WhatsAppGroupMetadata,
  WhatsAppContact,
  WhatsAppPresenceType,
} from './transport/IWhatsAppTransport.js'
export { FakeWhatsAppTransport } from './transport/FakeWhatsAppTransport.js'
export { WhatsAppTransportError } from './transport/errors.js'
```

- [ ] **Step 6: Run tests**

Run: `pnpm whatsapp-transport test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/whatsapp-transport/
git commit -m "feat(whatsapp-transport): add IWhatsAppTransport interface and FakeWhatsAppTransport"
```

---

## Task 4: Circuit Breaker

**Files:**
- Create: `packages/whatsapp-transport/src/transport/CircuitBreaker.ts`
- Create: `packages/whatsapp-transport/src/__tests__/circuit-breaker.test.ts`
- Modify: `packages/whatsapp-transport/src/index.ts`

- [ ] **Step 1: Write the test**

Create `packages/whatsapp-transport/src/__tests__/circuit-breaker.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitBreaker, CircuitState, CircuitOpenError } from '../src/transport/CircuitBreaker.js'
import { FakeWhatsAppTransport } from '../src/transport/FakeWhatsAppTransport.js'
import type { Logger } from 'pino'

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger

describe('CircuitBreaker', () => {
  let transport: FakeWhatsAppTransport
  let breaker: CircuitBreaker

  beforeEach(() => {
    transport = new FakeWhatsAppTransport()
    breaker = new CircuitBreaker(transport, { failureThreshold: 2, resetTimeoutMs: 100, windowMs: 1000 }, mockLogger)
  })

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('delegates calls to underlying transport', async () => {
    await breaker.connect()
    const result = await breaker.sendMessage('123@s.whatsapp.net', 'hello')
    expect(result.key.remoteJid).toBe('123@s.whatsapp.net')
  })

  it('opens after failure threshold', async () => {
    const failing = new FakeWhatsAppTransport()
    failing.sendMessage = vi.fn().mockRejectedValue(new Error('fail'))
    const failBreaker = new CircuitBreaker(failing, { failureThreshold: 2, resetTimeoutMs: 100, windowMs: 1000 }, mockLogger)

    await expect(failBreaker.sendMessage('x', 'a')).rejects.toThrow('fail')
    await expect(failBreaker.sendMessage('x', 'b')).rejects.toThrow('fail')
    expect(failBreaker.getState()).toBe(CircuitState.OPEN)
    await expect(failBreaker.sendMessage('x', 'c')).rejects.toThrow(CircuitOpenError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm whatsapp-transport test`
Expected: FAIL — CircuitBreaker not found.

- [ ] **Step 3: Implement CircuitBreaker**

Create `packages/whatsapp-transport/src/transport/CircuitBreaker.ts`. Mirror the pattern from `packages/telegram-transport/src/transport/CircuitBreaker.ts`, but wrapping `IWhatsAppTransport` instead of `ITelegramTransport`. Same `execute()` logic, same state machine (CLOSED → OPEN → HALF_OPEN → CLOSED). Delegate all `IWhatsAppTransport` methods through `this.execute(() => this.transport.method(...))`.

The key structure:
- `CircuitState` enum: `CLOSED`, `OPEN`, `HALF_OPEN`
- `CircuitOpenError` extends `Error`
- `CircuitBreakerConfig`: `{ failureThreshold, resetTimeoutMs, windowMs }`
- Class `CircuitBreaker implements IWhatsAppTransport`
- Every method delegates through `this.execute(fn)`
- `execute()` checks state, records failures in sliding window, transitions state

- [ ] **Step 4: Run tests**

Run: `pnpm whatsapp-transport test`
Expected: All tests pass.

- [ ] **Step 5: Update exports in `index.ts`**

Add to `packages/whatsapp-transport/src/index.ts`:
```typescript
export { CircuitBreaker, CircuitState, CircuitOpenError } from './transport/CircuitBreaker.js'
export type { CircuitBreakerConfig } from './transport/CircuitBreaker.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/whatsapp-transport/
git commit -m "feat(whatsapp-transport): add circuit breaker with sliding window failure tracking"
```

---

## Task 5: DB-Backed Auth State Adapter

**Files:**
- Create: `packages/whatsapp-transport/src/transport/auth-state.ts`
- Create: `packages/whatsapp-transport/src/__tests__/auth-state.test.ts`
- Modify: `packages/whatsapp-transport/src/index.ts`

- [ ] **Step 1: Write the test**

Create `packages/whatsapp-transport/src/__tests__/auth-state.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDbAuthState } from '../src/transport/auth-state.js'

const mockPrisma = {
  platformConnection: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

describe('createDbAuthState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads creds from PlatformConnection.credentials', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: { me: { id: '123' } }, keys: {} },
    })

    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    expect(state.creds.me?.id).toBe('123')
  })

  it('returns empty creds when no connection found', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue(null)

    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    expect(state.creds).toEqual({})
  })

  it('saveCreds writes back to DB', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: {}, keys: {} },
    })
    mockPrisma.platformConnection.update.mockResolvedValue({})

    const { state, saveCreds } = await createDbAuthState('conn-id', mockPrisma as any)
    state.creds = { me: { id: '456' } } as any
    await saveCreds()

    expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-id' },
      data: expect.objectContaining({
        credentials: expect.objectContaining({
          creds: expect.objectContaining({ me: { id: '456' } }),
        }),
      }),
    })
  })

  it('keys.set persists signal keys', async () => {
    mockPrisma.platformConnection.findUnique.mockResolvedValue({
      credentials: { creds: {}, keys: {} },
    })
    mockPrisma.platformConnection.update.mockResolvedValue({})

    const { state } = await createDbAuthState('conn-id', mockPrisma as any)
    await state.keys.set({ 'pre-key': { '1': 'key-data' } })

    expect(mockPrisma.platformConnection.update).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm whatsapp-transport test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement auth state adapter**

Create `packages/whatsapp-transport/src/transport/auth-state.ts`:
```typescript
import type { PrismaClient } from '@flowbot/db'

interface AuthState {
  creds: Record<string, unknown>
  keys: {
    get(type: string, ids: string[]): Promise<Record<string, unknown>>
    set(data: Record<string, Record<string, unknown>>): Promise<void>
  }
}

export async function createDbAuthState(
  connectionId: string,
  prisma: PrismaClient,
): Promise<{ state: AuthState; saveCreds: () => Promise<void> }> {
  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
    select: { credentials: true },
  })

  const stored = (connection?.credentials as Record<string, unknown>) ?? {}
  const creds = (stored.creds as Record<string, unknown>) ?? {}
  const keyStore = (stored.keys as Record<string, Record<string, unknown>>) ?? {}

  async function writeKeys(): Promise<void> {
    await prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        credentials: { creds, keys: keyStore },
      },
    })
  }

  const state: AuthState = {
    creds,
    keys: {
      async get(type: string, ids: string[]): Promise<Record<string, unknown>> {
        const typeStore = keyStore[type] ?? {}
        const result: Record<string, unknown> = {}
        for (const id of ids) {
          if (typeStore[id] !== undefined) {
            result[id] = typeStore[id]
          }
        }
        return result
      },
      async set(data: Record<string, Record<string, unknown>>): Promise<void> {
        for (const [type, entries] of Object.entries(data)) {
          if (!keyStore[type]) keyStore[type] = {}
          for (const [id, value] of Object.entries(entries)) {
            if (value) {
              keyStore[type]![id] = value
            } else {
              delete keyStore[type]![id]
            }
          }
        }
        await writeKeys()
      },
    },
  }

  const saveCreds = async (): Promise<void> => {
    await prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        credentials: { creds: state.creds, keys: keyStore },
      },
    })
  }

  return { state, saveCreds }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm whatsapp-transport test`
Expected: All tests pass.

- [ ] **Step 5: Export from index**

Add to `packages/whatsapp-transport/src/index.ts`:
```typescript
export { createDbAuthState } from './transport/auth-state.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/whatsapp-transport/
git commit -m "feat(whatsapp-transport): add DB-backed Baileys auth state adapter"
```

---

## Task 6: Action Types + Runner + Executors

**Files:**
- Create: `packages/whatsapp-transport/src/actions/types.ts`
- Create: `packages/whatsapp-transport/src/actions/runner.ts`
- Create: `packages/whatsapp-transport/src/actions/executors/send-message.ts`
- Create: `packages/whatsapp-transport/src/actions/executors/send-media.ts`
- Create: `packages/whatsapp-transport/src/actions/executors/group-admin.ts`
- Create: `packages/whatsapp-transport/src/actions/executors/message-mgmt.ts`
- Create: `packages/whatsapp-transport/src/actions/executors/presence.ts`
- Create: `packages/whatsapp-transport/src/__tests__/action-runner.test.ts`
- Modify: `packages/whatsapp-transport/src/index.ts`

- [ ] **Step 1: Write the test**

Create `packages/whatsapp-transport/src/__tests__/action-runner.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { FakeWhatsAppTransport } from '../src/transport/FakeWhatsAppTransport.js'
import { ActionRunner } from '../src/actions/runner.js'
import { ActionType } from '../src/actions/types.js'

describe('ActionRunner', () => {
  it('executes send_message action', async () => {
    const transport = new FakeWhatsAppTransport()
    await transport.connect()
    const runner = new ActionRunner(transport)

    const result = await runner.execute({
      type: ActionType.SEND_MESSAGE,
      jid: '123@s.whatsapp.net',
      text: 'hello world',
    })

    expect(result.success).toBe(true)
    expect(transport.sentMessages).toHaveLength(1)
  })

  it('executes kick_user action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)

    const result = await runner.execute({
      type: ActionType.KICK_USER,
      groupJid: 'group@g.us',
      userJid: 'user@s.whatsapp.net',
    })

    expect(result.success).toBe(true)
    expect(transport.kickedParticipants).toHaveLength(1)
  })

  it('returns error for unknown action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)

    const result = await runner.execute({ type: 'unknown_action' as any })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown action')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm whatsapp-transport test`
Expected: FAIL.

- [ ] **Step 3: Create action types**

Create `packages/whatsapp-transport/src/actions/types.ts` with `ActionType` enum matching the execute-action dispatch table from the spec (send_message, send_photo, send_video, etc.) and typed payload interfaces for each.

- [ ] **Step 4: Create executor files**

Create each executor in `packages/whatsapp-transport/src/actions/executors/`:
- `send-message.ts` — `executeSendMessage(transport, payload)`
- `send-media.ts` — `executeSendMedia(transport, payload)` (handles image/video/audio/doc/sticker/voice)
- `group-admin.ts` — `executeKick`, `executePromote`, `executeDemote`, `executeGetGroupInfo`, `executeGetInviteLink`
- `message-mgmt.ts` — `executeEdit`, `executeDelete`, `executeForward`, `executeReadHistory`
- `presence.ts` — `executeSendPresence`, `executeGetPresence`

Each executor takes `(transport: IWhatsAppTransport, payload: XPayload)` and returns `Promise<ActionResult>`.

- [ ] **Step 5: Create `runner.ts`**

Create `packages/whatsapp-transport/src/actions/runner.ts` that maps `ActionType` → executor function via a switch statement. Returns `{ success: boolean; data?: unknown; error?: string }`.

- [ ] **Step 6: Update `index.ts` exports**

Add action system exports to `packages/whatsapp-transport/src/index.ts`:
```typescript
export { ActionType } from './actions/types.js'
export type { Action } from './actions/types.js'
export { ActionRunner } from './actions/runner.js'
export type { ActionResult } from './actions/runner.js'
```

- [ ] **Step 7: Run tests**

Run: `pnpm whatsapp-transport test`
Expected: All tests pass.

- [ ] **Step 8: Typecheck**

Run: `pnpm whatsapp-transport typecheck`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add packages/whatsapp-transport/
git commit -m "feat(whatsapp-transport): add action types, runner, and executors"
```

---

## Task 7: `BaileysTransport` Implementation

**Files:**
- Create: `packages/whatsapp-transport/src/transport/BaileysTransport.ts`
- Modify: `packages/whatsapp-transport/src/index.ts`

- [ ] **Step 1: Implement `BaileysTransport`**

Create `packages/whatsapp-transport/src/transport/BaileysTransport.ts`. This is the real Baileys implementation of `IWhatsAppTransport`.

Key patterns:
- Constructor takes `{ authState, logger }` (auth state from `createDbAuthState`)
- `connect()` calls `makeWASocket()` from Baileys with the auth state
- Registers `ev.on('creds.update', saveCreds)` for auto-persistence
- Each method wraps Baileys API calls, catches errors, wraps in `WhatsAppTransportError`
- `onQrCode()` hooks into `ev.on('connection.update')` and extracts QR from `qr` field
- `getClient()` returns the raw WASocket instance

Reference Baileys docs for the exact API: `@whiskeysockets/baileys` README and types.

- [ ] **Step 2: Export from `index.ts`**

Add to `packages/whatsapp-transport/src/index.ts`:
```typescript
export { BaileysTransport } from './transport/BaileysTransport.js'
```

- [ ] **Step 3: Typecheck**

Run: `pnpm whatsapp-transport typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/whatsapp-transport/
git commit -m "feat(whatsapp-transport): add BaileysTransport implementation"
```

Note: Integration testing with a real WhatsApp account is manual. Unit tests use `FakeWhatsAppTransport`.

---

## Task 8: `apps/whatsapp-bot` — Package Scaffold + Config

**Files:**
- Create: `apps/whatsapp-bot/package.json`
- Create: `apps/whatsapp-bot/tsconfig.json`
- Create: `apps/whatsapp-bot/vitest.config.ts`
- Create: `apps/whatsapp-bot/src/config.ts`
- Create: `apps/whatsapp-bot/src/logger.ts`
- Create: `apps/whatsapp-bot/src/database.ts`
- Create: `apps/whatsapp-bot/src/__tests__/config.test.ts`

- [ ] **Step 1: Create `package.json`**

Create `apps/whatsapp-bot/package.json`:
```json
{
  "name": "@flowbot/whatsapp-bot",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "lint": "eslint .",
    "format": "eslint . --fix",
    "typecheck": "tsc",
    "build": "tsc --noEmit false",
    "dev": "tsx watch ./src/main.ts",
    "start": "tsx ./src/main.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@flowbot/whatsapp-transport": "workspace:*",
    "@flowbot/db": "workspace:*",
    "@hono/node-server": "1.14.2",
    "hono": "4.10.3",
    "pino": "9.9.0",
    "pino-pretty": "13.0.0",
    "tsx": "4.20.4",
    "valibot": "0.42.1"
  },
  "devDependencies": {
    "@antfu/eslint-config": "4.12.0",
    "@types/node": "^22.15.21",
    "eslint": "^9.27.0",
    "typescript": "^5.9.2",
    "vitest": "^3.2.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`, `vitest.config.ts`**

Same structure as `packages/whatsapp-transport/tsconfig.json` (extends `../../tsconfig.base.json`, ESM).
Same `vitest.config.ts` structure.

- [ ] **Step 3: Create `config.ts`**

Create `apps/whatsapp-bot/src/config.ts` — Valibot schema for env vars:
```typescript
import process from 'node:process'
import * as v from 'valibot'

const configSchema = v.object({
  waConnectionId: v.pipe(v.string(), v.minLength(1)),
  waBotInstanceId: v.pipe(v.string(), v.minLength(1)),
  databaseUrl: v.string(),
  apiServerHost: v.optional(v.string(), '0.0.0.0'),
  apiServerPort: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '3004'),
  apiUrl: v.optional(v.string(), 'http://localhost:3000'),
  logLevel: v.optional(v.pipe(v.string(), v.picklist(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])), 'info'),
  debug: v.optional(v.pipe(v.string(), v.transform(JSON.parse), v.boolean()), 'false'),
})

export type Config = v.InferOutput<typeof configSchema>

// ... include the same toCamelCase + createConfigFromEnvironment pattern from telegram-bot
```

- [ ] **Step 4: Create `logger.ts` and `database.ts`**

Mirror `apps/telegram-bot/src/logger.ts` and `apps/telegram-bot/src/database.ts` patterns exactly.

- [ ] **Step 5: Write config test**

Create `apps/whatsapp-bot/src/__tests__/config.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
// Test that config validates required fields and rejects missing ones
```

- [ ] **Step 6: Install deps and verify**

Run: `pnpm install && pnpm whatsapp-bot typecheck`
Expected: Clean install and typecheck.

- [ ] **Step 7: Commit**

```bash
git add apps/whatsapp-bot/ pnpm-lock.yaml
git commit -m "feat(whatsapp-bot): scaffold package with config, logger, database"
```

---

## Task 9: Event Mapper

**Files:**
- Create: `apps/whatsapp-bot/src/bot/event-mapper.ts`
- Create: `apps/whatsapp-bot/src/__tests__/event-mapper.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/whatsapp-bot/src/__tests__/event-mapper.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { mapMessageUpsert, mapGroupParticipantsUpdate } from '../src/bot/event-mapper.js'

describe('mapMessageUpsert', () => {
  it('maps a text message to FlowTriggerEvent', () => {
    const event = mapMessageUpsert(
      {
        messages: [{
          key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg1' },
          message: { conversation: 'hello' },
          pushName: 'Alice',
          messageTimestamp: 1234567890,
        }],
        type: 'notify',
      },
      'bot-instance-id',
    )

    expect(event).toHaveLength(1)
    expect(event[0]).toEqual({
      platform: 'whatsapp',
      communityId: 'group@g.us',
      accountId: expect.any(String),
      eventType: 'message_received',
      data: expect.objectContaining({
        text: 'hello',
        isDirectMessage: false,
      }),
      timestamp: expect.any(String),
      botInstanceId: 'bot-instance-id',
    })
  })

  it('sets communityId to null for DMs', () => {
    const event = mapMessageUpsert(
      {
        messages: [{
          key: { remoteJid: '123@s.whatsapp.net', fromMe: false, id: 'msg2' },
          message: { conversation: 'hi' },
          pushName: 'Bob',
          messageTimestamp: 1234567890,
        }],
        type: 'notify',
      },
      'bot-instance-id',
    )

    expect(event[0]!.communityId).toBeNull()
    expect(event[0]!.data.isDirectMessage).toBe(true)
  })
})

describe('mapGroupParticipantsUpdate', () => {
  it('maps add action to member_join', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'group@g.us', participants: ['123@s.whatsapp.net'], action: 'add' },
      'bot-instance-id',
    )

    expect(events).toHaveLength(1)
    expect(events[0]!.eventType).toBe('member_join')
    expect(events[0]!.communityId).toBe('group@g.us')
  })

  it('maps remove action to member_leave', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'group@g.us', participants: ['123@s.whatsapp.net'], action: 'remove' },
      'bot-instance-id',
    )
    expect(events[0]!.eventType).toBe('member_leave')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm whatsapp-bot test`
Expected: FAIL.

- [ ] **Step 3: Implement `event-mapper.ts`**

Create `apps/whatsapp-bot/src/bot/event-mapper.ts` that:
- Exports `mapMessageUpsert()` — converts Baileys `messages.upsert` to `FlowTriggerEvent[]`
- Exports `mapGroupParticipantsUpdate()` — converts `group-participants.update` to events
- Exports `mapGroupsUpdate()` — converts `groups.update` to events
- Exports `mapPresenceUpdate()` — converts `presence.update` to events
- Detects DMs by checking if `remoteJid` ends with `@s.whatsapp.net` (user) vs `@g.us` (group)
- Sets `communityId: null` for DMs, `data.isDirectMessage: true`

- [ ] **Step 4: Run tests**

Run: `pnpm whatsapp-bot test`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add apps/whatsapp-bot/
git commit -m "feat(whatsapp-bot): add event mapper for Baileys → FlowTriggerEvent"
```

---

## Task 10: Bot HTTP Server + Action Handler

**Files:**
- Create: `apps/whatsapp-bot/src/server/index.ts`
- Create: `apps/whatsapp-bot/src/server/actions.ts`
- Create: `apps/whatsapp-bot/src/server/qr-auth.ts`
- Create: `apps/whatsapp-bot/src/__tests__/actions.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/whatsapp-bot/src/__tests__/actions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { FakeWhatsAppTransport } from '@flowbot/whatsapp-transport'
import { handleAction } from '../src/server/actions.js'

describe('handleAction', () => {
  it('dispatches send_message to transport', async () => {
    const transport = new FakeWhatsAppTransport()
    await transport.connect()

    const result = await handleAction(transport, 'send_message', {
      chatId: '123@s.whatsapp.net',
      text: 'hello',
    })

    expect(result.success).toBe(true)
    expect(transport.sentMessages).toHaveLength(1)
  })

  it('dispatches kick_user to transport', async () => {
    const transport = new FakeWhatsAppTransport()

    const result = await handleAction(transport, 'kick_user', {
      chatId: 'group@g.us',
      userId: 'user@s.whatsapp.net',
    })

    expect(result.success).toBe(true)
    expect(transport.kickedParticipants).toHaveLength(1)
  })

  it('returns error for unknown action', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'unknown', {})
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm whatsapp-bot test`
Expected: FAIL.

- [ ] **Step 3: Implement `actions.ts`**

Create `apps/whatsapp-bot/src/server/actions.ts`:
- `handleAction(transport: IWhatsAppTransport, action: string, params: Record<string, unknown>)` — switch on action name, delegate to transport methods
- Maps action names to transport calls (same table as spec Section 2)
- Returns `{ success: boolean; result?: unknown; error?: string }`

- [ ] **Step 4: Implement `qr-auth.ts`**

Create `apps/whatsapp-bot/src/server/qr-auth.ts`:
- `POST /api/qr-auth/start` — accepts `{ connectionId }`, triggers QR generation
- When QR is generated, pushes to API via `POST {apiUrl}/api/connections/:id/qr-update` with `{ connectionId, qr }` or `{ connectionId, status: 'connected', pushName, phoneNumber }`

- [ ] **Step 5: Implement `server/index.ts`**

Create `apps/whatsapp-bot/src/server/index.ts`:
- Hono app with routes: `GET /health`, `POST /api/execute-action`, `POST /api/qr-auth/start`
- `/health` returns `{ status, uptime, memory, connection: isConnected }`
- `/api/execute-action` validates body, calls `handleAction()`
- Same pattern as `apps/telegram-bot/src/server/index.ts`

- [ ] **Step 6: Run tests**

Run: `pnpm whatsapp-bot test`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add apps/whatsapp-bot/
git commit -m "feat(whatsapp-bot): add HTTP server with execute-action and QR auth endpoints"
```

---

## Task 11: Bot Entrypoint + Event Wiring

**Files:**
- Create: `apps/whatsapp-bot/src/bot/index.ts`
- Create: `apps/whatsapp-bot/src/bot/events.ts`
- Create: `apps/whatsapp-bot/src/main.ts`

- [ ] **Step 1: Create `bot/events.ts`**

Registers Baileys event listeners:
- `ev.on('messages.upsert')` → `mapMessageUpsert()` → forward to API via `POST {apiUrl}/api/flow/webhook`
- `ev.on('group-participants.update')` → `mapGroupParticipantsUpdate()` → forward
- `ev.on('groups.update')` → `mapGroupsUpdate()` → forward
- `ev.on('presence.update')` → `mapPresenceUpdate()` → forward

Each handler wraps in try/catch and logs errors.

- [ ] **Step 2: Create `bot/index.ts`**

Bot factory function:
```typescript
export async function createWhatsAppBot(config: Config, deps: { transport, logger, prisma }) {
  // Register event listeners
  // Return { transport, start, stop }
}
```

- [ ] **Step 3: Create `main.ts`**

Entry point following `apps/telegram-bot/src/main.ts` pattern:
1. Load config via `createConfigFromEnvironment()`
2. Create logger, prisma
3. Load PlatformConnection from DB
4. Create `BaileysTransport` with `createDbAuthState(connectionId, prisma)`
5. Wrap in `CircuitBreaker`
6. Register event listeners
7. Call `transport.connect()` (will trigger QR if no session)
8. Start Hono server
9. Send heartbeat to API
10. Register shutdown handlers

- [ ] **Step 4: Write event forwarding test**

Create `apps/whatsapp-bot/src/__tests__/events.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
// Test that registerEventListeners calls transport.onQrCode, registers message handlers,
// and that message handlers call fetch() to forward events to the API
```

Test that:
- `messages.upsert` handler calls `fetch(apiUrl + '/api/flow/webhook')` with correct FlowTriggerEvent payload
- `group-participants.update` handler forwards member_join/member_leave events
- Errors in event handlers are caught and logged, not thrown

- [ ] **Step 5: Run tests**

Run: `pnpm whatsapp-bot test`
Expected: All pass.

- [ ] **Step 6: Typecheck**

Run: `pnpm whatsapp-bot typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/whatsapp-bot/
git commit -m "feat(whatsapp-bot): add bot entrypoint with event wiring and transport lifecycle"
```

---

## Task 12: API Strategies — WhatsApp Connection + Community

**Files:**
- Create: `apps/api/src/connections/strategies/whatsapp-baileys.strategy.ts`
- Create: `apps/api/src/communities/strategies/whatsapp-community.strategy.ts`
- Modify: `apps/api/src/connections/connections.module.ts`
- Modify: `apps/api/src/communities/communities.module.ts`

- [ ] **Step 1: Create `whatsapp-baileys.strategy.ts`**

Create `apps/api/src/connections/strategies/whatsapp-baileys.strategy.ts`:
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  IPlatformStrategy,
  PlatformStrategyRegistry,
} from '../../platform/strategy-registry.service';
import { PLATFORMS } from '../../platform/platform.constants';

@Injectable()
export class WhatsAppBaileysStrategy implements IPlatformStrategy, OnModuleInit {
  readonly platform = PLATFORMS.WHATSAPP;

  constructor(private readonly registry: PlatformStrategyRegistry) {}

  onModuleInit(): void {
    this.registry.register('connections', this);
  }
}
```

- [ ] **Step 2: Create `whatsapp-community.strategy.ts`**

Create `apps/api/src/communities/strategies/whatsapp-community.strategy.ts`:
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  IPlatformStrategy,
  PlatformStrategyRegistry,
} from '../../platform/strategy-registry.service';
import { PLATFORMS } from '../../platform/platform.constants';

@Injectable()
export class WhatsAppCommunityStrategy implements IPlatformStrategy, OnModuleInit {
  readonly platform = PLATFORMS.WHATSAPP;

  constructor(private readonly registry: PlatformStrategyRegistry) {}

  onModuleInit(): void {
    this.registry.register('communities', this);
  }
}
```

- [ ] **Step 3: Register in `connections.module.ts`**

In `apps/api/src/connections/connections.module.ts`, add import and provider:
```typescript
import { WhatsAppBaileysStrategy } from './strategies/whatsapp-baileys.strategy';
// ...
providers: [ConnectionsService, TelegramMtprotoStrategy, DiscordOauthStrategy, WhatsAppBaileysStrategy],
```

- [ ] **Step 4: Register in `communities.module.ts`**

In `apps/api/src/communities/communities.module.ts`, add import and provider:
```typescript
import { WhatsAppCommunityStrategy } from './strategies/whatsapp-community.strategy';
// ...add WhatsAppCommunityStrategy to providers array after DiscordCommunityStrategy
```

- [ ] **Step 5: Verify API builds**

Run: `pnpm api build`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/connections/ apps/api/src/communities/
git commit -m "feat(api): add WhatsApp connection and community strategies"
```

---

## Task 13: QR Auth Relay via Socket.IO

**Files:**
- Modify: `apps/api/src/events/event-bus.service.ts`
- Modify: `apps/api/src/events/ws.gateway.ts`
- Modify: `apps/api/src/events/event-types.ts` (if exists, else create)
- Create: `apps/api/src/connections/qr-auth.controller.ts` (new endpoint for bot to push QR updates)

- [ ] **Step 1: Add QR auth event type**

Check `apps/api/src/events/event-types.ts` for existing types. Add:
```typescript
export interface QrAuthEvent {
  type: 'qr' | 'connected' | 'error' | 'timeout';
  connectionId: string;
  qr?: string;           // base64 QR code
  pushName?: string;
  phoneNumber?: string;
  error?: string;
}
```

- [ ] **Step 2: Add QR relay to `EventBusService`**

Add to `apps/api/src/events/event-bus.service.ts`:
```typescript
emitQrAuth(event: QrAuthEvent): void {
  this.eventEmitter.emit('qr-auth', event);
}

onQrAuth(handler: (event: QrAuthEvent) => void): void {
  this.eventEmitter.on('qr-auth', handler);
}
```

- [ ] **Step 3: Add QR room to `WsGateway`**

In `apps/api/src/events/ws.gateway.ts`:
- In `afterInit()`, add:
```typescript
this.eventBus.onQrAuth((event) => {
  this.server.to(`qr-auth:${event.connectionId}`).emit('qr-auth', event);
});
```
- Update `handleJoin` valid rooms to accept rooms starting with `qr-auth:`:
```typescript
if (validRooms.includes(room) || room.startsWith('qr-auth:')) {
```

- [ ] **Step 4: Create QR auth endpoint**

Create `apps/api/src/connections/qr-auth.controller.ts`:
- `POST /api/connections/:id/qr-update` — receives QR updates from bot, emits via EventBus
- Validates the connection exists and is in `authenticating` state
- On `connected` event: updates PlatformConnection status to `active`, stores metadata

Register in ConnectionsModule.

- [ ] **Step 5: Verify API builds**

Run: `pnpm api build`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/events/ apps/api/src/connections/
git commit -m "feat(api): add QR auth relay via Socket.IO for WhatsApp dashboard auth"
```

---

## Task 14: Flow Dispatcher — WhatsApp Routing

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`

- [ ] **Step 1: Add `UNIFIED_TO_WHATSAPP` mapping**

After `UNIFIED_TO_DISCORD` (line 530), add:
```typescript
const UNIFIED_TO_WHATSAPP: Record<string, string> = {
  unified_send_message: 'send_message',
  unified_send_media: 'send_photo',
  unified_delete_message: 'delete_message',
  unified_ban_user: 'kick_user',        // WhatsApp has no ban, only kick
  unified_kick_user: 'kick_user',
  unified_pin_message: 'send_message',  // WhatsApp has no pin, send as regular message
  unified_send_dm: 'send_message',
  unified_set_role: 'promote_user',
  unified_promote_user: 'promote_user',
  unified_demote_user: 'demote_user',
};
```

- [ ] **Step 2: Update `UnifiedDispatchError.platform` type**

Change line 504 from:
```typescript
platform: 'telegram' | 'discord';
```
to:
```typescript
platform: 'telegram' | 'discord' | 'whatsapp';
```

- [ ] **Step 3: Add `whatsapp_*` prefix routing in `dispatchActions`**

At line 158, change from:
```typescript
const platform = action.startsWith('discord_') ? 'discord' : 'telegram';
```
to:
```typescript
const platform = action.startsWith('discord_')
  ? 'discord'
  : action.startsWith('whatsapp_')
    ? 'whatsapp'
    : 'telegram';
```

- [ ] **Step 4: Add WhatsApp dispatch branch**

First, add `whatsappBotInstanceId?: string` to the `transportConfig` parameter type (mirroring `discordBotInstanceId`).

After the `if (platform === 'discord')` block (around line 167), add:
```typescript
else if (platform === 'whatsapp') {
  const whatsappAction = action.replace(/^whatsapp_/, '');
  const whatsappBotId = transportConfig?.whatsappBotInstanceId ?? transportConfig?.botInstanceId;
  if (whatsappBotId) {
    response = await dispatchViaBotApi(whatsappAction, output, whatsappBotId);
  } else {
    throw new Error(`WhatsApp action '${action}' requires a whatsappBotInstanceId or botInstanceId in transportConfig`);
  }
}
```

- [ ] **Step 5: Add WhatsApp branch in `dispatchUnifiedAction`**

After the Discord block (around line 599), add:
```typescript
if (platform === 'whatsapp' || platform === 'cross_platform') {
  const whatsappAction = UNIFIED_TO_WHATSAPP[action];
  if (whatsappAction) {
    try {
      const waParams: Record<string, unknown> = {
        ...output,
        action: whatsappAction,
        chatId: output.targetChatId,
        userId: output.targetUserId,
        ...(output.whatsappOverrides as Record<string, unknown> ?? {}),
      };
      delete waParams.telegramOverrides;
      delete waParams.discordOverrides;
      delete waParams.whatsappOverrides;
      delete waParams.targetChatId;
      delete waParams.targetUserId;

      const waBotId = transportConfig?.whatsappBotInstanceId ?? transportConfig?.botInstanceId;
      if (!waBotId) {
        throw new Error('WhatsApp dispatch requires whatsappBotInstanceId or botInstanceId');
      }
      const response = await dispatchViaBotApi(whatsappAction, waParams, waBotId);
      results.push({ nodeId: `${nodeId}:whatsapp`, dispatched: true, response });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ nodeId: `${nodeId}:whatsapp`, dispatched: false, error: msg });
    }
  }
}
```

- [ ] **Step 6: Verify trigger typechecks**

Run: `pnpm trigger typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/dispatcher.ts
git commit -m "feat(trigger): add WhatsApp routing, unified dispatch, and UNIFIED_TO_WHATSAPP mapping"
```

---

## Task 15: Frontend — WhatsApp Auth Wizard + PlatformBadge

**Files:**
- Create: `apps/frontend/src/app/dashboard/connections/components/WhatsAppAuthWizard.tsx`
- Modify: PlatformBadge component (find exact path)
- Modify: Connections page to include WhatsApp option in platform picker

- [ ] **Step 1: Find PlatformBadge and connections page**

Run: `grep -rn 'PlatformBadge' apps/frontend/src/ --include='*.tsx' | head -5`
Run: `grep -rn 'platform.*picker\|AddConnection\|platform.*select' apps/frontend/src/ --include='*.tsx' | head -10`

- [ ] **Step 2: Add WhatsApp icon to PlatformBadge**

Add `whatsapp` case to the platform icon mapping (green chat bubble icon).

- [ ] **Step 3: Create `WhatsAppAuthWizard.tsx`**

Implements the dashboard QR auth flow:
1. Calls `POST /api/connections` with `{ platform: "whatsapp", name: "WhatsApp", connectionType: "baileys" }`
2. Calls `POST /api/connections/:id/auth/start`
3. Subscribes to Socket.IO `qr-auth:{connectionId}` room
4. Listens for `qr-auth` events — renders QR on `type: 'qr'`, shows success on `type: 'connected'`
5. Shows retry button on timeout/error

Use existing WebSocket context (`lib/websocket.tsx`) for Socket.IO connection.

- [ ] **Step 4: Register WhatsApp in connections platform picker**

Add `"whatsapp"` option to the platform selector on the connections page.

- [ ] **Step 5: Verify frontend builds**

Run: `pnpm frontend build`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/
git commit -m "feat(frontend): add WhatsApp auth wizard and PlatformBadge icon"
```

---

## Task 16: CI Pipeline

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Add WhatsApp transport test job**

After the `discord-transport-unit` job (around line 70), add:
```yaml
  whatsapp-transport-unit:
    name: WhatsApp Transport Unit Tests (Vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db generate
      - run: pnpm db build
      - run: pnpm whatsapp-transport test
```

- [ ] **Step 2: Add WhatsApp bot test job**

After the new transport job, add:
```yaml
  whatsapp-bot-unit:
    name: WhatsApp Bot Unit Tests (Vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db generate
      - run: pnpm db build
      - run: pnpm whatsapp-bot test
```

- [ ] **Step 3: Add typecheck CI jobs (optional but recommended)**

Add typecheck jobs for both packages, following the same runner pattern.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add WhatsApp transport and bot unit test jobs"
```

---

## Task 17: Docker Compose + Final Verification

- [ ] **Step 1: Add whatsapp-bot to Docker Compose**

In `docker-compose.yml`, add:
```yaml
  whatsapp-bot:
    build: ./apps/whatsapp-bot
    env_file: ./apps/whatsapp-bot/.env
    depends_on:
      - postgres
    ports:
      - "3004:3004"
```

- [ ] **Step 2: Full typecheck across all workspaces**

```bash
pnpm whatsapp-transport typecheck
pnpm whatsapp-bot typecheck
pnpm api build
pnpm trigger typecheck
pnpm frontend build
```

- [ ] **Step 3: Run all tests**

```bash
pnpm whatsapp-transport test
pnpm whatsapp-bot test
pnpm api test
pnpm trigger test
```

- [ ] **Step 4: Verify workspace resolution**

```bash
pnpm install
pnpm ls --filter @flowbot/whatsapp-transport
pnpm ls --filter @flowbot/whatsapp-bot
```

- [ ] **Step 4: Final commit (if any remaining changes)**

```bash
git status
# If clean: done. If not: commit remaining changes.
```
