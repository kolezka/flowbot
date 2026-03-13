# Wire Flow Engine to Telegram — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the flow engine action executor to real Telegram delivery so that action nodes (send_message, ban_user, etc.) actually execute against Telegram, not just return data objects.

**Current State:** The flow engine evaluates flows correctly (triggers fire, conditions evaluate, BFS traversal works) but all 30+ action executors return `{ action: '...', executed: true }` data objects that get saved to the database without ever reaching Telegram. The only exception is `bot_action`, which makes an HTTP call to a bot instance API.

---

## Architecture Overview

### What Exists Today

```
Manager Bot (grammY)                      Trigger.dev Worker
├─ Middleware: flow-events.ts             ├─ flow-execution task
│  └─ Captures events → triggers task     │  └─ executeFlow() → BFS traversal
│                                          │     ├─ Triggers: ✅ work
│                                          │     ├─ Conditions: ✅ work
│                                          │     └─ Actions: ❌ return data objects only
│                                          │
│                                          ├─ lib/telegram.ts
│                                          │  ├─ getTelegramTransport() → GramJsTransport (MTProto)
│                                          │  └─ getActionRunner() → CircuitBreaker + retry
│                                          │  (Available but NOT used by flow-execution)
│                                          │
│                                          └─ lib/manager-bot.ts
│                                             └─ sendMessageViaManagerBot() → HTTP POST
│                                             (Available but NOT used by flow-execution)

telegram-transport Package
├─ GramJsTransport: sendMessage(), forwardMessage(), resolveUsername()
├─ ActionRunner: retry, idempotency, error classification
├─ CircuitBreaker: fault tolerance (5 failures → 30s open)
└─ 5 ActionTypes: SEND_MESSAGE, FORWARD_MESSAGE, SEND_WELCOME_DM, CROSS_POST, BROADCAST
```

### Target Architecture

```
Flow Execution Task
  └─ executeFlow() → BFS traversal
     └─ Action node executed
        └─ NEW: ActionDispatcher
           ├─ Route 1: GramJsTransport (MTProto/tg-client)
           │  └─ For: send_message, send_photo, forward, ban, mute, restrict, etc.
           │  └─ Uses: getTelegramTransport() + ActionRunner (retry/circuit-breaker)
           │
           ├─ Route 2: Bot Instance HTTP API (grammY)
           │  └─ For: bot_action (existing), could extend to all actions
           │  └─ Uses: BotInstance.apiUrl → POST /api/send-message
           │
           └─ Route 3: Direct (no Telegram)
              └─ For: delay, api_call, db_query, transform, loop, switch
```

---

## What's Missing — Inventory

### A. telegram-transport: Missing Methods on GramJsTransport

The GramJsTransport class only has 3 Telegram methods. The flow engine needs 25+ more:

| Category | Missing Methods | GramJS API |
|----------|----------------|------------|
| **Messaging** | sendPhoto, sendVideo, sendDocument, sendSticker, sendVoice, sendAudio, sendAnimation, sendContact, sendLocation, sendVenue, sendDice, sendMediaGroup | `client.sendFile()`, `client.invoke(Api.messages.SendMedia(...))` |
| **Message Mgmt** | copyMessage, editMessage, deleteMessage, pinMessage, unpinMessage | `Api.messages.ForwardMessages` (no fwd header), `EditMessage`, `DeleteMessages`, `UpdatePinnedMessage` |
| **User Mgmt** | banUser, muteUser, restrictUser, promoteUser | `Api.channels.EditBanned`, `Api.channels.EditAdmin` |
| **Chat Mgmt** | setChatTitle, setChatDescription, setChatPhoto, deleteChatPhoto, exportInviteLink, getChatMember, getChatInfo, leaveChat, approveJoinRequest | `Api.channels.EditTitle`, `Api.channels.EditAbout`, `Api.channels.EditPhoto`, `Api.channels.ExportInvite`, `Api.channels.GetParticipant`, `Api.channels.LeaveChannel` |
| **Interactive** | createPoll, answerCallbackQuery | `Api.messages.SendMedia` (with poll), `Api.messages.SetBotCallbackAnswer` |

### B. Manager Bot: Missing HTTP Endpoints

Manager bot currently exposes only `POST /api/send-message`. For bot-based flow execution, it would need endpoints for all action types, or a generic action dispatcher endpoint.

### C. Flow Executor: Missing Dispatch Layer

`flow-execution.ts` calls `executeFlow()` and saves results. It needs a post-execution dispatch step.

---

## Chunk 1: Create ActionDispatcher in Flow Engine

