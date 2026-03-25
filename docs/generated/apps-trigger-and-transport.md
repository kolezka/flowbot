# apps/trigger & packages/flow-shared

> Auto-generated: 2026-03-22

---

## Table of Contents

1. [Overview](#overview)
2. [apps/trigger](#appstrigger)
   - [Tasks (7)](#tasks)
   - [Library Modules](#library-modules)
   - [Flow Engine](#flow-engine)
   - [Tests](#appstrigger-tests)
3. [packages/flow-shared](#packagesflow-shared)
   - [Node Registry](#node-registry)
4. [Environment Variables](#environment-variables)
5. [Scripts & Commands](#scripts--commands)

---

## Overview

These workspaces handle background job processing and shared flow definitions:

- **`@flowbot/trigger`** (`apps/trigger`) -- A Trigger.dev v3 worker with 7 tasks: broadcasts, cross-posts, scheduled messages, analytics snapshots, health checks, flow execution, and flow event cleanup. Contains the full flow engine with cross-platform action dispatch via the connector pool.
- **`@flowbot/flow-shared`** (`packages/flow-shared`) -- Shared node type definitions (172 node types across Telegram, Discord, General, and Unified categories) used by both the flow engine and the frontend flow editor.

> **Note:** Transport packages (`telegram-transport`, `discord-transport`) have been replaced by connector packages. See [Connector Pool & Packages](./apps-connectors.md) for the current architecture.

---

## apps/trigger

### Package Details

| Field | Value |
|-------|-------|
| Name | `@flowbot/trigger` |
| Type | ESM (`"type": "module"`) |
| Node | `>=20.0.0` |
| Trigger.dev SDK | `^3.0.0` |
| Key deps | `@flowbot/db`, `pino` |

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
| Behavior | Loads broadcast, sends to each target with 200ms stagger via mtcute |
| Output | `{ broadcastId, status, results[] }` |

#### 3. `cross-post` (On-demand)

| Property | Value |
|----------|-------|
| Queue | `telegram` (concurrency: 1) |
| Input | `{ templateId?, messageText, targetChatIds[] }` |
| Behavior | Sends to targets with 100ms stagger via mtcute |
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

Legacy singleton factory for direct mtcute transport (used by broadcast/cross-post tasks that predate pool dispatch).

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

Cross-platform action dispatch after flow execution. All actions are dispatched via HTTP `POST /execute` to the connector pool:

- **Bot actions:** Routed to the appropriate bot connector worker by `botInstanceId`
- **User actions (`user_*` prefix):** Routed to the telegram-user connector worker by `connectionId` as `instanceId`
- **Discord dispatch:** Routed to discord-bot connector worker by `botInstanceId`
- **Unified dispatch:** Cross-platform actions (`unified_send_message`, `unified_ban_user`, etc.) dispatched to one or both platforms based on `transportConfig.platform`

**Pool endpoint:** `CONNECTOR_POOL_URL` env var (default `http://localhost:3010`)

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
| `TG_CLIENT_SESSION` | No | `apps/trigger` | mtcute session string |
| `TELEGRAM_BOT_API_URL` | No | `apps/trigger` | Telegram bot API URL |
| `CONNECTOR_POOL_URL` | No | `apps/trigger` | Pool HTTP endpoint (default: `http://localhost:3010`) |
| `LOG_LEVEL` | No | `apps/trigger` | Pino log level (default: `info`) |

---

## Scripts & Commands

### apps/trigger

| Command | Description |
|---------|-------------|
| `typecheck` | `tsc` -- Type-check |
| `build` | `tsc --noEmit false` -- Compile |
| `test` | `vitest run` -- Run tests (294 tests) |
| `dev` | `npx trigger.dev@4.4.3 dev` -- Dev server |
| `deploy` | `npx trigger.dev@4.4.3 deploy` -- Deploy |

### packages/flow-shared

| Command | Description |
|---------|-------------|
| `typecheck` | `tsc --noEmit` |
