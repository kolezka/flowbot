# Sub-Project 2: Transport Extension — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unified cross-platform action nodes, new Telegram-specific nodes (inline, payments, forum), and new Discord-specific nodes (slash commands, modals, components) to the flow engine and transports.

**Architecture:** New `dispatchUnified()` function resolves platform-agnostic actions to platform-specific transport calls. Transport interfaces (`ITelegramTransport`, `IDiscordTransport`) extended with new methods. `flow-shared` package created to share node type definitions between frontend and engine.

**Tech Stack:** Prisma 7, GramJS, discord.js, Vitest, ReactFlow

**Spec:** `docs/superpowers/specs/2026-03-16-flow-builder-extension-design.md` — Section "Sub-Project 2"

**Depends on:** SP1 (completed) — uses `ExecutorConfig.taskCallbacks`, `NON_CACHEABLE_TYPES` patterns

---

## Chunk 1: Phase 2A — Unified Cross-Platform Actions

### Task 1: Create flow-shared Package

**Files:**
- Create: `packages/flow-shared/package.json`
- Create: `packages/flow-shared/tsconfig.json`
- Create: `packages/flow-shared/src/index.ts`
- Create: `packages/flow-shared/src/node-registry.ts`
- Modify: `pnpm-workspace.yaml` (if not already including `packages/*`)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@tg-allegro/flow-shared",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create node registry**

Create `packages/flow-shared/src/node-registry.ts`. Move the `NODE_TYPES_CONFIG` from `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` here, adding a `platform` field to each entry:

