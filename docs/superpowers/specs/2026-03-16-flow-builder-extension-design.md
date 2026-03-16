# Flow Builder Extension Design

**Date:** 2026-03-16
**Status:** Draft
**Goal:** Extend the flow UI builder into a fully functional event-driven automation platform for Telegram and Discord, with shared user context, flow chaining, hybrid trigger routing, cross-platform abstractions, and improved editor UX.
**Future Direction:** Full visual bot builder (define entire bot behavior trees without code).

---

## Architecture Decision

**Stack:** Pure Postgres + Trigger.dev + WebSocket/SSE (no Redis, no new dependencies).

- **Shared context:** `UserFlowContext` Prisma model in Postgres. Read/write via flow nodes.
- **Hybrid triggers:** Bot middleware with local trigger registry synced from API. Simple matches fire Trigger.dev tasks directly; complex events relay to API.
- **Flow chaining:** Explicit via `triggerAndWait()` / `trigger()`. Event-based via `FlowEvent` table + Trigger.dev task invocation at emit time.
- **Debugging:** Execution results in `FlowExecution.nodeResults`, extended with context snapshots and event trace IDs, delivered via WebSocket.

---

## Sub-Project 1: Flow Engine Core

### 1.1 Shared User Context

#### New Prisma Models

```prisma
model UserFlowContext {
  id             String   @id @default(cuid())
  platformUserId String
  platform       String   // "telegram" | "discord"
  key            String
  value          Json
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([platformUserId, platform, key])
  @@index([platformUserId, platform])
}

model FlowEvent {
  id                String   @id @default(cuid())
  eventName         String
  payload           Json
  sourceFlowId      String
  sourceExecutionId String
  createdAt         DateTime @default(now())
  expiresAt         DateTime @default(dbgenerated("NOW() + INTERVAL '30 days'"))

  @@index([eventName])
  @@index([sourceFlowId])
  @@index([expiresAt])
}
```

**FlowEvent cleanup:** A scheduled Trigger.dev task (`flow-event-cleanup`) runs daily to delete expired events (`WHERE expiresAt < NOW()`). Fits naturally alongside existing scheduled tasks (health-check, analytics-snapshot).
```

#### New Flow Nodes

| Node | Category | Config | Description |
|------|----------|--------|-------------|
| `get_context` | action | `{ key: string, defaultValue?: any }` | Reads a key from UserFlowContext for current user. Output available as `{{node.<id>.value}}` |
| `set_context` | action | `{ key: string, value: string }` | Writes a key (supports `{{variable}}` interpolation) |
| `delete_context` | action | `{ key: string }` | Removes a context key |
| `context_condition` | condition | `{ key: string, operator: 'equals'\|'exists'\|'gt'\|'lt'\|'contains', value?: any }` | Branch based on context value |

#### Context Scoping

- Scoped by `(platformUserId, platform)` — Telegram and Discord users have separate contexts
- Cross-platform identity merge possible later via existing `UserIdentity` model
- Context operations receive `platformUserId` and `platform` from `triggerData` at execution time

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/db/prisma/schema.prisma` | Add `UserFlowContext` and `FlowEvent` models |
| `apps/trigger/src/lib/flow-engine/types.ts` | Add context-related types to `FlowContext` |
| `apps/trigger/src/lib/flow-engine/context-store.ts` | **New** — CRUD operations for `UserFlowContext` via Prisma |
| `apps/trigger/src/lib/flow-engine/actions.ts` | Add `get_context`, `set_context`, `delete_context` executors |
| `apps/trigger/src/lib/flow-engine/conditions.ts` | Add `context_condition` evaluator |
| `apps/trigger/src/lib/flow-engine/executor.ts` | Pass Prisma client and user identity to context operations |
| `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` | Add context nodes to `NODE_TYPES_CONFIG` |

### 1.2 Flow Chaining

#### Explicit Chaining — "Run Flow" Node

| Node | Category | Config |
|------|----------|--------|
| `run_flow` | action | `{ flowId: string, waitForResult: boolean, inputVariables?: Record<string, string> }` |

**Execution behavior:**
- `waitForResult: true` → `triggerAndWait('flow-execution', { flowId, triggerData: inputVariables })`. Result available as `{{node.<id>.output}}`. Errors propagate to parent flow.
- `waitForResult: false` → `trigger('flow-execution', { flowId, triggerData: inputVariables })`. Fire-and-forget, parent continues immediately.

