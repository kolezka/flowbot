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
- Memory isolation: each worker has its own V8 isolate
- No shared state: connectors are fully independent
- Per-thread overhead is ~2MB (thread stack + isolate bootstrap). The real per-worker memory is the connector's footprint (30-200MB depending on platform SDK). Total saving vs OS processes: ~80MB Node.js base cost is shared across all workers instead of duplicated per process.

**Communication protocol (main ↔ worker):**

| Direction | Message | Purpose |
|-----------|---------|---------|
| Main → Worker | `{ type: 'init', config: InstanceConfig }` | Initialize connector with credentials |
| Worker → Main | `{ type: 'ready' }` | Worker connected and ready to receive actions |
| Worker → Main | `{ type: 'error', code, message, fatal }` | Unrecoverable error (e.g. token revoked, auth expired). If `fatal: true`, main marks BotInstance as inactive in DB. |
| Main → Worker | `{ type: 'execute', requestId, action, params }` | Dispatch action |
| Worker → Main | `{ type: 'result', requestId, data }` | Action result |
| Worker → Main | `{ type: 'health', connected, uptime, actionCount, errorCount }` | Health report (periodic, every 10s) |
| Main → Worker | `{ type: 'shutdown' }` | Graceful stop |

**Timeouts:**
- `ready` timeout: 30s after worker spawn. If worker does not send `ready`, main kills it and logs error. Reconciliation will retry next cycle.
- `execute` timeout: 30s per action. Main thread tracks pending requests in a `Map<requestId, { resolve, reject, timer }>`. If timer fires before `result`, reject with 504 Gateway Timeout.
- Worker crash while requests in-flight: all pending requests for that worker are rejected with 503.

**Worker boot sequence:**
1. Main spawns worker with `workerData: { config: InstanceConfig }` (serializable: strings, numbers, no objects)
2. Worker creates its own `PrismaClient` (with `connection_limit=1`), `Logger`, `EventForwarder`
3. Worker creates connector via platform-specific factory
4. Worker calls `connector.connect()`
5. Worker sends `{ type: 'ready' }` to main
6. Main starts routing `execute` messages to this worker

Events (inbound from platform) bypass the main thread entirely — each worker's `EventForwarder` POSTs directly to the API webhook.

### Reconciliation Loop

Each pool process reads desired state from the database every 30 seconds and converges:

```
reconcile():
  if (isReconciling) return          // mutex: prevent overlapping runs
  isReconciling = true

  try:
    desired = DB query (platform-specific, see InstanceRecord below)
    running = current worker map

    // Start missing instances (staggered batches)
    missing = desired instances NOT in running
    for batch of missing (size = BATCH_SIZE):
      await Promise.all(batch.map(startWorker))
      await sleep(BATCH_DELAY_MS)

    // Stop removed instances (graceful drain)
    removed = running instances NOT in desired
    for each removed:
      await stopWorker(id)  // sends 'shutdown', waits 10s, then kills

    // Update apiUrl only when changed
    for each running WHERE BotInstance.apiUrl != poolUrl:
      await prisma.botInstance.update({ apiUrl: poolUrl })

  finally:
    isReconciling = false
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

### InstanceRecord and Credential Extraction

The reconciliation loop queries different tables depending on pool type:

**Bot pools** (telegram-bot, discord-bot) query `BotInstance`:
```typescript
interface BotInstanceRecord {
  id: string
  botToken: string
  platform: string
  apiUrl: string | null
  metadata: Record<string, unknown> | null
}

// Query: BotInstance WHERE platform = $platform AND type = 'bot' AND isActive = true
```

**User pools** (telegram-user, whatsapp-user) query `PlatformConnection`:
```typescript
interface UserConnectionRecord {
  id: string                    // connectionId, used as instanceId
  platform: string
  credentials: {
    sessionString?: string      // Telegram MTProto
    authKeys?: Record<string, unknown>  // WhatsApp Baileys
  }
  botInstanceId: string | null  // linked BotInstance for apiUrl
  metadata: Record<string, unknown> | null
}

// Query: PlatformConnection WHERE platform = $platform AND status = 'active'
```

**Credential passing to workers:**
Credentials are serialized as part of `workerData` (strings and plain objects — fully serializable). The worker thread reconstructs the connector:

```typescript
// Inside worker thread:
const { instanceId, botToken, sessionString, credentials, apiUrl, apiId, apiHash } = workerData

// Telegram bot:
new TelegramBotConnector({ botToken, botInstanceId: instanceId, logger, apiUrl })

// Telegram user:
new TelegramUserConnector({ sessionString, apiId, apiHash, logger })