```typescript
export interface NodeTypeDefinition {
  type: string
  label: string
  category: 'trigger' | 'condition' | 'action' | 'advanced' | 'annotation'
  platform: 'telegram' | 'discord' | 'general'
  description?: string
}

export const NODE_TYPES: NodeTypeDefinition[] = [
  // === TELEGRAM TRIGGERS ===
  { type: 'message_received', label: 'Message Received', category: 'trigger', platform: 'telegram' },
  { type: 'user_joins', label: 'User Joins', category: 'trigger', platform: 'telegram' },
  { type: 'user_leaves', label: 'User Leaves', category: 'trigger', platform: 'telegram' },
  { type: 'callback_query', label: 'Button Click', category: 'trigger', platform: 'telegram' },
  { type: 'command_received', label: 'Command', category: 'trigger', platform: 'telegram' },
  { type: 'message_edited', label: 'Message Edited', category: 'trigger', platform: 'telegram' },
  { type: 'chat_member_updated', label: 'Member Status', category: 'trigger', platform: 'telegram' },
  { type: 'schedule', label: 'Schedule', category: 'trigger', platform: 'telegram' },
  { type: 'webhook', label: 'Webhook', category: 'trigger', platform: 'telegram' },
  { type: 'poll_answer', label: 'Poll Answer', category: 'trigger', platform: 'telegram' },
  { type: 'inline_query', label: 'Inline Query', category: 'trigger', platform: 'telegram' },
  { type: 'my_chat_member', label: 'Bot Status Change', category: 'trigger', platform: 'telegram' },
  { type: 'new_chat_title', label: 'Chat Title Changed', category: 'trigger', platform: 'telegram' },
  { type: 'new_chat_photo', label: 'Chat Photo Changed', category: 'trigger', platform: 'telegram' },
  // New Telegram triggers (SP2)
  { type: 'inline_result_chosen', label: 'Inline Result Chosen', category: 'trigger', platform: 'telegram' },
  { type: 'pre_checkout_query', label: 'Pre-Checkout', category: 'trigger', platform: 'telegram' },
  { type: 'successful_payment', label: 'Payment Success', category: 'trigger', platform: 'telegram' },
  { type: 'web_app_data', label: 'Web App Data', category: 'trigger', platform: 'telegram' },

  // === TELEGRAM CONDITIONS ===
  // ... (copy all existing conditions from the frontend page)

  // === TELEGRAM ACTIONS ===
  // ... (copy all existing actions from the frontend page)
  // New Telegram actions (SP2)
  { type: 'answer_inline_query', label: 'Answer Inline', category: 'action', platform: 'telegram' },
  { type: 'send_invoice', label: 'Send Invoice', category: 'action', platform: 'telegram' },
  { type: 'answer_pre_checkout', label: 'Answer Pre-Checkout', category: 'action', platform: 'telegram' },
  { type: 'set_chat_menu_button', label: 'Set Menu Button', category: 'action', platform: 'telegram' },
  { type: 'send_media_group', label: 'Send Media Group', category: 'action', platform: 'telegram' },
  { type: 'create_forum_topic', label: 'Create Forum Topic', category: 'action', platform: 'telegram' },
  { type: 'set_my_commands', label: 'Set Commands', category: 'action', platform: 'telegram' },

  // === DISCORD TRIGGERS ===
  // ... (copy all existing Discord triggers)
  // New Discord triggers (SP2)
  { type: 'discord_slash_command', label: 'Slash Command', category: 'trigger', platform: 'discord' },
  { type: 'discord_modal_submit', label: 'Modal Submit', category: 'trigger', platform: 'discord' },
  { type: 'discord_select_menu', label: 'Select Menu', category: 'trigger', platform: 'discord' },
  { type: 'discord_button_click', label: 'Button Click', category: 'trigger', platform: 'discord' },
  { type: 'discord_autocomplete', label: 'Autocomplete', category: 'trigger', platform: 'discord' },

  // === DISCORD CONDITIONS ===
  // ... (copy all existing Discord conditions)

  // === DISCORD ACTIONS ===
  // ... (copy all existing Discord actions)
  // New Discord actions (SP2)
  { type: 'discord_reply_interaction', label: 'Reply Interaction', category: 'action', platform: 'discord' },
  { type: 'discord_show_modal', label: 'Show Modal', category: 'action', platform: 'discord' },
  { type: 'discord_send_components', label: 'Send Components', category: 'action', platform: 'discord' },
  { type: 'discord_edit_interaction', label: 'Edit Interaction', category: 'action', platform: 'discord' },
  { type: 'discord_defer_reply', label: 'Defer Reply', category: 'action', platform: 'discord' },
  { type: 'discord_set_channel_permissions', label: 'Set Permissions', category: 'action', platform: 'discord' },
  { type: 'discord_create_forum_post', label: 'Create Forum Post', category: 'action', platform: 'discord' },
  { type: 'discord_register_commands', label: 'Register Commands', category: 'action', platform: 'discord', description: 'Admin-only' },

  // === UNIFIED CROSS-PLATFORM ===
  { type: 'unified_send_message', label: 'Send Message (Cross)', category: 'action', platform: 'general' },
  { type: 'unified_send_media', label: 'Send Media (Cross)', category: 'action', platform: 'general' },
  { type: 'unified_delete_message', label: 'Delete Message (Cross)', category: 'action', platform: 'general' },
  { type: 'unified_ban_user', label: 'Ban User (Cross)', category: 'action', platform: 'general' },
  { type: 'unified_kick_user', label: 'Kick User (Cross)', category: 'action', platform: 'general' },
  { type: 'unified_pin_message', label: 'Pin Message (Cross)', category: 'action', platform: 'general' },
  { type: 'unified_send_dm', label: 'Send DM (Cross)', category: 'action', platform: 'general' },
  { type: 'unified_set_role', label: 'Set Role (Cross)', category: 'action', platform: 'general' },

  // === GENERAL (context, chaining, advanced) ===
  // ... (from SP1: get_context, set_context, delete_context, context_condition, run_flow, emit_event, custom_event)
  // ... (existing: delay, api_call, parallel_branch, db_query, loop, switch, transform)
]

export function getNodesByPlatform(platform: 'telegram' | 'discord' | 'general' | 'all'): NodeTypeDefinition[] {
  if (platform === 'all') return NODE_TYPES
  return NODE_TYPES.filter(n => n.platform === platform || n.platform === 'general')
}

export function getNodesByCategory(category: string): NodeTypeDefinition[] {
  return NODE_TYPES.filter(n => n.category === category)
}
```

