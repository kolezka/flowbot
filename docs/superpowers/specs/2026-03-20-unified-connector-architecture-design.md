# Unified Connector Architecture Design

**Date:** 2026-03-20
**Status:** Approved
**Approach:** Strangler Fig — migrate one platform at a time

## Problem Statement

The current multi-platform architecture splits each platform into 2-3 separate packages (bot app, transport library, auth client) with inconsistent naming, incompatible interfaces, and significant code duplication. This creates confusion about what each component does, makes adding new platforms expensive (800+ lines copied per platform), and makes the flow dispatcher increasingly complex (658 lines with platform-specific routing).

| Problem | Evidence |
|---------|----------|
| Naming confusion | "transport" = user-account executor, "client" = auth script, "bot" = listener + bot-account executor |
| Code duplication | CircuitBreaker copy-pasted 3 times (802 lines), error classes duplicated, server boilerplate duplicated |
| Interface inconsistency | `banUser()` vs `kickMember()` vs `kickParticipant()` across 3 different transport interfaces |
| Dispatcher complexity | 658 lines with prefix routing, 3 translation tables, platform-specific dispatch functions |
| Scaling cost | Each new platform requires: new transport interface, new CircuitBreaker copy, new bot server, new dispatcher branches |

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Core abstraction | Action handler pattern with Valibot schemas | Dynamic dispatch, no god interface, type-safe at boundaries, already proven in whatsapp-bot |
| Connector model | Two axes: platform x identity (bot/user) | Preserves meaningful distinction while eliminating confusion |
| Deployment | Separate processes per connector | Process isolation, independent restarts, matches current model |
| Package structure | Merge transport into connector | Eliminates the transport/bot split that causes confusion |
| Shared infrastructure | `packages/platform-kit` | Extracts duplicated CircuitBreaker, errors, server factory, action registry |
| Migration strategy | Strangler fig, one platform at a time | Incremental, testable, old code works until replaced |

---

## Section 1: Connector Model — The Two Axes

Every connector lives at an intersection of **platform** and **identity**:

| | Bot Account | User Account |
|---|---|---|
| **Telegram** | `telegram-bot-connector` | `telegram-user-connector` |
| **Discord** | `discord-bot-connector` | `discord-user-connector` (future) |
| **WhatsApp** | (n/a — no bot concept) | `whatsapp-user-connector` |

Each connector is a self-contained unit that:
- **Connects** to one platform with one identity type
- **Listens** for events (if long-running) and forwards them as `FlowTriggerEvent`
- **Executes** actions via a registered handler table
- **Reports** health and capabilities

A connector is split into two parts:
- **`packages/<platform>-<identity>-connector/`** — SDK wrapper, action handlers, event mapper. The library.
- **`apps/<platform>-<identity>/`** — thin shell: loads connector, starts Hono HTTP server, wires shutdown. ~50 lines.

### Naming Convention

`telegram-bot`, `telegram-user`, `whatsapp-user`, `discord-bot`. No "transport", no "client". The name tells you the platform and the identity.

### Auth Scripts

Auth scripts (like `tg-client`) become a feature of the connector itself. `telegram-user-connector` exposes auth methods. The dashboard triggers auth via the API, the API calls the connector's auth endpoint. No separate app needed.

---

## Section 2: `packages/platform-kit` — Shared Infrastructure

Provides everything a connector needs. No connector should reinvent these.

### ActionRegistry

The core abstraction. Connectors register typed action handlers:

```typescript
const registry = new ActionRegistry()

registry.register('send_message', {
  schema: v.object({ chatId: v.string(), text: v.string() }),
  handler: async (params) => {
    const msg = await sdk.sendMessage(params.chatId, params.text)
    return { messageId: msg.id }
  },
})

// Dispatcher calls:
const result = await registry.execute('send_message', { chatId: '123', text: 'hi' })
// → validates params with Valibot, calls handler, wraps errors
```

`registry.getActions()` returns the list of supported actions with their schemas — useful for the flow builder to show/hide nodes per platform.

**Observability:** `ActionRegistry` accepts optional `onExecute(action, duration, success)` and `onError(action, error)` hooks for metrics, tracing, and structured logging. The CircuitBreaker layer uses these hooks — connectors don't need to add observability code manually.