// WhatsApp user (worker creates its own Prisma with connection_limit=1):
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL, connection_limit: 1 })
new WhatsAppUserConnector({ connectionId: instanceId, prisma, logger, apiUrl })
```

Environment variables like `TG_API_ID` and `TG_API_HASH` are inherited by worker threads automatically (same process).

### Pool Server Factory (platform-kit)

Generic `createPoolServer<T>()` in `packages/platform-kit` so each pool app is ~30 lines:

```typescript
interface PoolConnector {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  registry: ActionRegistry
}

type InstanceRecord = BotInstanceRecord | UserConnectionRecord

interface PoolConfig<T extends PoolConnector> {
  platform: string
  type: 'bot' | 'user'
  workerScript: string              // path to worker entry file
  getInstances(): Promise<InstanceRecord[]>  // custom DB query
  toWorkerData(instance: InstanceRecord): Record<string, unknown>  // serialize for worker
  batchSize?: number                // default 20
  batchDelayMs?: number             // default 1000
  reconcileIntervalMs?: number      // default 30_000
  maxWorkersPerProcess?: number     // default 50
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
| `GET /instances/:id/health` | Per-instance health (from last health message) |
| `GET /metrics` | Per-instance: action count, error count, uptime, circuit breaker state |
| `POST /instances/:id/restart` | Manual worker restart (coordinates with reconcile mutex) |

**Graceful shutdown:** `pool.stop()` sets drain flag → rejects new requests with 503 → waits max 10s for in-flight → sends `shutdown` to all workers → waits for workers to exit → done.

**Note:** `POST /instances/:id/restart` acquires the reconcile mutex before restarting to prevent race conditions with the reconciliation loop.

### HTTP Endpoint Path Standardization

The current codebase has inconsistent paths:
- `platform-kit/server.ts` serves `POST /api/execute-action`
- Dispatcher calls `POST ${apiUrl}/execute`

**Standardization:** All pool servers and the existing `createConnectorServer` will serve `POST /execute`. The `createConnectorServer` will add `/execute` as an alias for `/api/execute-action` during migration. Phase 4 removes the old path.

The `BotInstance.apiUrl` stores the base URL (e.g., `http://localhost:3010`). The dispatcher appends `/execute`. This is already how the dispatcher works — no change needed on the dispatcher side.

### Memory Limits Per Connector Type

| Pool | Max workers/process | RAM/worker (connector) | Node.js shared | Max process RSS | `--max-old-space-size` |
|------|-------------------|------------------------|----------------|-----------------|----------------------|
| telegram-bot | 50 | ~30MB | ~80MB | ~1.6GB | 2048 |
| telegram-user | 20 | ~80MB | ~80MB | ~1.7GB | 2048 |
| discord-bot | 50 | ~40MB | ~80MB | ~2.1GB | 3072 |
| whatsapp-user | 10 | ~200MB | ~80MB | ~2.1GB | 3072 |

Each pool process must be started with the appropriate `--max-old-space-size` flag. The pool app sets this via `NODE_OPTIONS` or the factory emits a startup warning if current heap limit is too low.

**Database connections:** Each worker creates its own `PrismaClient` with `connection_limit=1`. At 50 workers, that is 50 DB connections per pool. Recommendation: use PgBouncer or configure PostgreSQL `max_connections` accordingly. For small deployments without PgBouncer, only WhatsApp and Telegram user connectors need per-worker Prisma (for session persistence). Telegram bot and Discord bot workers do not need Prisma — they only use grammY/discord.js SDK which connects to platform APIs, not the database.

### Dispatcher Changes

**Minimal change** — add `instanceId` to the request body:

Current: `POST ${apiUrl}/execute` with `{ action, params }`
New: `POST ${apiUrl}/execute` with `{ instanceId, action, params }`

**Backward compatibility:** Pool server accepts both formats. If `instanceId` is absent and only one worker exists, route to it (thin shell mode). If `instanceId` is absent and multiple workers exist, return 400.

**user_* actions migration (Telegram MTProto only):**

Currently, `dispatchUserAction()` in Trigger.dev creates GramJS connections directly in-process via `connection-transport.ts`. This is the only platform SDK dependency in Trigger.dev. WhatsApp user actions already go through HTTP dispatch (no `user_` prefix).

After migration:
```
BEFORE: Trigger.dev → GramJsClient (in-process) → Telegram MTProto
AFTER:  Trigger.dev → HTTP POST /execute → telegram-user-pool worker → GramJS → Telegram MTProto
```

Changes required:
- `connection-transport.ts` — deleted (no more in-process GramJS)
- `user-actions.ts` — rewritten to HTTP dispatch to telegram-user-pool
- Trigger.dev removes `@flowbot/telegram-user-connector` dependency

**Dispatcher signature update:**
```typescript
// BEFORE:
export async function dispatchAction(action, params, apiUrl)
  body: { action, params }

// AFTER:
export async function dispatchAction(action, params, apiUrl, instanceId?)
  body: { instanceId, action, params }
```
In `dispatchActions()`, the call becomes: `dispatchAction(action, output, botInstance.apiUrl, botInstance.id)`.

**Action name prefix convention:** The dispatcher strips the `user_` prefix before sending to the pool. The pool routes to the worker, and the connector's ActionRegistry uses unprefixed names. Example: dispatcher receives `user_send_message` → sends `{ action: 'send_message' }` to telegram-user-pool.

**Action parity table (user_* dispatcher → telegram-user-connector registry):**

Actions that EXIST in the connector today (5/18):
| Dispatcher action | Connector action | Status |
|-------------------|-----------------|--------|
| `user_send_message` | `send_message` | Exists |
| `user_send_media` | `send_media` | Exists |
| `user_forward_message` | `forward_message` | Exists |
| `user_delete_message` | `delete_message` | Exists |
| `user_edit_message` | `edit_message` | Exists |

Actions that must be ADDED to the connector (13/18 — Phase 3 prerequisite):
| Dispatcher action | Connector action to add | GramJS method |
|-------------------|------------------------|---------------|
| `user_get_chat_history` | `get_chat_history` | `client.getMessages()` |
| `user_search_messages` | `search_messages` | `client.invoke(SearchRequest)` |
| `user_get_all_members` | `get_all_members` | `client.getParticipants()` |
| `user_get_chat_info` | `get_chat_info` | `client.invoke(GetFullChat)` |
| `user_get_contacts` | `get_contacts` | `client.invoke(GetContacts)` |
| `user_get_dialogs` | `get_dialogs` | `client.getDialogs()` |
| `user_join_chat` | `join_chat` | `client.invoke(JoinChannel)` |
| `user_leave_chat` | `leave_chat` | `client.invoke(LeaveChannel)` |
| `user_create_group` | `create_group` | `client.invoke(CreateChat)` |
| `user_create_channel` | `create_channel` | `client.invoke(CreateChannel)` |
| `user_invite_users` | `invite_users` | `client.invoke(InviteToChannel)` |
| `user_update_profile` | `update_profile` | `client.invoke(UpdateProfile)` |
| `user_set_status` | `set_status` | `client.invoke(UpdateStatus)` |

These 13 actions must be implemented in `telegram-user-connector` before Phase 3 begins. They are raw GramJS `client.invoke()` calls currently hardcoded in `user-actions.ts`.

The `telegram-user-pool` reconciliation reads `PlatformConnection WHERE platform = 'telegram' AND status = 'active'`.

### TelegramUserConnector: Action-Only (No Inbound Events)

`TelegramUserConnector` does not have an `EventForwarder` or event listeners. This is intentional — user accounts are used for executing actions (send messages, read history, join groups), not for listening to events. Inbound event listening is handled by bot connectors (telegram-bot, discord-bot) or user connectors that act as listeners (whatsapp-user). If user-account event listening is needed in the future, an `EventForwarder` can be added to `TelegramUserConnector` following the same pattern as `WhatsAppUserConnector`.

### createConnectorServer vs createPoolServer

These are two separate factories in `platform-kit`:
- `createConnectorServer(registry, ...)` — single-instance server for thin shell apps. Existing, unchanged. Gets a `/execute` alias in Phase 1 for path standardization.
- `createPoolServer(config)` — multi-instance server for pool apps. New. Routes by `instanceId` to workers. Does NOT wrap or extend `createConnectorServer`.

Both coexist during migration. Phase 4 removes thin shell apps but `createConnectorServer` stays in platform-kit for testing and single-instance use cases.

### Observability

**Structured logging:** Every log line from a worker includes `instanceId`, `platform`, and `poolProcessId` fields. The pool logger is a child logger with pool-level context; each worker creates a child logger with instance-level context.

**Metrics endpoint (`GET /metrics`):**
```json
{
  "pool": { "platform": "telegram", "type": "bot", "uptime": 3600, "workerCount": 42 },
  "workers": {
    "inst_1": { "connected": true, "uptime": 3500, "actionsExecuted": 150, "errors": 2, "circuitState": "closed" },
    "inst_2": { "connected": false, "uptime": 0, "actionsExecuted": 0, "errors": 5, "circuitState": "open" }
  }
}
```

**Health aggregation:** `GET /health` returns `status: 'healthy'` if >80% of workers are connected, `'degraded'` if 50-80%, `'unhealthy'` if <50%.

### CircuitBreaker

Per-instance, not per-pool. Each worker's connector has its own `ActionRegistry` and can be wrapped with its own `CircuitBreaker`. Bot A being rate-limited does not affect Bot B. This already works with the current connector architecture — no changes needed.

### ActionRegistry Reconnect

Not a problem in the worker thread model. When a worker crashes, the supervisor starts a **new worker** which creates a **new connector** with a **fresh ActionRegistry**. No `clear()` or `reset()` method needed.

## Data Flow Example

User "Janek" has a Telegram bot. Someone sends `/hello` in his group:

```
1. Telegram API → grammY (Worker inst_janek) receives update via polling
2. Worker: mapMessageEvent() → FlowTriggerEvent { botInstanceId: "inst_janek", communityId: "group_xyz" }
3. Worker: EventForwarder.send() → POST http://localhost:3000/api/flows/webhook (direct HTTP to API)
4. API: find FlowDefinitions for community "group_xyz" with trigger "message_received"
5. API: trigger flow-execution in Trigger.dev
6. Trigger.dev: BFS traversal → resolve action "send_message"
7. Trigger.dev: lookup BotInstance "inst_janek" → apiUrl = "http://localhost:3010" (pool URL from DB)
8. Trigger.dev: POST http://localhost:3010/execute { instanceId: "inst_janek", action: "send_message", params: { text: "Hello!" } }
9. Pool main thread: lookup Worker inst_janek, send via MessagePort
10. Worker: connector.registry.execute("send_message", params) → grammY bot.api.sendMessage()
11. Telegram API → user sees "Hello!"
```

## Implementation Phases

### Phase 1: platform-kit pool infrastructure
- `createPoolServer()` factory with worker thread management
- Worker ↔ main thread MessagePort protocol (init, ready, execute, result, error, health, shutdown)
- Worker supervisor with crash detection and restart
- Reconciliation loop with mutex, staggered batch startup
- Graceful shutdown with drain
- `--max-old-space-size` validation on startup
- Add `/execute` alias to existing `createConnectorServer()` for backward compat
- Tests: worker isolation, reconcile, crash recovery, batch startup timing, timeout handling

### Phase 2: telegram-bot-pool (simplest case)
- `apps/telegram-bot-pool` — thin pool app using factory (~30 lines)
- Worker entry script: creates TelegramBotConnector from workerData
- Dispatcher: add `instanceId` to body (backward compatible — old format still works)
- DB migration: update `BotInstance.apiUrl` → pool URL for telegram bot instances
- Coexistence: thin shell `apps/telegram-bot` still works during migration
- E2E tests: start worker, execute action, receive event, crash recovery

### Phase 3: whatsapp-user-pool + telegram-user-pool
- `apps/whatsapp-user-pool` — Baileys with 10-worker limit, per-worker Prisma (connection_limit=1)
- `apps/telegram-user-pool` — GramJS, reconcile reads PlatformConnection
- Rewrite `user-actions.ts` to HTTP dispatch (verify all 18 user_* actions have ActionRegistry counterparts)
- Delete `connection-transport.ts`, remove `@flowbot/telegram-user-connector` from Trigger.dev deps

### Phase 4: discord-bot-pool + cleanup
- `apps/discord-bot-pool`
- Delete old thin shell apps (`apps/telegram-bot`, `apps/telegram-user`, `apps/whatsapp-user`, `apps/discord-bot`)
- Remove `/api/execute-action` alias from `createConnectorServer()`
- Remove backward compatibility from dispatcher (require `instanceId`)
- Update CLAUDE.md, README, CI

### Migration strategy (zero downtime per phase):
1. Deploy pool alongside existing thin shells
2. Move `BotInstance.apiUrl` to pool URL (per instance, not batch)
3. Verify actions and events work through pool
4. Delete thin shell

### Phase dependency:
- Phase 1 is pure infrastructure (no platform code)
- Phase 2 depends on Phase 1; simplest case (no Prisma in workers, no credentials beyond token string)
- Phase 3 depends on Phase 2 (dispatcher instanceId support must be in place)
- Phase 4 depends on all others

## What This Design Does NOT Include

- Automatic horizontal scaling (multiple pool processes per type) — operator manually starts additional processes
- Message broker between Trigger.dev and pools — HTTP is sufficient for current scale
- WebSocket persistent connection between pools and API — HTTP request/response works
- Dashboard UI for pool management — pools are invisible to end users, managed via BotInstance CRUD
- Multi-server deployment — single server assumption for v1
- PgBouncer setup — documented as recommendation, not mandatory for small deployments