**Executor integration:** `run_flow` is a special-cased node type in the executor (like `parallel_branch` and `db_query`). The executor receives a `taskCallbacks` config object containing `triggerAndWait` and `trigger` function references, injected by the Trigger.dev task `run` function. This avoids the executor importing the SDK directly.

```typescript
// In executor config (passed from flow-execution.ts task)
interface ExecutorConfig {
  prisma: PrismaClient;
  taskCallbacks?: {
    triggerAndWait: (taskId: string, payload: unknown) => Promise<unknown>;
    trigger: (taskId: string, payload: unknown) => Promise<void>;
  };
}
```

**Safeguards:**
- Max chain depth of 5 (tracked via `triggerData._chainDepth` counter, incremented on each `run_flow`)
- Circular reference detection at activation time — API validates no `run_flow` flowId cycles (direct references only). Event-based cycles via `emit_event`/`custom_event` are not statically detectable and are guarded at runtime by the chain depth limit.

#### Event-Based Chaining

| Node | Category | Config |
|------|----------|--------|
| `emit_event` | action | `{ eventName: string, payload?: Record<string, string> }` |
| `custom_event` | trigger | `{ eventName: string }` |

**Emit behavior:**
1. Write `FlowEvent` record to DB (audit trail)
2. Query active flows with `custom_event` trigger nodes matching `eventName`
3. Call `trigger('flow-execution', { flowId, triggerData: { event: eventName, ...payload } })` for each match
4. Non-blocking — emitter continues without waiting for listeners

**Matching logic:**
- At flow activation time, API extracts `custom_event` trigger nodes from `nodesJson` and caches the event-name-to-flowId mapping in memory on the API process
- `emit_event` queries this in-memory index at runtime via an internal API call
- No new schema field needed — the index is derived from `nodesJson` and rebuilt on API restart or flow activate/deactivate

#### Implementation Files

| File | Changes |
|------|---------|
| `apps/trigger/src/lib/flow-engine/actions.ts` | Add `run_flow` and `emit_event` executors |
| `apps/trigger/src/lib/flow-engine/executor.ts` | Add chain depth tracking, pass task references |
| `apps/trigger/src/trigger/flow-execution.ts` | Support `_chainDepth` in payload, enforce max depth |
| `apps/api/src/flows/flows.service.ts` | Add circular reference detection on activate, event listener index |
| `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` | Add `run_flow`, `emit_event`, `custom_event` nodes |

### 1.3 Hybrid Trigger Routing

#### Trigger Registry API

New endpoint: `GET /api/flows/trigger-registry`

```typescript
// Response
{
  triggers: Array<{
    flowId: string;
    nodeType: string;      // "command_received", "keyword_match", etc.
    config: Record<string, unknown>;
    platform: string;      // "telegram" | "discord"
  }>;
  version: number;         // increments on any flow activate/deactivate
}
```

- Bots fetch on startup and cache locally
- Bots poll `GET /api/flows/trigger-registry/version` periodically (every 30s) — returns just the version number. If changed, re-fetch full registry.
- Alternative: API calls bot's existing `/api/send-message` endpoint to push a "reload triggers" command on flow activate/deactivate

#### Bot Middleware

**Simple triggers (matched locally in bot process):**
- `command_received` — exact string match on command name
- `keyword_match` — string includes check
- `callback_query` — exact/prefix match on callback data
- `user_joins` / `user_leaves` — event type match
- `message_received` — always matches (catch-all)
- `discord_message_received`, `discord_member_join`, `discord_slash_command`, `discord_button_click`

**Complex triggers (relayed to API):**
- `regex_match` — regex evaluation
- `time_based` — time window check
- `context_condition` — requires DB lookup
- Multi-condition combinations
- Any trigger the bot doesn't recognize

**Matching algorithm:**
1. Incoming event → extract event type + metadata
2. Filter local registry by event type
3. For each matching trigger, evaluate config (keyword list, command name, etc.)
4. On match → `trigger('flow-execution', { flowId, triggerData })` via Trigger.dev SDK
5. Multiple flows can match the same event (all fire independently)

#### Implementation Files

