# Connector Pool Architecture

## Problem

Flowbot is a multi-tenant platform where each user can bring their own Telegram bot token, WhatsApp account, or Discord bot. The current architecture runs one OS process per bot instance (thin shell apps). At 100 users this means 100+ Node.js processes, each consuming ~80MB RAM, plus port management overhead. This does not scale on a single server.

## Solution

Replace N thin shell processes with **4 pool processes** (one per connector type). Each pool manages multiple connector instances using **worker threads** for isolation. A **reconciliation loop** reads desired state from the database and converges toward it — no imperative start/stop API needed.

## Architecture

### Worker Thread Isolation

Each connector runs in its own `worker_thread`. The main thread handles HTTP routing and supervision.

```
Pool Process (e.g. telegram-bot-pool)
├── Main Thread
│   ├── Hono HTTP server (POST /execute, GET /health, etc.)
│   ├── Reconciliation loop (every 30s)
│   └── Worker supervisor (restart on crash)
│
├── Worker Thread [inst_1] — TelegramBotConnector
│   ├── grammY polling / webhook
│   ├── ActionRegistry (per-instance)
│   ├── CircuitBreaker (per-instance)
│   └── EventForwarder → API (direct HTTP from worker)
│
├── Worker Thread [inst_2] — TelegramBotConnector
└── Worker Thread [inst_N] — ...
```