**Important:** Copy ALL existing node types from the frontend page's `NODE_TYPES_CONFIG` array to ensure nothing is lost. The comment placeholders above (`// ...`) must be filled with actual entries.

- [ ] **Step 4: Create index.ts**

```typescript
export { NODE_TYPES, getNodesByPlatform, getNodesByCategory } from './node-registry.js'
export type { NodeTypeDefinition } from './node-registry.js'
```

- [ ] **Step 5: Install and verify**

```bash
cd /root/Development/tg-allegro && pnpm install
```

- [ ] **Step 6: Update frontend to import from flow-shared**

In `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`, replace the inline `NODE_TYPES_CONFIG` array with:

```typescript
import { NODE_TYPES } from '@tg-allegro/flow-shared'
```

Then update all references from `NODE_TYPES_CONFIG` to `NODE_TYPES`. Adjust the filter/map logic as needed to match the new `NodeTypeDefinition` shape.

- [ ] **Step 7: Verify frontend builds**

```bash
cd /root/Development/tg-allegro && pnpm frontend build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add packages/flow-shared/ apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx pnpm-lock.yaml
git commit -m "refactor: extract node types to @tg-allegro/flow-shared package"
```

---

### Task 2: Add Unified Action Executors

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/actions.ts`
- Modify: `apps/trigger/src/lib/flow-engine/executor.ts` (NON_CACHEABLE_TYPES)
- Test: `apps/trigger/src/__tests__/unified-actions.test.ts`

- [ ] **Step 1: Write failing tests for unified actions**

Create `apps/trigger/src/__tests__/unified-actions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