### CircuitBreaker

Generic, parameterized. Wraps any `execute(action, params)` function, not a specific transport interface. One implementation, used by all connectors:

```typescript
const breaker = new CircuitBreaker(registry.execute.bind(registry), config, logger)
const result = await breaker.call('send_message', params)
```

Replaces 3 copy-pasted implementations (802 lines → 1 implementation ~120 lines).

### ConnectorError

Single error class replacing `TransportError` / `WhatsAppTransportError`:

```typescript
class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly original?: unknown,
  ) { ... }
}
```

### createConnectorServer()

Hono server factory. Every connector gets the same HTTP contract:

```
POST /api/execute-action   — { action, params } → { success, data?, error? }
GET  /health               — { status, uptime, memory, connected }
GET  /api/actions           — list of registered action names + schemas
POST /api/auth/start        — initiate auth flow (connector-specific)
POST /api/auth/status       — SSE stream for auth progress (QR codes, multi-step flows)
POST /api/auth/submit-step  — submit auth step (phone code, 2FA password, etc.)
```

**Note:** The `/api/execute-action` path matches the existing convention used by all current bot servers. This ensures backward compatibility during the strangler fig migration — the dispatcher can talk to both old and new connectors without path changes.

**Auth flow support:** The three auth endpoints accommodate different platform auth patterns:
- **WhatsApp QR:** `POST /api/auth/start` → `GET /api/auth/status` (SSE stream of QR codes) → auto-completes on scan
- **Telegram MTProto:** `POST /api/auth/start` (sends phone) → `POST /api/auth/submit-step` (code) → `POST /api/auth/submit-step` (2FA if needed)
- **Discord OAuth:** `POST /api/auth/start` → returns OAuth redirect URL → callback completes

**Security:** Connectors are assumed to run on a private network (not exposed to the internet). The `createConnectorServer()` factory accepts an optional `authMiddleware` parameter for environments that need bearer token validation between services.

One function call:

```typescript
const server = createConnectorServer({
  registry,
  logger,
  healthCheck: () => sdk.isConnected(),
  authMiddleware: config.internalSecret ? bearerAuth(config.internalSecret) : undefined,
})
```

### EventForwarder

Forwards `FlowTriggerEvent` to the API. Handles retries, logging, timeout:

```typescript
const forwarder = new EventForwarder({ apiUrl: config.apiUrl, logger })
await forwarder.send({ platform: 'whatsapp', eventType: 'message_received', ... })
```

### Connector Composition Pattern

Connectors compose platform-kit pieces — no required base class. The canonical pattern:

```typescript
export class WhatsAppUserConnector {
  readonly registry = new ActionRegistry()
  private client: BaileysClient
  private forwarder: EventForwarder

  constructor(deps: { connectionId: string; prisma: PrismaLike; logger: Logger; apiUrl: string }) {
    this.client = new BaileysClient(deps)
    this.forwarder = new EventForwarder({ apiUrl: deps.apiUrl, logger: deps.logger })
    this.registerActions()
  }

  async connect() { await this.client.connect() }
  async disconnect() { await this.client.disconnect() }
  isConnected() { return this.client.isConnected() }

  private registerActions() {
    this.registry.register('send_message', { schema, handler: (p) => this.client.sendMessage(p.chatId, p.text) })
    // ...
  }
}
```

No inheritance hierarchy. Each connector is a standalone class that wires together ActionRegistry + SDK client + EventForwarder.

### What's NOT inside platform-kit

- No platform-specific SDK code (no GramJS, no Baileys, no discord.js)
- No action definitions — those live in connector packages
- No event mapping — that's platform-specific

---

## Section 3: Connector Package Structure

Each connector follows the same internal layout. Using `packages/whatsapp-user-connector` as example:

```
packages/whatsapp-user-connector/
  src/
    index.ts                    # Public exports
    connector.ts                # WhatsAppUserConnector (composition pattern)
    auth.ts                     # QR code auth flow
    actions/
      messaging.ts              # send_message, send_photo, send_video, etc.
      group-admin.ts            # kick_user, promote_user, demote_user, etc.
      message-mgmt.ts           # edit_message, delete_message, forward_message
      presence.ts               # send_presence, get_presence
    events/
      mapper.ts                 # Baileys events → FlowTriggerEvent
      listeners.ts              # Register Baileys ev.on() handlers
    sdk/
      baileys-client.ts         # Baileys wrapper (connect, disconnect, raw SDK)
      auth-state.ts             # DB-backed session persistence
  __tests__/
    connector.test.ts
    actions.test.ts
    events.test.ts
  package.json                  # deps: @flowbot/platform-kit, @whiskeysockets/baileys
```

