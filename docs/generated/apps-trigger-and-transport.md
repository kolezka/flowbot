# apps/trigger, packages/telegram-transport, packages/discord-transport & packages/flow-shared

> Auto-generated: 2026-03-19

---

## Table of Contents

1. [Overview](#overview)
2. [apps/trigger](#appstrigger)
   - [Tasks (7)](#tasks)
   - [Library Modules](#library-modules)
   - [Flow Engine](#flow-engine)
   - [Tests](#appstrigger-tests)
3. [packages/telegram-transport](#packagestelegram-transport)
   - [Transport Layer](#transport-layer)
   - [Circuit Breaker](#circuit-breaker)
   - [Action System](#action-system)
   - [Tests](#telegram-transport-tests)
4. [packages/discord-transport](#packagesdiscord-transport)
   - [Transport Layer](#discord-transport-layer)
   - [Circuit Breaker](#discord-circuit-breaker)
   - [Tests](#discord-transport-tests)
5. [packages/flow-shared](#packagesflow-shared)
   - [Node Registry](#node-registry)
6. [Environment Variables](#environment-variables)
7. [Scripts & Commands](#scripts--commands)

---

## Overview

These workspaces work together to execute background jobs and provide transport abstractions for the Flowbot platform:

- **`@flowbot/trigger`** (`apps/trigger`) -- A Trigger.dev v3 worker with 7 tasks: broadcasts, cross-posts, scheduled messages, analytics snapshots, health checks, flow execution, and flow event cleanup. Contains the full flow engine with cross-platform action dispatch.
- **`@flowbot/telegram-transport`** (`packages/telegram-transport`) -- Transport abstraction over GramJS, circuit breaker, action runner with retry/backoff, and Valibot-validated action executors.
- **`@flowbot/discord-transport`** (`packages/discord-transport`) -- Transport abstraction over discord.js, circuit breaker, and typed interfaces for Discord operations (messaging, moderation, channels, threads, events, interactions).
- **`@flowbot/flow-shared`** (`packages/flow-shared`) -- Shared node type definitions (172 node types across Telegram, Discord, General, and Unified categories) used by both the flow engine and the frontend flow editor.

---

## apps/trigger

### Package Details

| Field | Value |
|-------|-------|
| Name | `@flowbot/trigger` |
| Type | ESM (`"type": "module"`) |
| Node | `>=20.0.0` |
| Trigger.dev SDK | `^3.0.0` |
| Key deps | `@flowbot/telegram-transport`, `@flowbot/db`, `telegram` (GramJS), `pino` |

### Trigger.dev Configuration

File: `apps/trigger/trigger.config.ts`

| Setting | Value |
|---------|-------|
| Project ID | `proj_hilpmfmsfxxbgutxovgl` |
| Task directory | `./src/trigger` |
| Max duration | 300 seconds (5 minutes) |
| Default retries | 3 attempts, exponential backoff 1s-30s |
| Build extensions | Prisma (schema at `../../packages/db/prisma/schema.prisma`) |

---

### Tasks

All task files in `apps/trigger/src/trigger/`.

#### 1. `health-check` (Scheduled)

| Property | Value |
|----------|-------|
| Schedule | `*/5 * * * *` (every 5 minutes) |
| Checks | Database (SELECT 1), Manager Bot (/health) |
| Output | `{ overall: "up"/"down"/"degraded", components, checkedAt }` |

#### 2. `broadcast` (On-demand)

| Property | Value |
|----------|-------|
| Queue | `telegram` (concurrency: 1) |
| Input | `{ broadcastId: string }` |
| Behavior | Loads broadcast, sends to each target with 200ms stagger via GramJS |
| Output | `{ broadcastId, status, results[] }` |

#### 3. `cross-post` (On-demand)

| Property | Value |
|----------|-------|
| Queue | `telegram` (concurrency: 1) |
| Input | `{ templateId?, messageText, targetChatIds[] }` |
| Behavior | Sends to targets with 100ms stagger via GramJS |
| Output | `{ results[] }` |

#### 4. `scheduled-message` (Scheduled)

| Property | Value |
|----------|-------|
| Schedule | `* * * * *` (every minute) |
| Behavior | Queries up to 50 unsent messages, sends via manager-bot HTTP API |
| Output | `{ processed, succeeded, failed }` |

#### 5. `analytics-snapshot` (Scheduled)

| Property | Value |
|----------|-------|
| Schedule | `0 2 * * *` (daily at 2:00 AM) |
| Behavior | Aggregates yesterday's moderation logs into `GroupAnalyticsSnapshot` per group |
| Output | `{ totalGroups, succeeded, failed }` |

#### 6. `flow-execution` (On-demand)

| Property | Value |
|----------|-------|
| Queue | `flows` (concurrency: 5) |
| Input | `{ flowId, triggerData }` |
| Behavior | Loads flow, enriches trigger data with correlation context, executes flow graph via BFS, dispatches actions to Telegram/Discord/both |
| Output | `{ executionId, status }` |

#### 7. `flow-event-cleanup` (Scheduled)

| Property | Value |
|----------|-------|
| Schedule | `0 3 * * *` (daily at 3:00 AM) |
| Behavior | Deletes expired `FlowEvent` records (those past `expiresAt`) |
| Output | `{ deletedCount }` |

### Queue Configuration

| Queue | Concurrency | Used by |
|-------|-------------|---------|
| `telegram` | 1 | `broadcast`, `cross-post` |
| `flows` | 5 | `flow-execution` |

---

### Library Modules

#### `src/lib/prisma.ts`

Singleton Prisma client factory using `@flowbot/db`.

#### `src/lib/telegram.ts`

Singleton factory providing:
- `getTelegramTransport()` -- Connected `GramJsTransport` instance
- `getCircuitBreaker()` -- Wraps transport (threshold: 5, reset: 30s, window: 60s)
- `getActionRunner()` -- Wraps circuit breaker (maxRetries: 3, backoff: 1s-60s)
- `getTelegramLogger()` -- Pino logger with session field redaction

#### `src/lib/manager-bot.ts`

HTTP client for manager-bot: `sendMessageViaManagerBot()` and `checkManagerBotHealth()`.

#### `src/lib/event-correlator.ts`

Cross-bot event correlation: `enrichTriggerData()` merges `UserIdentity`, `ReputationScore`, recent `ModerationLog` entries, and active `Warning` count into trigger data.

---

### Flow Engine

Located in `apps/trigger/src/lib/flow-engine/`.

#### Types (`types.ts`)

| Type | Description |
|------|-------------|
| `FlowContext` | Execution context: `flowId`, `executionId`, `variables` (Map), `triggerData`, `nodeResults` (Map) |
| `FlowNode` | `{ id, type, category, label, config }` |
| `FlowEdge` | `{ id, source, target, sourceHandle?, targetHandle? }` |
| `NodeResult` | `{ nodeId, status, output?, error?, startedAt, completedAt }` |

#### Executor (`executor.ts`)

BFS-based graph executor with:
- **Node caching** -- LRU cache (default 1000) for cacheable nodes
- **Condition short-circuiting** -- downstream subtrees skipped on false
- **Parallel branch support** -- `Promise.all` for branch targets
- **Error handling** -- per-node or global: `stop`, `skip`, `retry`
- **Max nodes** -- default 100, prevents runaway flows
- **Performance metrics** -- `durationMs`, `nodeCount`, `cacheHits`, `skippedNodes`

#### Conditions (`conditions.ts`)

`keyword_match`, `user_role`, `time_based`, `message_type`, `chat_type`, `regex_match`, `has_media`. Unknown types default to `true`.

#### Actions (`actions.ts`)

Dispatches to type-specific executors with `{{trigger.*}}`, `{{node.*}}`, and variable interpolation.

**Telegram actions:** `send_message`, `send_photo`, `forward_message`, `copy_message`, `edit_message`, `delete_message`, `pin_message`, `unpin_message`, `send_video`, `send_document`, `send_sticker`, `send_location`, `send_voice`, `send_contact`, `send_animation`, `send_venue`, `send_dice`, `send_media_group`, `send_audio`, `ban_user`, `mute_user`, `restrict_user`, `promote_user`, `create_poll`, `answer_callback_query`, `answer_inline_query`, `send_invoice`, `answer_pre_checkout`, `set_chat_menu_button`, `set_my_commands`, `create_forum_topic`, `set_chat_title`, `set_chat_description`, `export_invite_link`, `get_chat_member`, `leave_chat`

**Utility:** `api_call`, `delay` (max 30s), `bot_action`

**Context:** `get_context`, `set_context`, `delete_context`, `context_condition`

**Flow chaining:** `run_flow`, `emit_event`

#### Context Store (`context-store.ts`)

Persistent per-user flow context stored in `UserFlowContext` model:
- `getContext(prisma, platformUserId, platform, key)` -- Read context value
- `setContext(prisma, platformUserId, platform, key, value)` -- Write context value (upsert)
- `deleteContext(prisma, platformUserId, platform, key)` -- Remove context entry
- `listContextKeys(prisma, platformUserId, platform)` -- List all keys for a user

#### Dispatcher (`dispatcher.ts`)

Cross-platform action dispatch after flow execution:

- **Telegram dispatch:** Via MTProto (GramJS transport) or Bot API (HTTP to bot instance)
- **Discord dispatch:** Via Discord bot HTTP API (`/api/execute-action`)
- **Unified dispatch:** Cross-platform actions (`unified_send_message`, `unified_ban_user`, etc.) dispatched to one or both platforms based on `transportConfig.platform`
- **Transport modes:** `mtproto` (default), `bot_api`, `auto` (tries bot API, falls back to MTProto)

#### Advanced Nodes (`advanced-nodes.ts`)

| Node | Description |
|------|-------------|
| `executeLoop` | Iterates over array variable |
| `evaluateSwitch` | Matches value against cases |
| `executeTransform` | String transforms (uppercase, lowercase, trim, json_parse, etc.) |
| `executeParallelBranch` | Concurrent branch execution |
| `executeDbQuery` | Safe database queries (allowlisted models) |
| `executeNotification` | Notification placeholder |

#### Templates (`templates.ts`)

4 built-in templates: `welcome-flow`, `spam-escalation`, `broadcast-flow`, `cross-post-flow`.

#### Variables (`variables.ts`)

`interpolate(template, ctx)` replaces `{{trigger.path}}`, `{{node.nodeId.path}}`, `{{variableName}}`.

---

### apps/trigger Tests

Test files in `apps/trigger/src/__tests__/`:

| File | Coverage |
|------|----------|
| `flow-engine.test.ts` | Variable interpolation, conditions, actions, full graph execution |
| `advanced-nodes.test.ts` | Loop, switch, transform, notification, templates |
| `broadcast-logic.test.ts` | Broadcast task logic |
| `cross-post-logic.test.ts` | Cross-post multi-target logic |
| `health-check-logic.test.ts` | Health check components |
| `analytics-snapshot-logic.test.ts` | Analytics aggregation |
| `scheduled-message-logic.test.ts` | Scheduled message sends |
| `context-actions.test.ts` | Context get/set/delete actions |
| `context-condition.test.ts` | Context condition evaluator |
| `context-store.test.ts` | Context store CRUD |
| `context-variables.test.ts` | Context variable interpolation |
| `discord-flow-integration.test.ts` | Discord flow integration |
| `discord-new-actions.test.ts` | New Discord action executors |
| `flow-builder-integration.test.ts` | Flow builder integration |
| `flow-chaining.test.ts` | Flow-to-flow chaining |
| `flow-dispatcher.test.ts` | Telegram action dispatch |
| `flow-dispatcher-discord.test.ts` | Discord action dispatch |
| `flow-event-cleanup.test.ts` | Event cleanup task |
| `flow-events.test.ts` | Flow event system |
| `telegram-new-actions.test.ts` | New Telegram action executors |
| `unified-actions.test.ts` | Unified cross-platform actions |

---

## packages/telegram-transport

### Transport Package Details

| Field | Value |
|-------|-------|
| Name | `@flowbot/telegram-transport` |
| Type | ESM (`"type": "module"`) |
| Node | `>=20.0.0` |
| Entry | `./src/index.ts` |
| Key deps | `telegram` (GramJS), `valibot`, `pino` |

### Transport Layer

#### `ITelegramTransport` Interface

```ts
interface ITelegramTransport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  sendMessage(peer, text, options?): Promise<MessageResult>
  forwardMessage(fromPeer, toPeer, messageIds, options?): Promise<MessageResult[]>
  resolveUsername(username): Promise<PeerInfo>
}
```

#### `GramJsTransport`

Production implementation backed by GramJS `TelegramClient`. Wraps all calls with error handling, converts to `TransportError`. Extended with methods for photos, videos, documents, stickers, voice, audio, animations, locations, contacts, venues, dice, polls, message editing/pinning, user management, chat management, inline queries, invoices, forum topics, media groups, and more.

#### `FakeTelegramTransport`

In-memory test double with auto-incrementing IDs and assertion helpers.

### Circuit Breaker

States: `CLOSED` -> `OPEN` -> `HALF_OPEN`

| Config | Default | Description |
|--------|---------|-------------|
| `failureThreshold` | 5 | Failures to trip |
| `resetTimeoutMs` | 30,000 | Wait before probe |
| `windowMs` | 60,000 | Sliding failure window |

### Action System

**ActionType enum:** `SEND_MESSAGE`, `FORWARD_MESSAGE`, `SEND_WELCOME_DM`, `CROSS_POST`, `BROADCAST`

**ActionRunner:** Orchestrates action execution with retries, idempotency caching, and error classification (`FATAL`, `AUTH_EXPIRED`, `RATE_LIMITED`, `RETRYABLE`).

**Executors:** `executeSendMessage`, `executeForwardMessage`, `executeSendWelcomeDm`, `executeCrossPost` (100ms stagger), `executeBroadcast` (200ms stagger).

### Telegram Transport Tests

| File | Coverage |
|------|----------|
| `circuit-breaker.test.ts` | State transitions, failure counting, windowed expiry |
| `action-runner.test.ts` | Retry, fatal/auth errors, idempotency, backoff |
| `executors.test.ts` | Send, broadcast, cross-post executors |

---

## packages/discord-transport

### Discord Transport Package Details

| Field | Value |
|-------|-------|
| Name | `@flowbot/discord-transport` |
| Type | ESM (`"type": "module"`) |
| Node | `>=20.0.0` |
| Entry | `./src/index.ts` |
| Key dep | `discord.js` (^14.16.0) |

### Discord Transport Layer

#### `IDiscordTransport` Interface

Comprehensive Discord operations interface:

**Connection:** `connect()`, `disconnect()`, `isConnected()`

**Messaging:** `sendMessage()`, `sendEmbed()`, `sendDM()`, `editMessage()`, `deleteMessage()`, `pinMessage()`, `unpinMessage()`

**Reactions:** `addReaction()`, `removeReaction()`

**Member management:** `banMember()`, `kickMember()`, `timeoutMember()`, `addRole()`, `removeRole()`, `setNickname()`

**Channel management:** `createChannel()`, `deleteChannel()`, `createThread()`, `sendThreadMessage()`

**Guild management:** `createRole()`, `createInvite()`, `moveMember()`, `createScheduledEvent()`

**Interactions (SP2):** `replyInteraction()`, `showModal()`, `sendComponents()`, `editInteraction()`, `deferReply()`

**Channel permissions & Forums (SP2):** `setChannelPermissions()`, `createForumPost()`, `registerCommands()`

#### `DiscordJsTransport`

Production implementation backed by discord.js `Client`.

#### `FakeDiscordTransport`

In-memory test double with tracking for: sent messages, embeds, DMs, edits, deletes, pins, reactions, bans, kicks, timeouts, role changes, nickname changes, created channels/threads/roles/invites, moved members, and scheduled events.

### Discord Circuit Breaker

Same pattern as Telegram transport: `CircuitBreaker` decorator with `CLOSED`/`OPEN`/`HALF_OPEN` states.

### Discord Transport Tests

| File | Coverage |
|------|----------|
| `discord-transport.test.ts` | Transport operations, circuit breaker |
| `discord-sp2.test.ts` | SP2 interaction and forum operations |

---

## packages/flow-shared

### Package Details

| Field | Value |
|-------|-------|
| Name | `@flowbot/flow-shared` |
| Type | ESM (`"type": "module"`) |
| Entry | `src/index.ts` |
| Deps | None (TypeScript only) |

### Node Registry

File: `src/node-registry.ts`

Exports `NODE_TYPES` -- an array of 172 `NodeTypeDefinition` objects, each with `{ type, label, category, platform, color }`.

#### Node Types by Platform

| Platform | Triggers | Conditions | Actions | Advanced | Total |
|----------|----------|------------|---------|----------|-------|
| Telegram | 18 | 11 | 39 | -- | 68 |
| Discord | 16 | 5 | 31 | -- | 52 |
| General | 1 (custom_event) | 1 (context_condition) | 14 | 8 | 24 |
| Unified (cross-platform) | -- | -- | 8 | -- | 8 |

**Key general nodes:** `api_call`, `delay`, `bot_action`, `get_context`, `set_context`, `delete_context`, `run_flow`, `emit_event`, `parallel_branch`, `db_query`, `loop`, `switch`, `transform`

**Unified actions:** `unified_send_message`, `unified_send_media`, `unified_delete_message`, `unified_ban_user`, `unified_kick_user`, `unified_pin_message`, `unified_send_dm`, `unified_set_role`

#### Helper Functions

- `getNodesByPlatform(platform)` -- Filter nodes by platform (or `'all'` for everything)
- `getNodesByCategory(category)` -- Filter nodes by category

---

## Environment Variables

| Variable | Required | Used by | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `apps/trigger` | PostgreSQL connection string |
| `TG_CLIENT_API_ID` | Yes | `apps/trigger` | Telegram API ID (numeric) |
| `TG_CLIENT_API_HASH` | Yes | `apps/trigger` | Telegram API hash |
| `TG_CLIENT_SESSION` | No | `apps/trigger` | GramJS StringSession |
| `MANAGER_BOT_API_URL` | No | `apps/trigger` | Manager bot HTTP URL (default: `http://localhost:3001`) |
| `LOG_LEVEL` | No | `apps/trigger` | Pino log level (default: `info`) |

---

## Scripts & Commands

### apps/trigger

| Command | Description |
|---------|-------------|
| `typecheck` | `tsc` -- Type-check |
| `build` | `tsc --noEmit false` -- Compile |
| `test` | `vitest run` -- Run tests |
| `dev` | `npx trigger.dev@3.3.17 dev` -- Dev server |
| `deploy` | `npx trigger.dev@3.3.17 deploy` -- Deploy |

### packages/telegram-transport

| Command | Description |
|---------|-------------|
| `typecheck` | `tsc` |
| `build` | `tsc --noEmit false` |
| `test` | `vitest run` |
| `test:integration` | `vitest run --config vitest.integration.config.ts` |

### packages/discord-transport

| Command | Description |
|---------|-------------|
| `typecheck` | `tsc` |
| `build` | `tsc --noEmit false` |
| `test` | `vitest run` |
| `test:integration` | `vitest run --config vitest.integration.config.ts` |

### packages/flow-shared

| Command | Description |
|---------|-------------|
| `typecheck` | `tsc --noEmit` |