| File | Changes |
|------|---------|
| `apps/api/src/flows/flows.controller.ts` | Add `trigger-registry` and `trigger-registry/version` endpoints |
| `apps/api/src/flows/flows.service.ts` | Build trigger registry from active flows, track version |
| `apps/manager-bot/src/bot/middlewares/flow-trigger.ts` | **New** — middleware that matches events against trigger registry |
| `apps/manager-bot/src/server/index.ts` | Add trigger registry fetch on startup |
| `apps/discord-bot/src/bot/events/flow-trigger.ts` | **New** — Discord event listener that matches events against trigger registry (uses discord.js event handler pattern, not grammY middleware) |
| `apps/api/src/flows/dto/index.ts` | Add MatchEventDto for complex trigger relay |

---

## Sub-Project 2: Transport Extension

### 2.1 Unified Cross-Platform Actions

New unified action nodes that resolve to platform-specific transport calls based on `transportConfig.platform`:

| Unified Node | Telegram Resolution | Discord Resolution |
|---|---|---|
| `unified_send_message` | `sendMessage` | `sendMessage` to channel |
| `unified_send_media` | `sendPhoto`/`sendVideo`/`sendDocument` (by mime) | `sendMessage` with file attachment |
| `unified_delete_message` | `deleteMessage` | `deleteMessage` |
| `unified_ban_user` | `banUser` | `banMember` |
| `unified_kick_user` | `banUser` + `unbanUser` (ban then immediately unban = kick) | `kickMember` |
| `unified_pin_message` | `pinMessage` | `pinMessage` |
| `unified_send_dm` | `sendMessage` to private chat | `sendDM` |
| `unified_set_role` | `promoteUser`/`restrictUser` | `addRole`/`removeRole` |

#### Config Structure

```typescript
{
  // Common fields
  text?: string;
  mediaUrl?: string;
  targetUserId?: string;
  targetChatId?: string;

  // Platform overrides (optional)
  telegramOverrides?: {
    parseMode?: 'HTML' | 'MarkdownV2';
    disableNotification?: boolean;
    replyToMessageId?: number;
  };
  discordOverrides?: {
    embed?: { title, description, color, fields };
    components?: ButtonComponent[];
  };
}
```

#### Dispatcher Changes

New `dispatchUnified()` function in `dispatcher.ts`:
1. Detect platform from `transportConfig.platform`
2. Map unified action name → platform-specific action name
3. Merge base config with platform overrides
4. Delegate to existing `dispatchToTelegram()` or `dispatchViaDiscordBotApi()`
5. For `cross_platform` → dispatch to both platforms, collect results

**Unified error envelope:** `dispatchUnified()` normalizes platform-specific errors into a common structure:
```typescript
interface UnifiedDispatchError {
  platform: 'telegram' | 'discord';
  code: string;         // normalized: 'RATE_LIMITED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'UNKNOWN'
  message: string;      // human-readable
  originalError?: unknown;
}
```

### 2.2 New Telegram-Specific Nodes

#### Triggers

| Node | Config |
|------|--------|
| `inline_result_chosen` | `{ resultIdPattern?: string }` |
| `pre_checkout_query` | `{}` |
| `successful_payment` | `{}` |
| `web_app_data` | `{ buttonText?: string }` |

#### Actions

| Node | Config |
|------|--------|
| `answer_inline_query` | `{ results: InlineQueryResult[], cacheTime?: number }` |
| `send_invoice` | `{ title, description, payload, currency, prices }` |
| `answer_pre_checkout` | `{ ok: boolean, errorMessage?: string }` |
| `set_chat_menu_button` | `{ menuButton: { type, text?, url? } }` |
| `send_media_group` | `{ chatId, media: Array<{ type, url, caption? }> }` |
| `create_forum_topic` | `{ chatId, name, iconColor?, iconEmojiId? }` |
| `set_my_commands` | `{ commands: Array<{ command, description }>, scope? }` |

### 2.3 New Discord-Specific Nodes

#### Triggers

| Node | Config |
|------|--------|
| `discord_slash_command` | `{ commandName: string }` |
| `discord_modal_submit` | `{ customId: string }` |
| `discord_select_menu` | `{ customId: string }` |
| `discord_button_click` | `{ customId: string }` |
| `discord_autocomplete` | `{ commandName: string, optionName: string }` |

#### Actions

| Node | Config |
|------|--------|
| `discord_reply_interaction` | `{ content?, embeds?, components?, ephemeral? }` |
| `discord_show_modal` | `{ customId, title, components: TextInput[] }` |
| `discord_send_components` | `{ channelId, content?, components: ActionRow[] }` |
| `discord_edit_interaction` | `{ content?, embeds?, components? }` |
| `discord_defer_reply` | `{ ephemeral?: boolean }` |
| `discord_set_channel_permissions` | `{ channelId, targetId, allow?, deny? }` |
| `discord_create_forum_post` | `{ channelId, name, content, tags? }` |
| `discord_register_commands` | `{ commands: ApplicationCommand[] }` — **Admin-only:** requires elevated flow permissions, not available to standard flow authors |