The corresponding thin app shell:

```
apps/whatsapp-user/
  src/
    main.ts                     # ~50 lines: load config, create connector, start server
    config.ts                   # Valibot env schema
  package.json                  # deps: @flowbot/whatsapp-user-connector, @flowbot/platform-kit
```

**`main.ts` is trivially simple:**

```typescript
const config = createConfigFromEnvironment()
const connector = new WhatsAppUserConnector({ connectionId: config.connectionId, prisma })
const server = createConnectorServer({ registry: connector.registry, logger, ... })
await connector.connect()
await serverManager.start()
```

The same pattern applies to every platform. `telegram-bot-connector` would have `sdk/grammy-client.ts` instead of `sdk/baileys-client.ts`, different actions, different event mappers — but the same structure, same `BaseConnector`, same `ActionRegistry`, same HTTP contract.

---

## Section 4: Dispatcher Simplification

The current dispatcher (658 lines) collapses to ~30 lines. The existing `dispatchActionToCommunity()` function (dispatcher.ts lines 17-66) already implements the target pattern — it resolves community → botInstance → HTTP POST. The refactoring promotes this function to be the **only** dispatch path, deleting all alternatives.

```typescript
async function dispatchAction(
  action: string,
  params: Record<string, unknown>,
  communityId: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    include: { botInstance: { select: { apiUrl: true, isActive: true } } },
  })

  if (!community?.botInstance?.apiUrl || !community.botInstance.isActive) {
    return { success: false, error: 'Bot instance not available' }
  }

  const response = await fetch(`${community.botInstance.apiUrl}/api/execute-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
    signal: AbortSignal.timeout(15_000),
  })

  return response.json()
}
```

### No prefix routing

The dispatcher doesn't know what platform it's talking to. It resolves community → bot instance URL → HTTP POST. The connector handles it or rejects it.

### Unified cross-platform actions

Move from dispatcher to flow engine. When a flow node is `unified_send_message`, the flow engine resolves it into multiple dispatches — one per target community. Each community has its own bot instance, so the dispatcher sends the same action name to each.

### User-account action routing

User-account connectors register themselves as `BotInstance` records with `type: "user-connector"`. The `PlatformConnection` model already has an optional `botInstanceId` FK — user-account connections point to their connector's BotInstance. Routing path:

```
Flow has platformConnectionId
  → PlatformConnection.botInstanceId → BotInstance.apiUrl
  → POST /api/execute-action { action, params }