> Priority: HIGH — This is the core wiring layer

### Task 1: Create dispatcher module

**Files:**
- Create: `apps/trigger/src/lib/flow-engine/dispatcher.ts`

- [ ] **Step 1: Define ActionDispatch interface**

```typescript
// apps/trigger/src/lib/flow-engine/dispatcher.ts

import type { FlowContext, NodeResult } from './types.js'
import { getTelegramTransport, getActionRunner } from '../telegram.js'
import { sendMessageViaManagerBot } from '../manager-bot.js'
import { getPrisma } from '../prisma.js'
import { logger } from '@trigger.dev/sdk/v3'

export interface DispatchResult {
  nodeId: string
  dispatched: boolean
  response?: unknown
  error?: string
}

/** Actions that are handled internally (no Telegram call needed). */
const INTERNAL_ACTIONS = new Set([
  'delay', 'api_call', 'db_query', 'transform', 'loop', 'switch',
  'parallel_branch', 'notification', 'bot_action',
])

/** Actions that require Telegram transport (MTProto). */
const TELEGRAM_ACTIONS = new Set([
  'send_message', 'send_photo', 'forward_message', 'copy_message',
  'edit_message', 'delete_message', 'pin_message', 'unpin_message',
  'ban_user', 'mute_user', 'restrict_user', 'promote_user',
  'create_poll', 'answer_callback_query',
  'send_video', 'send_document', 'send_sticker', 'send_location',
  'send_voice', 'send_contact', 'send_animation', 'send_venue',
  'send_dice', 'send_media_group', 'send_audio',
  'set_chat_title', 'set_chat_description', 'export_invite_link',
  'get_chat_member', 'get_chat_info', 'set_chat_photo',
  'delete_chat_photo', 'leave_chat', 'approve_join_request',
])
```

- [ ] **Step 2: Implement dispatchActions()**

```typescript
/**
 * After flow execution completes, dispatch action results to Telegram.
 * Iterates nodeResults, finds action outputs, and routes them to the transport layer.
 */
export async function dispatchActions(
  ctx: FlowContext,
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = []

  for (const [nodeId, result] of ctx.nodeResults) {
    if (result.status !== 'success' || !result.output) continue

    const output = result.output as Record<string, unknown>
    const action = output.action as string | undefined
    if (!action) continue

    // Skip internal actions (already executed during flow)
    if (INTERNAL_ACTIONS.has(action)) continue

    // Dispatch Telegram actions
    if (TELEGRAM_ACTIONS.has(action)) {
      try {
        const response = await dispatchTelegramAction(action, output)
        results.push({ nodeId, dispatched: true, response })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        logger.error(`Dispatch failed for ${action} on node ${nodeId}: ${msg}`)
        results.push({ nodeId, dispatched: false, error: msg })
      }
    }
  }

  return results
}
```

- [ ] **Step 3: Implement dispatchTelegramAction() router**

Route each action type to the appropriate GramJsTransport method. Start with the methods that already exist (`sendMessage`, `forwardMessage`), and use a fallback stub for methods not yet on GramJsTransport.

```typescript
async function dispatchTelegramAction(
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const transport = await getTelegramTransport()

  switch (action) {
    case 'send_message': {
      return transport.sendMessage(
        String(params.chatId),
        String(params.text),
        {
          parseMode: String(params.parseMode ?? 'HTML'),
          silent: Boolean(params.disableNotification),
          replyToMsgId: params.replyToMessageId ? Number(params.replyToMessageId) : undefined,
        },
      )
    }
    case 'forward_message': {
      return transport.forwardMessage(
        String(params.fromChatId),
        String(params.toChatId),
        [Number(params.messageId)],
      )
    }
    // ... more cases as GramJsTransport methods are added ...
    default:
      logger.warn(`Telegram action '${action}' not yet implemented in transport layer`)
      return { action, dispatched: false, reason: 'not_implemented' }
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm trigger typecheck 2>&1 | tail -10`

### Task 2: Integrate dispatcher into flow-execution task

**Files:**
- Modify: `apps/trigger/src/trigger/flow-execution.ts`

- [ ] **Step 1: Call dispatchActions after executeFlow**

After `executeFlow()` returns and before writing to DB, call the dispatcher:

```typescript
import { dispatchActions } from '../lib/flow-engine/dispatcher.js'

// ... existing code ...

const ctx = await executeFlow(nodes, edges, enrichedTriggerData)

// NEW: Dispatch action results to Telegram
const dispatchResults = await dispatchActions(ctx)

// Merge dispatch results back into nodeResults for logging
for (const dr of dispatchResults) {
  const existing = ctx.nodeResults.get(dr.nodeId)
  if (existing) {
    existing.output = {
      ...(existing.output as Record<string, unknown>),
      _dispatch: {
        dispatched: dr.dispatched,
        response: dr.response,
        error: dr.error,
      },
    }
    if (!dr.dispatched && dr.error) {
      existing.status = 'error'
      existing.error = `Dispatch failed: ${dr.error}`
    }
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm trigger typecheck 2>&1 | tail -10`

- [ ] **Step 3: Run trigger tests**

Run: `pnpm trigger test 2>&1 | tail -20`
Expected: Existing tests pass (they mock executeFlow, shouldn't be affected)

---

## Chunk 2: Expand GramJsTransport with Missing Methods

> Priority: HIGH — Without these, dispatcher has no transport methods to call

### Task 3: Add messaging methods to GramJsTransport

**Files:**
- Modify: `packages/telegram-transport/src/transport/ITelegramTransport.ts`
- Modify: `packages/telegram-transport/src/transport/GramJsTransport.ts`

- [ ] **Step 1: Add interface methods**

Add to `ITelegramTransport`:

```typescript
// Media messaging
sendPhoto(peer: string | bigint, photoUrl: string, options?: MediaOptions): Promise<MessageResult>
sendVideo(peer: string | bigint, videoUrl: string, options?: MediaOptions): Promise<MessageResult>
sendDocument(peer: string | bigint, documentUrl: string, options?: MediaOptions): Promise<MessageResult>
sendSticker(peer: string | bigint, sticker: string): Promise<MessageResult>
sendVoice(peer: string | bigint, voiceUrl: string, options?: MediaOptions): Promise<MessageResult>
sendAudio(peer: string | bigint, audioUrl: string, options?: MediaOptions): Promise<MessageResult>
sendAnimation(peer: string | bigint, animationUrl: string, options?: MediaOptions): Promise<MessageResult>
sendLocation(peer: string | bigint, latitude: number, longitude: number, options?: LocationOptions): Promise<MessageResult>
sendContact(peer: string | bigint, phoneNumber: string, firstName: string, lastName?: string): Promise<MessageResult>
sendVenue(peer: string | bigint, latitude: number, longitude: number, title: string, address: string): Promise<MessageResult>
sendDice(peer: string | bigint, emoji?: string): Promise<MessageResult>

// Message management
copyMessage(fromPeer: string | bigint, toPeer: string | bigint, messageId: number): Promise<MessageResult>
editMessage(peer: string | bigint, messageId: number, text: string, options?: SendOptions): Promise<MessageResult>
deleteMessages(peer: string | bigint, messageIds: number[]): Promise<boolean>
pinMessage(peer: string | bigint, messageId: number, silent?: boolean): Promise<boolean>
unpinMessage(peer: string | bigint, messageId?: number): Promise<boolean>

// User management
banUser(peer: string | bigint, userId: string | bigint): Promise<boolean>
unbanUser(peer: string | bigint, userId: string | bigint): Promise<boolean>
restrictUser(peer: string | bigint, userId: string | bigint, permissions: ChatPermissions, untilDate?: number): Promise<boolean>
promoteUser(peer: string | bigint, userId: string | bigint, privileges: AdminPrivileges): Promise<boolean>

// Chat management
setChatTitle(peer: string | bigint, title: string): Promise<boolean>
setChatDescription(peer: string | bigint, description: string): Promise<boolean>
exportInviteLink(peer: string | bigint): Promise<string>
getChatMember(peer: string | bigint, userId: string | bigint): Promise<ChatMemberInfo>
leaveChat(peer: string | bigint): Promise<boolean>

// Interactive
createPoll(peer: string | bigint, question: string, options: string[], pollOptions?: PollOptions): Promise<MessageResult>
answerCallbackQuery(queryId: string, text?: string, showAlert?: boolean): Promise<boolean>
```

- [ ] **Step 2: Implement methods in GramJsTransport**

Each method wraps the corresponding GramJS `Api.*` TL call. Example for `sendPhoto`:

```typescript
async sendPhoto(peer: string | bigint, photoUrl: string, options?: MediaOptions): Promise<MessageResult> {
  const inputPeer = await this.resolveInputPeer(peer)
  const result = await this.client.sendFile(inputPeer, {
    file: photoUrl,
    caption: options?.caption,
    parseMode: options?.parseMode as any,
    silent: options?.silent,
  })
  return this.toMessageResult(result)
}
```

Key GramJS API mappings:
- `sendFile()` → photos, videos, documents, voice, audio, animation, sticker
- `client.invoke(new Api.messages.EditMessage(...))` → edit
- `client.invoke(new Api.messages.DeleteMessages(...))` → delete
- `client.invoke(new Api.messages.UpdatePinnedMessage(...))` → pin/unpin
- `client.invoke(new Api.channels.EditBanned(...))` → ban/restrict
- `client.invoke(new Api.channels.EditAdmin(...))` → promote
- `client.invoke(new Api.channels.EditTitle(...))` → set title
- `client.invoke(new Api.channels.EditAbout(...))` → set description
- `client.invoke(new Api.messages.ExportChatInvite(...))` → invite link
- `client.invoke(new Api.channels.GetParticipant(...))` → get member
- `client.invoke(new Api.channels.LeaveChannel(...))` → leave chat
- `client.invoke(new Api.messages.SendMedia(...))` with `Api.InputMediaPoll` → create poll

- [ ] **Step 3: Add type definitions for new options**

```typescript
export interface MediaOptions {
  caption?: string
  parseMode?: string
  silent?: boolean
  replyToMsgId?: number
  fileName?: string
  duration?: number
  width?: number
  height?: number
}

export interface LocationOptions {
  livePeriod?: number
}

export interface ChatPermissions {
  canSendMessages?: boolean
  canSendMedia?: boolean
  canSendPolls?: boolean
  canSendOther?: boolean
  canAddWebPagePreviews?: boolean
  canChangeInfo?: boolean
  canInviteUsers?: boolean
  canPinMessages?: boolean
}

export interface AdminPrivileges {
  canManageChat?: boolean
  canDeleteMessages?: boolean
  canManageVideoChats?: boolean
  canRestrictMembers?: boolean
  canPromoteMembers?: boolean
  canChangeInfo?: boolean
  canInviteUsers?: boolean
  canPinMessages?: boolean
}

export interface PollOptions {
  isAnonymous?: boolean
  allowsMultipleAnswers?: boolean
  type?: 'regular' | 'quiz'
  correctOptionId?: number
}

export interface ChatMemberInfo {
  userId: string
  status: string
  permissions?: ChatPermissions
}
```

- [ ] **Step 4: Update CircuitBreaker to proxy new methods**

The CircuitBreaker wraps ITelegramTransport. All new methods must be proxied through it.

- [ ] **Step 5: Run tests and typecheck**

Run:
```bash
pnpm telegram-transport test 2>&1 | tail -20
pnpm telegram-transport typecheck 2>&1 | tail -10
```

---

## Chunk 3: Complete Dispatcher ↔ Transport Wiring

> Priority: HIGH — Once transport methods exist, wire them all into the dispatcher

### Task 4: Complete all dispatch cases

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`

- [ ] **Step 1: Add all switch cases to dispatchTelegramAction()**

Map every action type to the corresponding GramJsTransport method call, reading params from the action output objects.

- [ ] **Step 2: Add error handling per action type**

Some actions are critical (ban_user) and some are best-effort (send_dice). Add severity classification.

- [ ] **Step 3: Add dispatch metrics logging**

Log: action type, chatId (redacted), success/failure, latency.

---

## Chunk 4: Manager Bot Route (Bot API Alternative)

> Priority: MEDIUM — Alternative transport for actions that need Bot API tokens

### Task 5: Add generic action endpoint to manager bot

**Files:**
- Modify: `apps/manager-bot/src/server/index.ts`

- [ ] **Step 1: Add POST /api/execute-action endpoint**

```typescript
app.post('/api/execute-action', async (c) => {
  const { action, params } = await c.req.json()

  switch (action) {
    case 'send_message':
      const result = await bot.api.sendMessage(params.chatId, params.text, {
        parse_mode: params.parseMode,
        disable_notification: params.disableNotification,
      })
      return c.json({ success: true, messageId: result.message_id })

    case 'send_photo':
      // ...
    case 'ban_user':
      // ...
    // etc.
  }
})
```

- [ ] **Step 2: Add Bot API method implementations for all 30+ actions**

grammY has native methods for ALL Telegram Bot API calls:
- `bot.api.sendMessage()`, `sendPhoto()`, `sendVideo()`, `sendDocument()`
- `bot.api.forwardMessage()`, `copyMessage()`, `editMessageText()`
- `bot.api.deleteMessage()`, `pinChatMessage()`, `unpinChatMessage()`
- `bot.api.banChatMember()`, `restrictChatMember()`, `promoteChatMember()`
- `bot.api.setChatTitle()`, `setChatDescription()`, `exportChatInviteLink()`
- `bot.api.sendPoll()`, `answerCallbackQuery()`
- etc.

### Task 6: Add bot route to dispatcher

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`

- [ ] **Step 1: Add transport selection logic**

```typescript
type TransportRoute = 'mtproto' | 'bot_api'

function selectTransport(action: string, ctx: FlowContext): TransportRoute {
  // If flow has a botInstanceId configured, use Bot API
  if (ctx.variables.get('botInstanceId')) return 'bot_api'
  // Default to MTProto (tg-client)
  return 'mtproto'
}
```

- [ ] **Step 2: Implement Bot API dispatch path**

```typescript
async function dispatchViaBotApi(
  action: string,
  params: Record<string, unknown>,
  botInstanceId?: string,
): Promise<unknown> {
  const prisma = getPrisma()
  const botInstance = await prisma.botInstance.findUnique({
    where: { id: botInstanceId },
  })

  if (!botInstance?.apiUrl || !botInstance.isActive) {
    throw new Error(`Bot instance ${botInstanceId} not available`)
  }

  const response = await fetch(`${botInstance.apiUrl}/api/execute-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Bot API returned ${response.status}`)
  }

  return response.json()
}
```

---

## Chunk 5: Add Flow-Level Transport Configuration

> Priority: MEDIUM — Let users choose MTProto vs Bot API per flow

### Task 7: Add transport config to FlowDefinition

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/db/src/flow-types.ts`
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`
- Modify: `apps/api/src/flows/flows.service.ts`

- [ ] **Step 1: Add transportConfig to FlowDefinitionData**

```typescript
export interface FlowTransportConfig {
  /** Which transport to use for action execution */
  transport: 'mtproto' | 'bot_api' | 'auto'
  /** Bot instance ID (required if transport is 'bot_api') */
  botInstanceId?: string
}

export interface FlowDefinitionData {
  nodes: FlowNode[]
  edges: FlowEdge[]
  transportConfig?: FlowTransportConfig  // NEW
}
```

- [ ] **Step 2: Add transport selector to flow editor UI**

In the flow editor settings panel, add a dropdown:
- "MTProto (User Account)" — uses tg-client session
- "Bot API" — uses selected bot instance
- "Auto" — prefers bot API if botInstanceId set, falls back to MTProto

- [ ] **Step 3: Pass transportConfig through to dispatcher**

Read from FlowDefinition when creating FlowContext, pass to `dispatchActions()`.

---

## Chunk 6: Tests

> Priority: HIGH — Validate the wiring works

### Task 8: Unit tests for dispatcher

**Files:**
- Create: `apps/trigger/src/__tests__/flow-dispatcher.test.ts`

- [ ] **Step 1: Test action routing**

```typescript
describe('dispatchActions', () => {
  it('dispatches send_message to telegram transport', async () => { ... })
  it('skips internal actions (delay, api_call)', async () => { ... })
  it('handles transport errors gracefully', async () => { ... })
  it('returns dispatch results for each action node', async () => { ... })
  it('routes to bot_api when botInstanceId is set', async () => { ... })
})
```

- [ ] **Step 2: Test GramJsTransport new methods**

```typescript
describe('GramJsTransport extended methods', () => {
  it('sendPhoto calls client.sendFile with photo', async () => { ... })
  it('banUser calls Api.channels.EditBanned', async () => { ... })
  it('editMessage calls Api.messages.EditMessage', async () => { ... })
  // etc.
})
```

### Task 9: Integration test for full flow pipeline

**Files:**
- Create: `apps/trigger/src/__tests__/flow-e2e.test.ts`

- [ ] **Step 1: Test complete flow: trigger → condition → action → dispatch**

Mock the transport layer and verify the full pipeline from trigger data to dispatch call.

---

## Execution Order

| Order | Chunk | Tasks | Estimated Effort |
|-------|-------|-------|-----------------|
| 1 | Chunk 1 | Tasks 1-2 | Create dispatcher + integrate into flow-execution | Small |
| 2 | Chunk 2 | Task 3 | Expand GramJsTransport (25+ methods) | Large |
| 3 | Chunk 3 | Task 4 | Complete dispatcher ↔ transport wiring | Medium |
| 4 | Chunk 6 | Tasks 8-9 | Tests | Medium |
| 5 | Chunk 4 | Tasks 5-6 | Manager bot route (optional, Bot API alt) | Medium |
| 6 | Chunk 5 | Task 7 | Per-flow transport config UI | Small |

**Minimum viable wiring:** Chunks 1 + 2 + 3 = flow actions execute via MTProto.
**Full feature:** All chunks = user chooses MTProto or Bot API per flow.