### 2.4 Transport Interface Extension

| File | Changes |
|------|---------|
| `packages/telegram-transport/src/transport/ITelegramTransport.ts` | Add methods: `answerInlineQuery`, `sendInvoice`, `answerPreCheckoutQuery`, `setChatMenuButton`, `sendMediaGroup`, `createForumTopic`, `setMyCommands` |
| `packages/telegram-transport/src/transport/GramJsTransport.ts` | Implement new methods via GramJS |
| `packages/telegram-transport/src/transport/FakeTelegramTransport.ts` | Add stubs |
| `packages/discord-transport/src/transport/IDiscordTransport.ts` | Add methods: `replyInteraction`, `showModal`, `sendComponents`, `editInteraction`, `deferReply`, `setChannelPermissions`, `createForumPost`, `registerCommands` |
| `packages/discord-transport/src/transport/DiscordJsTransport.ts` | Implement new methods via discord.js |
| `packages/discord-transport/src/transport/FakeDiscordTransport.ts` | Add stubs |
| `apps/trigger/src/lib/flow-engine/actions.ts` | Add all new action executors |
| `apps/trigger/src/lib/flow-engine/conditions.ts` | No new conditions needed |
| `apps/trigger/src/lib/flow-engine/dispatcher.ts` | Add `dispatchUnified()`, extend Telegram/Discord dispatch maps |
| `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` | Add all new nodes to `NODE_TYPES_CONFIG` |

---

## Sub-Project 3: Editor UX

### 3.1 Property Panel Overhaul

#### Architecture

