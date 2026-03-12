# apps/trigger & packages/telegram-transport

Generated documentation for the `@tg-allegro/trigger` app and the `@tg-allegro/telegram-transport` package.

---

## Table of Contents

1. [Overview](#overview)
2. [apps/trigger](#appstrigger)
   - [Package Details](#package-details)
   - [Trigger.dev Configuration](#triggerdev-configuration)
   - [Tasks](#tasks)
   - [Library Modules](#library-modules)
   - [Flow Engine](#flow-engine)
   - [Event Correlator](#event-correlator)
   - [Tests](#appstrigger-tests)
3. [packages/telegram-transport](#packagestelegram-transport)
   - [Package Details](#transport-package-details)
   - [Transport Layer](#transport-layer)
   - [Circuit Breaker](#circuit-breaker)
   - [Action System](#action-system)
   - [Error Handling & Retry Strategies](#error-handling--retry-strategies)
   - [Tests](#transport-tests)
4. [Environment Variables](#environment-variables)
5. [Scripts & Commands](#scripts--commands)

---

## Overview

These two workspaces work together to execute background jobs for the tg-allegro Telegram group management platform:

- **`@tg-allegro/trigger`** (`apps/trigger`) -- A Trigger.dev v3 worker that runs scheduled and on-demand tasks: broadcasts, cross-posts, scheduled messages, analytics snapshots, health checks, and visual-flow execution. It depends on the transport package for Telegram API operations.
- **`@tg-allegro/telegram-transport`** (`packages/telegram-transport`) -- A shared library providing a transport abstraction over the GramJS Telegram client, a circuit breaker for resilience, an action runner with retry/backoff, and individual action executors (send message, broadcast, cross-post, forward, welcome DM). Payloads are validated with Valibot schemas.

---

## apps/trigger

### Package Details

| Field | Value |
|-------|-------|
| Name | `@tg-allegro/trigger` |
| Type | ESM (`"type": "module"`) |
| Node | `>=20.0.0` |
| Trigger.dev SDK | `^3.0.0` |
| Key dependencies | `@tg-allegro/telegram-transport`, `@tg-allegro/db`, `telegram` (GramJS), `pino` |

### Trigger.dev Configuration

File: `apps/trigger/trigger.config.ts`

| Setting | Value |
|---------|-------|
| Project ID | `proj_hilpmfmsfxxbgutxovgl` |
| Task directory | `./src/trigger` |
| Max duration | 300 seconds (5 minutes) |
| Default retries | 3 attempts, exponential backoff 1s-30s, factor 2, randomized |
| Retries in dev | Enabled |
| Build extensions | Prisma (schema at `../../packages/db/prisma/schema.prisma`) |

---

### Tasks

All task files live under `apps/trigger/src/trigger/`.

#### 1. `health-check` (Scheduled)

| Property | Value |
|----------|-------|
| ID | `health-check` |
| Schedule | `*/5 * * * *` (every 5 minutes) |
| File | `src/trigger/health-check.ts` |

**What it does:** Checks the health of system dependencies and returns an overall status.

**Components checked:**
- **Database** -- Runs `SELECT 1` via Prisma. Records latency.
- **Manager Bot** -- Calls the manager-bot `/health` endpoint via HTTP.

**Output:**
```ts
{
  overall: "up" | "down" | "degraded",
  components: {
    database: { status: "up" | "down", latencyMs: number, error?: string },
    managerBot: { status: "up" | "unreachable", latencyMs: number },
  },
  checkedAt: string, // ISO 8601
}
```

Logic: `"down"` if any component is `"down"`, `"degraded"` if not all are `"up"`, otherwise `"up"`.

---

#### 2. `broadcast` (On-demand)

| Property | Value |
|----------|-------|
| ID | `broadcast` |
| Queue | `telegram` (concurrency: 1) |
| File | `src/trigger/broadcast.ts` |

**Input:** `{ broadcastId: string }`

**What it does:**
1. Loads the `BroadcastMessage` record from the database.
2. Validates status is `"pending"` (skips otherwise).
3. Sets status to `"sending"`.
4. Iterates over `targetChatIds`, sending the message text via the GramJS transport with a **200ms stagger** between sends.
5. Updates the broadcast record to `"completed"` (all succeeded) or `"failed"` (any failure).

**Output:** `{ broadcastId, status, results: Array<{ chatId, success, messageId?, error? }> }`

---

#### 3. `cross-post` (On-demand)

| Property | Value |
|----------|-------|
| ID | `cross-post` |
| Queue | `telegram` (concurrency: 1) |
| File | `src/trigger/cross-post.ts` |

**Input:** `{ templateId?: string, messageText: string, targetChatIds: string[] }`

**What it does:** Sends the same message text to multiple chat IDs via the GramJS transport, with a **100ms stagger** between messages.

**Output:** `{ results: Array<{ chatId, success, messageId?, error? }> }`

---

#### 4. `scheduled-message` (Scheduled)

| Property | Value |
|----------|-------|
| ID | `scheduled-message` |
| Schedule | `* * * * *` (every minute) |
| File | `src/trigger/scheduled-message.ts` |

**What it does:**
1. Queries up to 50 unsent `ScheduledMessage` records where `sendAt <= now`, ordered by `sendAt` ascending.
2. For each message, sends it via the **manager-bot HTTP API** (not the GramJS transport).
3. On success, marks the record as `sent: true` with a `sentAt` timestamp.

**Output:** `{ processed, succeeded, failed }`

---

#### 5. `analytics-snapshot` (Scheduled)

| Property | Value |
|----------|-------|
| ID | `analytics-snapshot` |
| Schedule | `0 2 * * *` (daily at 2:00 AM) |
| File | `src/trigger/analytics-snapshot.ts` |

**What it does:** For each active `ManagedGroup`, aggregates yesterday's moderation logs into a `GroupAnalyticsSnapshot` record.

**Metrics captured:**
- `memberCount` -- current count from `GroupMember` table
- `newMembers` / `leftMembers` -- from `member_join` / `member_leave` log actions
- `messageCount` -- from `message` log actions
- `spamDetected`, `linksBlocked`, `warningsIssued`, `mutesIssued`, `bansIssued`, `deletedMessages`

Uses `upsert` so re-running the same day is idempotent. Errors for individual groups do not fail the entire task.

**Output:** `{ totalGroups, succeeded, failed }`

---

#### 6. `flow-execution` (On-demand)

| Property | Value |
|----------|-------|
| ID | `flow-execution` |
| Queue | `flows` (concurrency: 5) |
| File | `src/trigger/flow-execution.ts` |

**Input:** `{ flowId: string, triggerData: Record<string, unknown> }`

**What it does:**
1. Loads the `FlowDefinition` from the database; must be `active`.
2. Creates a `FlowExecution` record with status `"running"`.
3. Enriches the trigger data with cross-bot event correlation context (reputation score, recent moderation events, warning count).
4. Deserializes the flow's `nodesJson` and `edgesJson` into typed `FlowNode[]` and `FlowEdge[]`.
5. Calls `executeFlow()` from the flow engine.
6. Persists node results and sets execution status to `"completed"` or `"failed"`.

**Output:** `{ executionId, status }`

---

### Library Modules

#### `src/lib/prisma.ts`

Singleton Prisma client factory. Creates a client from `@tg-allegro/db` using the `DATABASE_URL` environment variable.

#### `src/lib/telegram.ts`

Singleton factory for Telegram infrastructure. Provides:

- **`getTelegramTransport()`** -- Returns a connected `GramJsTransport` instance. Lazily initializes and reuses the connection.
- **`getCircuitBreaker()`** -- Wraps the transport in a `CircuitBreaker` (threshold: 5 failures, reset: 30s, window: 60s).
- **`getActionRunner()`** -- Creates an `ActionRunner` wrapping the circuit breaker (maxRetries: 3, backoff: 1s-60s).
- **`getTelegramLogger()`** -- Returns a pino logger with session field redaction.

#### `src/lib/manager-bot.ts`

HTTP client for the manager-bot service:

- **`sendMessageViaManagerBot(chatId, text)`** -- `POST /api/send-message` with 10s timeout. Returns `{ success, messageId?, error? }`.
- **`checkManagerBotHealth()`** -- `GET /health` with 5s timeout. Returns boolean.

Base URL from `MANAGER_BOT_API_URL` env var (default: `http://localhost:3001`).

#### `src/lib/event-correlator.ts`

Cross-bot event correlation for flow enrichment:

- **`correlateEvents(telegramId, event)`** -- Looks up `UserIdentity`, `ReputationScore`, recent `ModerationLog` entries, and active `Warning` count for a Telegram user across all bots/groups.
- **`enrichTriggerData(triggerData)`** -- Wraps `correlateEvents()` to merge correlation context into trigger data. Adds a `correlation` object with `userId`, `reputationScore`, `warningCount`, `recentEventCount`, and up to 5 `recentEvents`. Silently returns original data on error.

---

### Flow Engine

Located in `apps/trigger/src/lib/flow-engine/`. This is a graph-based workflow executor that processes flows defined as nodes and edges.

#### Types (`types.ts`)

| Type | Description |
|------|-------------|
| `FlowContext` | Execution context: `flowId`, `executionId`, `variables` (Map), `triggerData`, `nodeResults` (Map) |
| `FlowNode` | `{ id, type, category, label, config }` |
| `FlowEdge` | `{ id, source, target, sourceHandle?, targetHandle? }` |
| `NodeResult` | `{ nodeId, status: 'success'|'error'|'skipped', output?, error?, startedAt, completedAt }` |
| `ErrorHandling` | `'stop' | 'skip' | 'retry'` |

#### Executor (`executor.ts`)

The `executeFlow(nodes, edges, triggerData, config?)` function:

1. **Builds adjacency maps** (forward and reverse) from edges.
2. **Finds trigger nodes** (category `"trigger"`) as entry points.
3. **BFS traversal** from trigger nodes through the graph.
4. **Node caching** -- LRU cache (default max 1000 entries) for cacheable nodes. Side-effect nodes (messaging, user management, DB queries, etc.) are never cached.
5. **Condition short-circuiting** -- When a condition evaluates to `false`, the entire downstream subtree is skipped if all paths to those nodes pass through the failing condition.
6. **Parallel branch support** -- `parallel_branch` nodes execute all branch targets concurrently via `Promise.all`.
7. **Error handling** -- Per-node `errorHandling` config or global default (`"stop"`): `"stop"` halts execution, `"skip"` continues to next nodes.
8. **Batched variable writes** -- Variable mutations are tracked for external persistence.
9. **Performance metrics** -- Exposed as `_metrics`: `durationMs`, `nodeCount`, `cacheHits`, `cacheMisses`, `cacheSize`, `skippedNodes`.

**Configuration (`ExecutorConfig`):**

| Option | Default | Description |
|--------|---------|-------------|
| `defaultErrorHandling` | `'stop'` | What to do when a node errors |
| `maxNodes` | `100` | Max nodes to execute (prevents runaway flows) |
| `enableNodeCache` | `true` | Enable LRU result caching |
| `maxCacheSize` | `1000` | Max cache entries |
| `prisma` | `undefined` | Prisma client for `db_query` nodes |

#### Conditions (`conditions.ts`)

Condition evaluators return `boolean`. Supported types:

| Type | Config | Description |
|------|--------|-------------|
| `keyword_match` | `{ keywords: string[], mode?: 'any'|'all' }` | Case-insensitive keyword matching on message text |
| `user_role` | `{ roles: string[] }` | Checks `triggerData.userRole` against allowed roles |
| `time_based` | `{ startHour, endHour }` | Current hour within range |
| `message_type` | `{ types: string[] }` | Message type (text, photo, video, etc.) |
| `chat_type` | `{ types: string[] }` | Chat type (private, group, supergroup, channel) |
| `regex_match` | `{ pattern, flags? }` | Regex test on message text |
| `has_media` | `{ mediaTypes?: string[] }` | Whether message contains media, optionally filtered by type |

Unknown condition types default to `true`.

#### Actions (`actions.ts`)

The `executeAction(node, ctx)` function dispatches to type-specific executors. All actions interpolate `{{trigger.*}}`, `{{node.*}}`, and context variable references.

**Messaging actions:** `send_message`, `send_photo`, `forward_message`, `copy_message`, `edit_message`, `delete_message`, `pin_message`, `unpin_message`, `send_video`, `send_document`, `send_sticker`, `send_location`, `send_voice`, `send_contact`, `send_animation`, `send_venue`, `send_dice`, `send_media_group`, `send_audio`

**User management:** `ban_user`, `mute_user` (default 3600s), `restrict_user` (granular permissions), `promote_user` (granular privileges)

**Interactive:** `create_poll` (regular or quiz), `answer_callback_query`

**Chat management:** `set_chat_title`, `set_chat_description`, `export_invite_link`, `get_chat_member`, `leave_chat`, `get_chat_info`, `set_chat_photo`, `delete_chat_photo`, `approve_join_request`

**Utility:** `api_call` (HTTP with configurable method/body/timeout), `delay` (capped at 30s), `bot_action` (dispatches actions to bot instances via their HTTP API)

#### Variables (`variables.ts`)

- **`interpolate(template, ctx)`** -- Replaces `{{trigger.path}}`, `{{node.nodeId.path}}`, and `{{variableName}}` with values from context.
- **`setVariable(ctx, key, value)`** / **`getVariable(ctx, key)`** -- Direct variable access.

#### Advanced Nodes (`advanced-nodes.ts`)

| Node | Description |
|------|-------------|
| `executeLoop` | Iterates over an array variable, setting `loop.index` and `loop.item` for each iteration. Cleans up after. |
| `evaluateSwitch` | Matches an interpolated value against `cases` array. Returns the matched output or `defaultOutput`. |
| `executeTransform` | String transforms: `uppercase`, `lowercase`, `trim`, `json_parse`, `json_stringify`, `split`, `regex_extract`, `passthrough`. |
| `executeParallelBranch` | Executes multiple branch targets concurrently via `Promise.all`. Stores results as `parallel.<branchId>` variables. |
| `executeDbQuery` | Safe database queries with an allowlist (`user.count`, `user.findMany`, `product.count`, `product.findMany`, `broadcastMessage.count`). Limits `take` to 100, `skip` >= 0. |
| `executeNotification` | Placeholder for notification delivery (websocket/email). Returns metadata. |

#### Templates (`templates.ts`)

Four built-in flow templates:

| Template | Category | Description |
|----------|----------|-------------|
| `welcome-flow` | community | Trigger on user join, send welcome message |
| `spam-escalation` | moderation | Trigger on message, check spam keywords, mute user |
| `broadcast-flow` | automation | Trigger on schedule, send message |
| `cross-post-flow` | automation | Trigger on message, check admin role, forward message |

---

### Event Correlator

The `enrichTriggerData()` function (called by the `flow-execution` task) enriches incoming trigger data with cross-bot intelligence:

- Extracts `telegramId` from `userId`, `telegramId`, or `fromId` fields
- Looks up `UserIdentity` for cross-platform user mapping
- Fetches `ReputationScore` (total score)
- Retrieves last 20 `ModerationLog` entries across all groups
- Counts active `Warning` records
- Appends a `correlation` object to the trigger data

This enables flows to make decisions based on a user's history across all managed bots and groups.

---

### apps/trigger Tests

Test files in `apps/trigger/src/__tests__/`:

| File | Coverage |
|------|----------|
| `flow-engine.test.ts` | Variable interpolation, condition evaluators (keyword, role, time, unknown), action executors (send, forward, ban, mute, delay), full graph execution (simple, condition stop, condition pass, maxNodes, error handling, skip, diamond dedup, empty flow) |
| `advanced-nodes.test.ts` | Loop iteration/cleanup/error, switch matching/default, transform operations (all 8 + interpolation), notification channel, flow templates (lookup, validation) |
| `broadcast-logic.test.ts` | Not found, skip, non-pending, success flow, failure flow, partial failures, non-Error objects |
| `cross-post-logic.test.ts` | Multi-target success, partial failures, empty targets, non-Error objects, all-fail |
| `health-check-logic.test.ts` | All healthy, DB down, manager-bot unreachable, both down, non-Error, latency, ISO timestamp |
| `analytics-snapshot-logic.test.ts` | No groups, action aggregation, member delta, upsert correctness, multiple groups, per-group error isolation |
| `scheduled-message-logic.test.ts` | No due messages, send+mark-sent, failed sends, mixed results, query parameters |

---

## packages/telegram-transport

### Transport Package Details

| Field | Value |
|-------|-------|
| Name | `@tg-allegro/telegram-transport` |
| Type | ESM (`"type": "module"`) |
| Node | `>=20.0.0` |
| Entry | `./src/index.ts` |
| Key dependencies | `telegram` (GramJS), `valibot`, `pino` |

### Transport Layer

#### `ITelegramTransport` Interface

File: `src/transport/ITelegramTransport.ts`

```ts
interface ITelegramTransport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  sendMessage(peer: string | bigint, text: string, options?: SendOptions): Promise<MessageResult>
  forwardMessage(fromPeer: string | bigint, toPeer: string | bigint, messageIds: number[], options?: ForwardOptions): Promise<MessageResult[]>
  resolveUsername(username: string): Promise<PeerInfo>
}
```

**Supporting types:**
- `MessageResult` -- `{ id: number, date: number, peerId: string | bigint }`
- `PeerInfo` -- `{ id: bigint, accessHash: bigint, type: 'user' | 'chat' | 'channel' }`
- `SendOptions` -- `{ parseMode?: 'html' | 'markdown', replyToMsgId?: number, silent?: boolean }`
- `ForwardOptions` -- `{ silent?: boolean, dropAuthor?: boolean }`

#### `GramJsTransport`

File: `src/transport/GramJsTransport.ts`

Production implementation backed by `TelegramClient` from GramJS. Constructor: `(apiId, apiHash, session: StringSession, logger)`.

- Wraps all GramJS calls with error handling, converting errors to `TransportError`.
- Connection retries: 5 (GramJS built-in).
- Resolves peers from string usernames or bigint IDs.
- Logs at debug level for individual operations, error level for failures.

#### `FakeTelegramTransport`

File: `src/transport/FakeTelegramTransport.ts`

In-memory test double implementing `ITelegramTransport`. Features:
- Auto-incrementing message IDs
- `getSentMessages()` / `getForwardedMessages()` for assertions
- `clear()` to reset state
- Deterministic `resolveUsername()` (ID derived from username length)

#### `TransportError`

File: `src/transport/errors.ts`

Custom error class that wraps the original error and chains stack traces. Fields: `name: 'TransportError'`, `original: unknown`.

---

### Circuit Breaker

File: `src/transport/CircuitBreaker.ts`

Implements `ITelegramTransport` as a decorator around another transport. Provides fail-fast behavior when the Telegram API is persistently failing.

**States:** `CLOSED` (normal) -> `OPEN` (rejecting) -> `HALF_OPEN` (probing)

**Configuration (`CircuitBreakerConfig`):**

| Option | Default | Description |
|--------|---------|-------------|
| `failureThreshold` | 5 | Failures within window to trip the circuit |
| `resetTimeoutMs` | 30,000 | Wait time before probing in OPEN state |
| `windowMs` | 60,000 | Sliding window for counting failures |

**Behavior:**
1. **CLOSED** -- Calls pass through. Failures are timestamped and counted within a sliding window. When `failureThreshold` is reached, transitions to OPEN.
2. **OPEN** -- All calls immediately throw `CircuitOpenError`. After `resetTimeoutMs` elapses, transitions to HALF_OPEN.
3. **HALF_OPEN** -- Allows one probe call. On success, transitions to CLOSED (clears failures). On failure, transitions back to OPEN.

Failures outside the sliding window are automatically pruned and do not count toward the threshold.

---

### Action System

#### Types (`src/actions/types.ts`)

**`ActionType` enum:**
- `SEND_MESSAGE`
- `FORWARD_MESSAGE`
- `SEND_WELCOME_DM`
- `CROSS_POST`
- `BROADCAST`

**Payload interfaces:**

| Payload | Fields |
|---------|--------|
| `SendMessagePayload` | `peer`, `text`, `parseMode?`, `replyToMsgId?`, `silent?` |
| `ForwardMessagePayload` | `fromPeer`, `toPeer`, `messageIds`, `silent?`, `dropAuthor?` |
| `SendWelcomeDmPayload` | `peer`, `text`, `deeplink?` |
| `CrossPostPayload` | `text`, `targetChatIds`, `parseMode?`, `silent?` |
| `BroadcastPayload` | `text`, `targetChatIds`, `parseMode?`, `delayMs?` |

**`Action` interface:** `{ type: ActionType, payload: ActionPayload, idempotencyKey?: string }`

All payloads have corresponding **Valibot schemas** for runtime validation. The top-level `ActionSchema` is a discriminated union on `type`.

#### ActionRunner (`src/actions/runner.ts`)

The `ActionRunner` class orchestrates action execution with retries:

**Constructor:** `(transport: ITelegramTransport, logger: Logger, config: { maxRetries, backoffBaseMs, backoffMaxMs })`

**`execute(action: Action): Promise<ActionResult>`**

- **Idempotency** -- If `action.idempotencyKey` is set and a result exists in the in-memory cache, returns the cached result without re-executing.
- **Retry loop** -- Up to `maxRetries + 1` total attempts.
- **Error classification** -- Uses `classifyError()` to determine behavior:
  - `FATAL` / `AUTH_EXPIRED` -- Throws immediately (no retry).
  - `RATE_LIMITED` -- Waits for `FloodWaitError.seconds * 1000` if available, otherwise uses exponential backoff.
  - `RETRYABLE` -- Exponential backoff between attempts.
- **Result caching** -- Both success and failure results are cached by idempotency key.

**`ActionResult`:** `{ success: boolean, data?: unknown, error?: string, attempts: number }`

#### Executors

All executors validate payloads with Valibot before execution.

| Executor | File | Description |
|----------|------|-------------|
| `executeSendMessage` | `executors/send-message.ts` | Validates payload, calls `transport.sendMessage()` with options. |
| `executeForwardMessage` | `executors/forward-message.ts` | Validates payload, calls `transport.forwardMessage()`. |
| `executeSendWelcomeDm` | `executors/send-welcome-dm.ts` | Appends deeplink to text if present, sends via `transport.sendMessage()` with HTML parse mode. |
| `executeCrossPost` | `executors/cross-post.ts` | Iterates over `targetChatIds`, sends to each with a **100ms stagger**. Continues on per-target failure. Returns per-target results. |
| `executeBroadcast` | `executors/broadcast.ts` | Iterates over `targetChatIds`, sends to each with a configurable delay (default **200ms**). Continues on per-target failure. Returns per-target results. |

---

### Error Handling & Retry Strategies

#### Error Classifier (`src/errors/classifier.ts`)

`classifyError(error)` returns an `ErrorCategory`:

| Category | Trigger | Retry? |
|----------|---------|--------|
| `RATE_LIMITED` | `FloodError` instance, or `FLOOD_WAIT*` message, or RPC code 420 | Yes (with Telegram-specified wait time) |
| `AUTH_EXPIRED` | `AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED`, `USER_DEACTIVATED`, `USER_DEACTIVATED_BAN`, `SESSION_EXPIRED` | No (throw immediately) |
| `FATAL` | `AUTH_KEY_DUPLICATED`, `INPUT_USER_DEACTIVATED`, `CHAT_WRITE_FORBIDDEN`, `CHANNEL_PRIVATE`, `CHANNEL_INVALID`, `USER_BANNED_IN_CHANNEL`, `CHAT_ADMIN_REQUIRED`, `USER_NOT_PARTICIPANT` | No (throw immediately) |
| `RETRYABLE` | Everything else | Yes (exponential backoff) |

#### Backoff (`src/errors/backoff.ts`)

`calculateBackoff(attempt, baseMs?, maxMs?)`:
- Formula: `min(baseMs * 2^attempt, maxMs) + jitter`
- Jitter: up to 25% of the capped value (`capped * 0.25 * random()`)
- Defaults: base = 1000ms, max = 60000ms

`sleep(ms)` -- Simple promise-based delay.

---

### Queue Configuration & Concurrency

| Queue | Concurrency | Used by |
|-------|-------------|---------|
| `telegram` | 1 | `broadcast`, `cross-post` |
| `flows` | 5 | `flow-execution` |

The `telegram` queue has concurrency 1 to prevent Telegram rate limiting from concurrent sends. The `flows` queue allows 5 concurrent flow executions.

Scheduled tasks (`health-check`, `scheduled-message`, `analytics-snapshot`) do not use named queues and rely on Trigger.dev's default scheduling behavior.

---

### Transport Tests

Test files in `packages/telegram-transport/src/__tests__/`:

| File | Coverage |
|------|----------|
| `circuit-breaker.test.ts` | Initial state, pass-through in CLOSED, failure counting, OPEN transition, immediate rejection (CircuitOpenError), HALF_OPEN probe (success -> CLOSED, failure -> OPEN), failure count reset, windowed failure expiry |
| `action-runner.test.ts` | First-attempt success, retry on RETRYABLE, exhausted retries, FATAL no-retry, AUTH_EXPIRED no-retry, idempotency caching, backoff between retries, failure result shape |
| `executors.test.ts` | send-message (basic send, options pass-through), broadcast (multi-target, per-target results with failures), cross-post (stagger delay, per-target results with failures) |

---

## Environment Variables

| Variable | Required | Used by | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `apps/trigger` | PostgreSQL connection string for Prisma |
| `TG_CLIENT_API_ID` | Yes | `apps/trigger` | Telegram API ID (numeric) |
| `TG_CLIENT_API_HASH` | Yes | `apps/trigger` | Telegram API hash |
| `TG_CLIENT_SESSION` | No | `apps/trigger` | GramJS StringSession for authentication |
| `MANAGER_BOT_API_URL` | No | `apps/trigger` | Manager bot HTTP URL (default: `http://localhost:3001`) |
| `LOG_LEVEL` | No | `apps/trigger` | Pino log level (default: `info`) |

---

## Scripts & Commands

### apps/trigger

| Command | Description |
|---------|-------------|
| `npm run typecheck` | `tsc` -- Type-check without emit |
| `npm run build` | `tsc --noEmit false` -- Compile TypeScript |
| `npm run test` | `vitest run` -- Run tests once |
| `npm run dev` | `npx trigger.dev@3.3.17 dev` -- Start Trigger.dev dev server |
| `npm run deploy` | `npx trigger.dev@3.3.17 deploy` -- Deploy to Trigger.dev cloud |

### packages/telegram-transport

| Command | Description |
|---------|-------------|
| `npm run typecheck` | `tsc` -- Type-check without emit |
| `npm run build` | `tsc --noEmit false` -- Compile TypeScript |
| `npm run test` | `vitest run` -- Run tests once |