function createContext(): FlowContext {
  return {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: {},
    nodeResults: new Map(),
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('unified action executors', () => {
  it('unified_send_message returns correct action output', async () => {
    const node = createNode('unified_send_message', {
      text: 'Hello!',
      targetChatId: '123',
    })
    const result = await executeAction(node, createContext())
    expect(result).toEqual({
      action: 'unified_send_message',
      text: 'Hello!',
      targetChatId: '123',
      executed: true,
    })
  })

  it('unified_ban_user returns correct action output', async () => {
    const node = createNode('unified_ban_user', {
      targetUserId: 'user-456',
      targetChatId: 'chat-789',
    })
    const result = await executeAction(node, createContext())
    expect(result).toEqual({
      action: 'unified_ban_user',
      targetUserId: 'user-456',
      targetChatId: 'chat-789',
      executed: true,
    })
  })

  it('unified_send_dm returns correct action output', async () => {
    const node = createNode('unified_send_dm', {
      text: 'Private message',
      targetUserId: 'user-123',
    })
    const result = await executeAction(node, createContext())
    expect(result).toEqual({
      action: 'unified_send_dm',
      text: 'Private message',
      targetUserId: 'user-123',
      executed: true,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=unified-actions
```

- [ ] **Step 3: Add unified action executors to actions.ts**

Add cases to `executeAction` switch for all 8 unified types:

```typescript
case 'unified_send_message':
case 'unified_send_media':
case 'unified_delete_message':
case 'unified_ban_user':
case 'unified_kick_user':
case 'unified_pin_message':
case 'unified_send_dm':
case 'unified_set_role':
  return executeUnifiedAction(node, ctx);
```

Add executor:

```typescript
async function executeUnifiedAction(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const { text, mediaUrl, targetUserId, targetChatId, telegramOverrides, discordOverrides, ...rest } = node.config as Record<string, unknown>

  return {
    action: node.type,
    ...(text !== undefined && { text: interpolate(String(text), ctx) }),
    ...(mediaUrl !== undefined && { mediaUrl: interpolate(String(mediaUrl), ctx) }),
    ...(targetUserId !== undefined && { targetUserId: interpolate(String(targetUserId), ctx) }),
    ...(targetChatId !== undefined && { targetChatId: interpolate(String(targetChatId ?? ctx.triggerData.chatId ?? ''), ctx) }),
    ...(telegramOverrides !== undefined && { telegramOverrides }),
    ...(discordOverrides !== undefined && { discordOverrides }),
    executed: true,
  }
}
```

- [ ] **Step 4: Add unified types to NON_CACHEABLE_TYPES**

```typescript
'unified_send_message', 'unified_send_media', 'unified_delete_message',
'unified_ban_user', 'unified_kick_user', 'unified_pin_message',
'unified_send_dm', 'unified_set_role',
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=unified-actions
```

- [ ] **Step 6: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/actions.ts apps/trigger/src/lib/flow-engine/executor.ts apps/trigger/src/__tests__/unified-actions.test.ts
git commit -m "feat(flow-engine): add unified cross-platform action executors"
```

---

### Task 3: Add dispatchUnified to Dispatcher

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`
- Test: `apps/trigger/src/__tests__/dispatch-unified.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/trigger/src/__tests__/dispatch-unified.test.ts` testing that:
- `unified_send_message` resolves to `send_message` for Telegram
- `unified_send_message` resolves to `discord_send_message` for Discord
- `unified_ban_user` resolves correctly per platform
- `unified_kick_user` uses `ban_user` + special handling for Telegram
- Cross-platform mode dispatches to both
- Errors are normalized to `UnifiedDispatchError` format

- [ ] **Step 2: Implement dispatchUnified**

In `dispatcher.ts`, add:

```typescript
export interface UnifiedDispatchError {
  platform: 'telegram' | 'discord'
  code: 'RATE_LIMITED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'UNKNOWN'
  message: string
  originalError?: unknown
}

const UNIFIED_TO_TELEGRAM: Record<string, string> = {
  unified_send_message: 'send_message',
  unified_send_media: 'send_photo', // Dispatcher checks mediaUrl mime for video/doc
  unified_delete_message: 'delete_message',
  unified_ban_user: 'ban_user',
  unified_kick_user: 'ban_user', // ban then unban in dispatch
  unified_pin_message: 'pin_message',
  unified_send_dm: 'send_message', // chatId = user private chat
  unified_set_role: 'promote_user',
}

const UNIFIED_TO_DISCORD: Record<string, string> = {
  unified_send_message: 'discord_send_message',
  unified_send_media: 'discord_send_message', // with attachment
  unified_delete_message: 'discord_delete_message',
  unified_ban_user: 'discord_ban_member',
  unified_kick_user: 'discord_kick_member',
  unified_pin_message: 'discord_pin_message',
  unified_send_dm: 'discord_send_dm',
  unified_set_role: 'discord_add_role',
}

export async function dispatchUnified(
  ctx: FlowContext,
  transportConfig: { platform?: string; transport?: string; botInstanceId?: string; discordBotInstanceId?: string },
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = []
  const platform = transportConfig?.platform ?? 'telegram'

  for (const [nodeId, nodeResult] of ctx.nodeResults) {
    if (nodeResult.status !== 'success' || !nodeResult.output) continue
    const output = nodeResult.output as Record<string, unknown>
    const action = output.action as string
    if (!action?.startsWith('unified_')) continue

    if (platform === 'telegram' || platform === 'cross_platform') {
      const telegramAction = UNIFIED_TO_TELEGRAM[action]
      if (telegramAction) {
        // Merge base config with telegramOverrides
        const telegramConfig = {
          ...output,
          action: telegramAction,
          chatId: output.targetChatId,
          ...(output.telegramOverrides as Record<string, unknown> ?? {}),
        }
        // Dispatch via existing Telegram mechanism
        // ... (delegate to dispatchToTelegram with modified nodeResult)
      }
    }

    if (platform === 'discord' || platform === 'cross_platform') {
      const discordAction = UNIFIED_TO_DISCORD[action]
      if (discordAction) {
        const discordConfig = {
          ...output,
          action: discordAction,
          ...(output.discordOverrides as Record<string, unknown> ?? {}),
        }
        // Dispatch via Discord mechanism
      }
    }
  }

  return results
}
```

**Note:** The exact implementation must integrate with the existing `dispatchActions` flow. Study `dispatcher.ts` lines 32-103 for how `dispatchToTelegram` and `dispatchViaDiscordBotApi` are called and follow the same patterns.

- [ ] **Step 3: Wire dispatchUnified into dispatchActions**

In the `dispatchActions` function, before the existing platform routing logic, add a check:

```typescript
// Handle unified actions
if (action.startsWith('unified_')) {
  // Route through dispatchUnified instead of platform-specific dispatch
  // ...
  continue
}
```

- [ ] **Step 4: Run tests**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=dispatch-unified
```

- [ ] **Step 5: Run full test suite**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

- [ ] **Step 6: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/dispatcher.ts apps/trigger/src/__tests__/dispatch-unified.test.ts
git commit -m "feat(flow-engine): add dispatchUnified for cross-platform action routing"
```

---

## Chunk 2: Phase 2B — New Telegram Nodes

### Task 4: Extend ITelegramTransport

**Files:**
- Modify: `packages/telegram-transport/src/transport/ITelegramTransport.ts`
- Modify: `packages/telegram-transport/src/transport/GramJsTransport.ts`
- Modify: `packages/telegram-transport/src/transport/FakeTelegramTransport.ts`
- Test: `packages/telegram-transport/src/__tests__/` (extend existing tests)

- [ ] **Step 1: Add new method signatures to ITelegramTransport**

Add 7 new methods:

```typescript
answerInlineQuery(queryId: string, results: unknown[], options?: { cacheTime?: number }): Promise<boolean>
sendInvoice(chatId: string, params: { title: string; description: string; payload: string; currency: string; prices: Array<{ label: string; amount: number }> }): Promise<number>
answerPreCheckoutQuery(queryId: string, ok: boolean, errorMessage?: string): Promise<boolean>
setChatMenuButton(chatId: string, menuButton: { type: string; text?: string; url?: string }): Promise<boolean>
sendMediaGroup(chatId: string, media: Array<{ type: string; url: string; caption?: string }>): Promise<number[]>
createForumTopic(chatId: string, name: string, options?: { iconColor?: number; iconEmojiId?: string }): Promise<number>
setMyCommands(commands: Array<{ command: string; description: string }>, scope?: unknown): Promise<boolean>
```

- [ ] **Step 2: Add stubs to FakeTelegramTransport**

Each method records the call and returns a deterministic value.

- [ ] **Step 3: Implement in GramJsTransport**

Use GramJS API calls. For each method, find the corresponding GramJS function:
- `answerInlineQuery` → `client.invoke(new Api.messages.SetInlineBotResults(...))`
- `sendInvoice` → `client.invoke(new Api.messages.SendMedia(...))` with `InputMediaInvoice`
- `sendMediaGroup` → `client.invoke(new Api.messages.SendMultiMedia(...))`
- etc.

**Note:** Some GramJS methods may need research. Check GramJS docs or source for exact API.

- [ ] **Step 4: Run transport tests**

```bash
cd /root/Development/tg-allegro && pnpm telegram-transport test
```

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-transport/src/
git commit -m "feat(telegram-transport): add inline, payment, forum, and media group methods"
```

---

### Task 5: Add New Telegram Action Executors

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/actions.ts`
- Modify: `apps/trigger/src/lib/flow-engine/executor.ts` (NON_CACHEABLE_TYPES)
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts` (new dispatch mappings)
- Test: `apps/trigger/src/__tests__/telegram-new-actions.test.ts`

- [ ] **Step 1: Write tests for new Telegram action executors**

Each new action (answer_inline_query, send_invoice, answer_pre_checkout, set_chat_menu_button, send_media_group, create_forum_topic, set_my_commands) follows the same pattern as existing action executors — returns an object with `{ action, ...config, executed: true }`.

- [ ] **Step 2: Add executors to actions.ts**

7 new cases + executor functions, following existing patterns.

- [ ] **Step 3: Add to NON_CACHEABLE_TYPES**

- [ ] **Step 4: Add dispatch mappings in dispatcher.ts**

Map each new action type to the corresponding transport method call in `dispatchToTelegram`.

- [ ] **Step 5: Run tests**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

- [ ] **Step 6: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/
git commit -m "feat(flow-engine): add new Telegram action executors (inline, payments, forum)"
```

---

## Chunk 3: Phase 2C — New Discord Nodes

### Task 6: Extend IDiscordTransport

**Files:**
- Modify: `packages/discord-transport/src/transport/IDiscordTransport.ts`
- Modify: `packages/discord-transport/src/transport/DiscordJsTransport.ts`
- Modify: `packages/discord-transport/src/transport/FakeDiscordTransport.ts`

- [ ] **Step 1: Add new method signatures to IDiscordTransport**

```typescript
replyInteraction(interactionId: string, params: { content?: string; embeds?: unknown[]; components?: unknown[]; ephemeral?: boolean }): Promise<void>
showModal(interactionId: string, params: { customId: string; title: string; components: unknown[] }): Promise<void>
sendComponents(channelId: string, params: { content?: string; components: unknown[] }): Promise<string>
editInteraction(interactionId: string, params: { content?: string; embeds?: unknown[]; components?: unknown[] }): Promise<void>
deferReply(interactionId: string, ephemeral?: boolean): Promise<void>
setChannelPermissions(channelId: string, targetId: string, allow?: string, deny?: string): Promise<void>
createForumPost(channelId: string, params: { name: string; content: string; tags?: string[] }): Promise<string>
registerCommands(guildId: string, commands: unknown[]): Promise<void>
```

- [ ] **Step 2: Add stubs to FakeDiscordTransport**

- [ ] **Step 3: Implement in DiscordJsTransport**

Use discord.js API:
- `replyInteraction` → `interaction.reply()`
- `showModal` → `interaction.showModal()`
- `sendComponents` → `channel.send({ components })`
- etc.

- [ ] **Step 4: Run transport tests**

```bash
cd /root/Development/tg-allegro && pnpm run --filter @tg-allegro/discord-transport test
```

- [ ] **Step 5: Commit**

```bash
git add packages/discord-transport/src/
git commit -m "feat(discord-transport): add interaction, modal, component, and forum methods"
```

---

### Task 7: Add New Discord Action Executors

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/actions.ts`
- Modify: `apps/trigger/src/lib/flow-engine/executor.ts`
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`
- Test: `apps/trigger/src/__tests__/discord-new-actions.test.ts`

- [ ] **Step 1: Write tests for new Discord action executors**

8 new Discord actions following existing patterns.

- [ ] **Step 2: Add executors to actions.ts**

- [ ] **Step 3: Add to NON_CACHEABLE_TYPES**

- [ ] **Step 4: Add dispatch mappings in dispatcher.ts**

Map each new Discord action to the corresponding `dispatchViaDiscordBotApi` call.

- [ ] **Step 5: Run tests**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

- [ ] **Step 6: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/ apps/trigger/src/__tests__/discord-new-actions.test.ts
git commit -m "feat(flow-engine): add new Discord action executors (interactions, modals, forums)"
```

---

### Task 8: Final Typecheck and Verification

- [ ] **Step 1: Typecheck all workspaces**

```bash
cd /root/Development/tg-allegro
pnpm trigger typecheck
pnpm telegram-transport typecheck
pnpm frontend build
```

- [ ] **Step 2: Run all tests**

```bash
pnpm trigger test
pnpm telegram-transport test
pnpm api test
```

Expected: All pass.

- [ ] **Step 3: Commit any remaining fixes**