```
components/flow-editor/
  property-panels/
    registry.ts              — Record<nodeType, ComponentType<PanelProps>>
    GenericPanel.tsx          — fallback key-value form
    SendMessagePanel.tsx     — message text + preview + parse mode
    SendEmbedPanel.tsx       — Discord embed builder with live preview
    ConditionPanel.tsx       — operator/value with type coercion
    RunFlowPanel.tsx         — flow picker + variable mapping
    ContextPanel.tsx         — key autocomplete from existing context keys
    UnifiedActionPanel.tsx   — base config + collapsible platform overrides
  VariableAutocomplete.tsx   — dropdown on `{{` with trigger.*, node.*, context keys
  MessagePreview.tsx         — renders Telegram bubble or Discord embed
  ValidationIndicator.tsx    — inline validation state per field
```

#### Panel Features

- **Typed inputs** — number fields for numeric configs, select dropdowns for enums, textarea for message text
- **Variable autocomplete** — typing `{{` opens dropdown listing: `trigger.*` fields (from trigger node type), `node.<id>.*` outputs (from upstream nodes), context keys (fetched from API), loop variables
- **Inline validation** — Valibot schemas per node type, red border + error text on invalid fields, disable "Save" until valid
- **Message preview** — live-rendered preview for `send_message` (Telegram bubble), `discord_send_embed` (Discord card), `unified_send_message` (both side by side)

### 3.2 Execution Debugger

#### Step-Through Debug Mode

- New `POST /api/flows/:id/debug-execute` endpoint — same as `test-execute` but sets `debugMode: true`
- **Pause mechanism:** Uses a DB-based flag rather than Trigger.dev `wait.for` (which requires v4). The executor checks a `FlowDebugState` record between node executions:
  - `FlowDebugState { executionId, status: 'paused'|'running'|'step'|'cancelled', pausedAtNodeId? }` — stored in DB
  - After each node, executor queries `FlowDebugState`. If `status === 'paused'`, polls every 500ms (max 5 minutes timeout) until status changes
  - Emits progress via WebSocket after each node completion
- Frontend shows "Continue" / "Step" / "Run to End" / "Cancel" controls
- "Continue" sends `PATCH /api/flows/debug/:executionId` with `{ status: 'running' }` — executor resumes and runs to next breakpoint or end
- "Step" sends `{ status: 'step' }` — executor runs one node then re-pauses

#### Variable Inspector

- Sidebar panel visible during debug/test execution
- Shows three tabs:
  - **Variables** — current `FlowContext.variables` map
  - **Context** — current user's `UserFlowContext` entries (fetched from API)
  - **Node Results** — output of each completed node
- Updates in real-time via WebSocket as execution progresses

#### Execution Timeline

- Horizontal bar at bottom of editor during execution replay
- Each node shown as a segment: color-coded (green=success, red=error, gray=skipped, yellow=in-progress)
- Click a segment to highlight the node on canvas and show its result in inspector
- Duration label on each segment

#### Event Trace

- When `run_flow` or `emit_event` nodes execute, the child execution gets a `traceId` linking back to parent
- Timeline shows nested executions as indented rows
- Click to navigate to child flow's execution view

#### Implementation Files

| File | Changes |
|------|---------|
| `apps/api/src/flows/flows.controller.ts` | Add `debug-execute` and `debug/continue` endpoints |
| `apps/api/src/flows/flows.service.ts` | Debug execution logic with Trigger.dev wait tokens |
| `apps/trigger/src/trigger/flow-execution.ts` | Add `debugMode` check, emit progress via WebSocket, wait between nodes |
| `apps/trigger/src/lib/flow-engine/executor.ts` | Add `onNodeComplete` callback hook for debug emission |
| `apps/api/src/events/ws.gateway.ts` | Add `flow-debug` channel for execution progress |
| `apps/frontend/src/components/flow-editor/ExecutionDebugger.tsx` | **New** — debug controls, variable inspector, timeline |
| `apps/frontend/src/components/flow-execution-overlay.tsx` | Extend with debug breakpoint indicators |

### 3.3 Organization at Scale

#### Subflows

- Not a separate node type — `run_flow` with `waitForResult: true` is automatically rendered in "subflow" visual style
- Rendered as a distinct box with flow name, colored border, expand icon
- Read-only inline preview on expand (shows miniature node graph)
- The editor detects `run_flow` nodes with `waitForResult: true` and applies the subflow visual treatment via a custom ReactFlow node renderer

#### Flow Folders

```prisma
model FlowFolder {
  id        String          @id @default(cuid())
  name      String
  parentId  String?
  parent    FlowFolder?     @relation("FolderTree", fields: [parentId], references: [id])
  children  FlowFolder[]    @relation("FolderTree")
  order     Int             @default(0)
  flows     FlowDefinition[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}
```

- `FlowDefinition` gets `folderId String?` + relation to `FlowFolder`
- Max folder depth: 3 levels (enforced at API layer when creating/moving folders)
- API: CRUD endpoints for folders under `/api/flows/folders`
- Frontend: tree view in flow list page with drag-drop reorder, create/rename/delete folder

#### Node Palette Improvements

- **Search bar** — fuzzy search across all node types (name + description)
- **Recently used** — top section showing last 8 used node types (stored in localStorage)
- **Collapsible categories** — each category header shows count badge, remembers collapsed state
- **Platform filter** — persisted to localStorage

#### Canvas Improvements

- **Node grouping** — select multiple nodes → right-click → "Create Group". Renders a labeled bounding box around selected nodes. Groups are visual only (not executed differently).
- **Sticky notes** — annotation-only nodes (category: `annotation`). Config: `{ text: string, color: string }`. Not part of execution graph.
- **Minimap** — already exists via ReactFlow. Extend to show group boundaries and subflow indicators.

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/db/prisma/schema.prisma` | Add `FlowFolder` model, add `folderId` to `FlowDefinition` |
| `apps/api/src/flows/flows.controller.ts` | Add folder CRUD endpoints |
| `apps/api/src/flows/flows.service.ts` | Folder operations, flow-folder assignment |
| `apps/frontend/src/app/dashboard/flows/page.tsx` | Tree view with folders, drag-drop |
| `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` | Search bar, recently used, subflow node, sticky notes, grouping |
| `apps/frontend/src/components/flow-editor/NodePalette.tsx` | **New** — extracted from edit page, search + categories + recent |
| `apps/frontend/src/components/flow-editor/NodeGroup.tsx` | **New** — visual grouping component |
| `apps/frontend/src/components/flow-editor/StickyNote.tsx` | **New** — annotation node |
| `apps/frontend/src/components/flow-editor/SubflowNode.tsx` | **New** — subflow visualization |

---

## Shared Infrastructure

### Validation Package

New `packages/flow-shared/` package for schemas shared between frontend and trigger engine:

```
packages/flow-shared/
  src/
    node-configs/         — Valibot schemas per node type
    node-registry.ts      — master list of all node types with metadata
    variable-types.ts     — variable interpolation types
    index.ts
  package.json
  tsconfig.json
```

This eliminates the duplicate node type definitions currently split between frontend (`NODE_TYPES_CONFIG`) and trigger engine (`actions.ts` + `conditions.ts`).

**Migration plan:**
1. Move `NODE_TYPES_CONFIG` from the editor page to `packages/flow-shared/src/node-registry.ts`
2. Import from `@tg-allegro/flow-shared` in the frontend
3. Use the same registry in `actions.ts` / `conditions.ts` for exhaustiveness checks
4. This migration happens in Phase 2A (first phase of SP2) as a prerequisite for adding unified nodes

### Testing Strategy

| Sub-Project | Test Type | Target |
|---|---|---|
| SP1: Context | Unit | context-store CRUD, context condition evaluator |
| SP1: Chaining | Unit + Integration | run_flow with triggerAndWait mock, emit_event → listener matching |
| SP1: Triggers | Unit + Integration | trigger registry API, bot middleware matching |
| SP2: Unified | Unit | dispatchUnified mapping, platform resolution |
| SP2: New nodes | Unit | each new action executor, new condition evaluator |
| SP2: Transport | Unit | new ITelegramTransport/IDiscordTransport methods via FakeTransport |
| SP3: Panels | Unit | Valibot schema validation, variable autocomplete logic |
| SP3: Debugger | Integration | debug-execute → WebSocket → continue flow |
| SP3: Folders | Unit + Integration | folder CRUD, flow-folder assignment |
| SP3: Editor | E2E | add nodes from palette, configure via property panel, test execution with debugger, create/move flow folders |

### Additional Implementation Files (Cross-Cutting)

Files not listed in individual sub-project sections but requiring changes:

| File | Sub-Project | Changes |
|------|-------------|---------|
| `apps/trigger/src/lib/flow-engine/executor.ts` — `NON_CACHEABLE_TYPES` | SP1 + SP2 | Add all new side-effect node types. Consider refactoring to a cacheable whitelist instead of non-cacheable blacklist. |
| `apps/trigger/src/lib/flow-engine/variables.ts` | SP1 | Add `context.*` interpolation namespace for reading UserFlowContext inline |
| `apps/trigger/src/lib/flow-engine/index.ts` | SP1 | Re-export new modules (context-store) |
| `apps/api/src/flows/flows.module.ts` | SP1 + SP3 | Register new controllers/services for trigger registry, folders, debug |
| `apps/api/src/flows/dto/` | SP1 + SP3 | Add DTOs for folder CRUD, debug endpoints, trigger registry responses |
| `apps/discord-bot/src/server/index.ts` | SP2 | Add new action cases for Discord interaction actions |
| `apps/api/src/flows/flows.controller.ts` | SP3 | Add `GET /api/flows/context-keys` endpoint for variable autocomplete |
| `packages/db/prisma/schema.prisma` — `FlowDefinition` | SP3 | Add `folderId` field + relation to `FlowFolder` |
| `apps/trigger/src/trigger/flow-event-cleanup.ts` | SP1 | **New** — scheduled task to prune expired `FlowEvent` records |

### Notes on `context_condition`

`context_condition` is a **condition node only** (not a trigger). When it appears in a flow, the hybrid trigger routing system classifies any triggers in that flow as "complex" — meaning the bot relays the event to the API rather than matching locally. This is because evaluating `context_condition` requires a DB lookup that the bot process cannot perform efficiently.

---

## Build Order

1. **Sub-Project 1: Flow Engine Core** (foundation — other sub-projects depend on context and chaining)
   - Phase 1A: UserFlowContext model + context nodes + tests
   - Phase 1B: FlowEvent model + run_flow + emit_event + custom_event + tests
   - Phase 1C: Trigger registry API + bot middleware + tests

2. **Sub-Project 2: Transport Extension** (extends engine with new capabilities)
   - Phase 2A: Unified action nodes + dispatchUnified + tests
   - Phase 2B: New Telegram nodes + transport interface + tests
   - Phase 2C: New Discord nodes + transport interface + tests

3. **Sub-Project 3: Editor UX** (frontend improvements, can partially parallel with SP2)
   - Phase 3A: Property panel overhaul + validation + variable autocomplete
   - Phase 3B: Execution debugger + variable inspector + timeline
   - Phase 3C: Folders + subflows + node palette + canvas improvements