**Why worker threads:**
- Crash isolation: one bad connector kills only its thread, not the pool
- Memory isolation: each worker has its own V8 heap (Baileys at 200MB won't affect others)
- No shared state: connectors are fully independent
- Lightweight: ~2MB overhead per thread vs ~80MB per OS process

**Communication protocol (main ↔ worker):**

| Direction | Message | Purpose |
|-----------|---------|---------|
| Main → Worker | `{ type: 'execute', requestId, action, params }` | Dispatch action |
| Worker → Main | `{ type: 'result', requestId, data }` | Action result |
| Worker → Main | `{ type: 'health', connected, uptime }` | Health report |
| Main → Worker | `{ type: 'shutdown' }` | Graceful stop |

Events (inbound from platform) bypass the main thread entirely — each worker's `EventForwarder` POSTs directly to the API webhook.

### Reconciliation Loop

Each pool process reads desired state from the database every 30 seconds and converges:

```
reconcile():
  desired = DB query: BotInstance WHERE platform = X AND isActive = true
  running = current worker map

  for each desired instance NOT in running:
    start worker (batched, staggered)

  for each running instance NOT in desired:
    stop worker (graceful drain)

  for each running instance:
    update BotInstance.apiUrl = pool's URL
```

**Staggered batch startup** to avoid platform rate limits:

```
BATCH_SIZE = 20 workers
BATCH_DELAY = 1000ms

1000 bots = 50 batches x 1s = 50 seconds total startup
```

**What this solves:**
- Startup recovery: pool restarts, reads DB, recreates all instances
- Self-healing: crashed worker detected by supervisor, reconcile restarts it
- Activation/deactivation: user toggles bot on dashboard → API sets `isActive` → pool converges within 30s
- No new API surface: pool is autonomous, no `/instances/start` endpoint needed

### Pool Server Factory (platform-kit)

Generic `createPoolServer<T>()` in `packages/platform-kit` so each pool app is ~30 lines:

```typescript
interface PoolConnector {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  registry: ActionRegistry
}

interface PoolConfig<T extends PoolConnector> {
  platform: string
  type: 'bot' | 'user'
  createConnector(instance: InstanceRecord): T
  batchSize?: number                    // default 20
  batchDelayMs?: number                 // default 1000
  reconcileIntervalMs?: number          // default 30_000
  maxWorkersPerProcess?: number         // default 50
  prisma: PrismaLike
  logger: Logger
}

function createPoolServer<T extends PoolConnector>(config: PoolConfig<T>): {
  server: Hono
  start(): Promise<void>
  stop(): Promise<void>
}
```

**HTTP endpoints provided by factory:**

| Endpoint | Purpose |
|----------|---------|
| `POST /execute` | `{ instanceId, action, params }` → route to worker |
| `GET /health` | Pool-level: total workers, healthy count, memory |
| `GET /instances` | List all instances with status |
| `GET /instances/:id/health` | Per-instance health |
| `POST /instances/:id/restart` | Manual worker restart |

**Graceful shutdown:** `pool.stop()` sets drain flag → rejects new requests with 503 → waits max 10s for in-flight → disconnects all workers.

### Memory Limits Per Connector Type

| Pool | Max workers/process | RAM/worker | Max RAM/process |
|------|-------------------|------------|-----------------|
| telegram-bot | 50 | ~30MB | ~1.5GB |
| telegram-user | 20 | ~80MB | ~1.6GB |
| discord-bot | 50 | ~40MB | ~2GB |
| whatsapp-user | 10 | ~200MB | ~2GB |

If more instances are needed than the limit, the operator starts a second pool process on a different port. Automatic horizontal scaling is out of scope for v1.

### Dispatcher Changes

**Minimal change** — add `instanceId` to the request body:

Current: `POST ${apiUrl}/execute` with `{ action, params }`
New: `POST ${apiUrl}/execute` with `{ instanceId, action, params }`

**Backward compatibility:** Pool server accepts both formats. If `instanceId` is absent, the pool falls back to single-worker mode (for thin shell apps during migration).

**user_* actions migration:**

Currently, `dispatchUserAction()` in Trigger.dev creates GramJS connections directly in-process. This must change to HTTP dispatch through the pool:

```
BEFORE: Trigger.dev → GramJsClient (in-process) → Telegram MTProto
AFTER:  Trigger.dev → HTTP POST /execute → telegram-user-pool worker → GramJS → Telegram MTProto
```

Changes required:
- `connection-transport.ts` — deleted (no more in-process GramJS)
- `user-actions.ts` — rewritten to HTTP dispatch to pool
- Trigger.dev loses all platform SDK dependencies

The `telegram-user-pool` reconciliation reads `PlatformConnection` (not `BotInstance`) for user-account connections: `WHERE platform = 'telegram' AND status = 'active'`.

### CircuitBreaker

Per-instance, not per-pool. Each worker's connector has its own `ActionRegistry` and can be wrapped with its own `CircuitBreaker`. Bot A being rate-limited does not affect Bot B. This already works with the current connector architecture — no changes needed.

### ActionRegistry Reconnect

Not a problem in the worker thread model. When a worker crashes, the supervisor starts a **new worker** which creates a **new connector** with a **fresh ActionRegistry**. No `clear()` or `reset()` method needed.

## Data Flow Example

User "Janek" has a Telegram bot. Someone sends `/hello` in his group:

```
1. Telegram API → grammY (Worker inst_janek) receives update
2. Worker: mapMessageEvent() → FlowTriggerEvent { botInstanceId: "inst_janek", communityId: "group_xyz" }
3. Worker: EventForwarder.send() → POST /api/flows/webhook (direct HTTP to API)
4. API: find FlowDefinitions for community "group_xyz" with trigger "message_received"
5. API: trigger flow-execution in Trigger.dev
6. Trigger.dev: BFS traversal → resolve action "send_message"
7. Trigger.dev: POST http://pool:3010/execute { instanceId: "inst_janek", action: "send_message", params: { text: "Hello!" } }
8. Pool main thread: route to Worker inst_janek via MessagePort
9. Worker: connector.registry.execute("send_message", params) → grammY bot.api.sendMessage()
10. Telegram API → user sees "Hello!"
```

## Implementation Phases

### Phase 1: platform-kit pool infrastructure
- `createPoolServer()` factory with worker thread management
- Worker ↔ main thread MessagePort protocol
- Reconciliation loop with staggered batch startup
- Graceful shutdown with drain
- Tests: worker isolation, reconcile, crash recovery, batch startup timing

### Phase 2: telegram-bot-pool (simplest case)
- `apps/telegram-bot-pool` — thin pool app using factory
- Dispatcher: add `instanceId` to body (backward compatible)
- DB migration: `BotInstance.apiUrl` → pool URL for telegram bots
- Coexistence: thin shell `apps/telegram-bot` still works during migration
- E2E tests: start worker, execute action, receive event, crash recovery

### Phase 3: whatsapp-user-pool + telegram-user-pool
- `apps/whatsapp-user-pool` — Baileys with 10-worker limit
- `apps/telegram-user-pool` — GramJS, reconcile reads PlatformConnection
- Rewrite `user-actions.ts` to HTTP dispatch (remove GramJS from Trigger.dev)
- Delete `connection-transport.ts`

### Phase 4: discord-bot-pool + cleanup
- `apps/discord-bot-pool`
- Delete old thin shell apps
- Remove backward compatibility from dispatcher (require `instanceId`)
- Update CLAUDE.md, README, CI

### Migration strategy (zero downtime per phase):
1. Deploy pool alongside existing thin shells
2. Move `BotInstance.apiUrl` to pool URL (per instance, not batch)
3. Verify actions and events work through pool
4. Delete thin shell

## What This Design Does NOT Include

- Automatic horizontal scaling (multiple pool processes per type) — operator manually starts additional processes
- Message broker between Trigger.dev and pools — HTTP is sufficient for current scale
- WebSocket persistent connection between pools and API — HTTP request/response works
- Dashboard UI for pool management — pools are invisible to end users, managed via BotInstance CRUD
- Multi-server deployment — single server assumption for v1