```

No special `user_*` prefix needed. The flow engine resolves the connection → connector URL and dispatches identically to bot-account actions.

**Schema change:** Add `"user-connector"` as a valid `BotInstance.type` value (currently `"standard" | "manager"`). No new models needed — `BotInstance` already has `apiUrl`, `platform`, `isActive`, and the `PlatformConnection` FK.

### Trigger.dev integration

The current flow-execution task uses in-process GramJS transport via `getTelegramTransport()` for Telegram MTProto dispatch. With the new architecture, all dispatch goes through HTTP to connector processes:

- **Trigger.dev no longer needs GramJS/Baileys dependencies** — the worker becomes a pure orchestrator
- **Retry behavior** — Trigger.dev already retries failed tasks. HTTP connector calls use `AbortSignal.timeout(15_000)`. If a connector is down, the task fails and Trigger.dev retries.
- **Migration path** — During Phase 3, the in-process `getTelegramTransport()` path is kept as fallback. Only removed in Phase 4 once all Telegram actions route through the connector.
- **Latency** — HTTP adds ~1-5ms per action on localhost. Acceptable given that the actions themselves (API calls to Telegram/Discord/WhatsApp) take 100-500ms.

### What gets deleted

- `dispatchToTelegram()` — 200+ lines of Telegram switch statement
- `dispatchViaDiscordBotApi()` / `dispatchViaBotApi()` — redundant HTTP functions
- `dispatchUnifiedAction()` — 100 lines + 3 translation tables
- Prefix routing logic (`action.startsWith('discord_')`, etc.)
- `UNIFIED_TO_TELEGRAM`, `UNIFIED_TO_DISCORD`, `UNIFIED_TO_WHATSAPP` mapping tables
- `whatsappBotInstanceId`, `discordBotInstanceId` fields in transportConfig

---

## Section 5: Migration Order (Strangler Fig)

Four phases, each independently shippable and testable.

### Phase 1: `packages/platform-kit`

Build shared infrastructure with zero platform code:
- `ActionRegistry` + Valibot validation
- `CircuitBreaker` (generic, replaces 3 copies)
- `ConnectorError`
- `BaseConnector` abstract class
- `createConnectorServer()` Hono factory
- `EventForwarder`

**Ship criteria:** Package published, fully unit tested, no platform dependencies.

### Phase 2: WhatsApp user connector (first migration)

WhatsApp is the cleanest candidate — newest code, fewest consumers, cleanest code.

- Create `packages/whatsapp-user-connector` using platform-kit
- Move Baileys SDK, action handlers, event mapper, auth-state from current packages
- Create thin `apps/whatsapp-user` shell (replaces `apps/whatsapp-bot`)
- Update dispatcher to route WhatsApp via new connector
- Delete `packages/whatsapp-transport` and `apps/whatsapp-bot`

**Ship criteria:** All WhatsApp tests pass against new structure, dispatcher works, QR auth works.

### Phase 3: Telegram connectors (two connectors)

- `packages/telegram-bot-connector` — grammY Bot API listener + executor. Replaces `apps/telegram-bot`'s inline switch.
- `packages/telegram-user-connector` — GramJS MTProto executor. Replaces `packages/telegram-transport`. Auth session logic (from `apps/tg-client`) becomes a method on the connector.
- Thin shells: `apps/telegram-bot` (rewritten) and `apps/telegram-user` (replaces `apps/tg-client`)
- Delete `packages/telegram-transport`, old `apps/tg-client`
- Dispatcher loses all Telegram-specific code

**Ship criteria:** Existing Telegram tests pass, flow engine dispatches correctly, MTProto user actions work.

### Phase 4: Discord bot connector + dispatcher cleanup

- `packages/discord-bot-connector` — discord.js listener + executor. Replaces `apps/discord-bot` inline switch + `packages/discord-transport`.
- Thin shell: `apps/discord-bot` (rewritten)
- Delete `packages/discord-transport`
- Dispatcher is now the 30-line version — all platform-specific code removed
- Delete old dispatcher functions, translation tables, prefix routing

**Ship criteria:** Discord works, dispatcher is clean, no old transport packages remain.

### Final State

```
packages/
  platform-kit/                    # Shared: ActionRegistry, CircuitBreaker, server factory
  whatsapp-user-connector/         # Baileys SDK + actions + events
  telegram-bot-connector/          # grammY SDK + actions + events
  telegram-user-connector/         # GramJS SDK + actions + auth
  discord-bot-connector/           # discord.js SDK + actions + events
  db/                              # Prisma (unchanged)
  flow-shared/                     # Node types (unchanged)

apps/
  whatsapp-user/                   # Thin shell (~50 lines)
  telegram-bot/                    # Thin shell (~50 lines)
  telegram-user/                   # Thin shell (~50 lines)
  discord-bot/                     # Thin shell (~50 lines)
  api/                             # NestJS (unchanged)
  frontend/                        # Next.js (unchanged)
  trigger/                         # Trigger.dev (simplified dispatcher)
```

### What's Deleted (Total)

| Deleted | Lines Saved |
|---------|-------------|
| 3 CircuitBreaker copies | ~800 lines → 1 copy in platform-kit |
| 3 error class copies | ~42 lines → 1 in platform-kit |
| 3 transport interfaces | ~340 lines → action registry pattern |
| Inline bot server switch statements | ~1,000 lines → action handler registration |
| Dispatcher platform-specific code | ~600 lines → 30 lines |
| `packages/telegram-transport` | entire package deleted |
| `packages/discord-transport` | entire package deleted |
| `packages/whatsapp-transport` | entire package deleted |
| `apps/tg-client` | merged into telegram-user-connector |
