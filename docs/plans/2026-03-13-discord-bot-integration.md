# Discord Bot Integration Plan

**Date:** 2026-03-13
**Status:** Draft
**Scope:** Full Discord integration — new app, transport package, flow engine support, multi-platform UI

---

## Overview

Integrate Discord as a second messaging platform alongside Telegram. This requires changes across the entire stack: a new Discord bot app, a transport abstraction package, flow engine dispatcher routing, new node types, Prisma schema updates, API endpoints, and a frontend redesign to support multiple integrations with more platforms in the future.

---

## Architecture Decisions

### Multi-Platform Transport Model

Currently the system is Telegram-only with `FlowTransportMode = 'mtproto' | 'bot_api' | 'auto'`. This needs to become platform-aware:

```
FlowTransportConfig {
  platform: 'telegram' | 'discord';         // NEW — which platform
  transport: 'mtproto' | 'bot_api' | 'auto' | 'discord_bot';  // transport mode
  botInstanceId?: string;                    // references BotInstance
}
```

Nodes themselves will be platform-scoped: `discord_send_message` vs `send_message` (Telegram). This keeps the flow graph explicit about which platform each action targets, and allows cross-platform flows (e.g., Telegram trigger → Discord action).

### BotInstance Model Reuse

The existing `BotInstance` model stores bot tokens and API URLs. We'll add a `platform` field (`'telegram' | 'discord'`) rather than creating a separate model. Discord bots store their token in `botToken` and guild info in a new `metadata` JSON field.

---

## Chunks

### Chunk 1: Schema & Type Foundation

**Goal:** Extend the data layer to be platform-aware.

#### Task 1.1 — Update FlowTransportConfig types
**File:** `packages/db/src/flow-types.ts`
- Add `FlowPlatform` type: `'telegram' | 'discord'`
- Update `FlowTransportMode` to include `'discord_bot'`
- Add `platform` field to `FlowTransportConfig`
- Add Discord node types to `FlowNodeType` enum:
  ```
  // Discord Triggers
  DISCORD_MESSAGE_RECEIVED
  DISCORD_MEMBER_JOIN
  DISCORD_MEMBER_LEAVE
  DISCORD_REACTION_ADD
  DISCORD_REACTION_REMOVE
  DISCORD_VOICE_STATE_UPDATE
  DISCORD_INTERACTION_CREATE    // slash commands, buttons, modals
  DISCORD_CHANNEL_CREATE
  DISCORD_CHANNEL_DELETE
  DISCORD_ROLE_UPDATE
  DISCORD_SCHEDULED_EVENT

  // Discord Conditions
  DISCORD_HAS_ROLE
  DISCORD_CHANNEL_TYPE          // text, voice, forum, stage
  DISCORD_IS_BOT
  DISCORD_MESSAGE_HAS_EMBED
  DISCORD_MEMBER_PERMISSIONS

  // Discord Actions
  DISCORD_SEND_MESSAGE
  DISCORD_SEND_EMBED
  DISCORD_SEND_DM
  DISCORD_EDIT_MESSAGE
  DISCORD_DELETE_MESSAGE
  DISCORD_ADD_REACTION
  DISCORD_REMOVE_REACTION
  DISCORD_PIN_MESSAGE
  DISCORD_UNPIN_MESSAGE
  DISCORD_BAN_MEMBER
  DISCORD_KICK_MEMBER
  DISCORD_TIMEOUT_MEMBER
  DISCORD_ADD_ROLE
  DISCORD_REMOVE_ROLE
  DISCORD_CREATE_ROLE
  DISCORD_SET_NICKNAME
  DISCORD_CREATE_CHANNEL
  DISCORD_DELETE_CHANNEL
  DISCORD_MOVE_MEMBER           // voice channel
  DISCORD_CREATE_THREAD
  DISCORD_SEND_THREAD_MESSAGE
  DISCORD_CREATE_INVITE
  DISCORD_CREATE_SCHEDULED_EVENT
  ```

#### Task 1.2 — Update Prisma schema
**File:** `packages/db/prisma/schema.prisma`
- Add `platform String @default("telegram")` to `BotInstance` model
- Add `metadata Json?` to `BotInstance` (for Discord guild IDs, permissions, etc.)
- Add `platform String @default("telegram")` to `FlowDefinition` (primary platform hint)
- Run `pnpm db generate`

#### Task 1.3 — Create migration
- Run `pnpm db migrate` to create the migration
- Ensure backward compatibility (defaults to `"telegram"`)

---

### Chunk 2: Discord Transport Package

**Goal:** Create `packages/discord-transport` — the abstraction layer for Discord API calls.

#### Task 2.1 — Initialize package
- Create `packages/discord-transport/` with:
  ```
  package.json (deps: discord.js)
  tsconfig.json
  src/index.ts
  src/transport/IDiscordTransport.ts
  src/transport/DiscordJsTransport.ts
  src/transport/FakeDiscordTransport.ts
  src/transport/CircuitBreaker.ts
  ```
- Add to pnpm workspace

#### Task 2.2 — Define IDiscordTransport interface
**File:** `packages/discord-transport/src/transport/IDiscordTransport.ts`
```typescript
export interface IDiscordTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Messaging
  sendMessage(channelId: string, content: string, options?: MessageOptions): Promise<string>;
  sendEmbed(channelId: string, embed: EmbedData, content?: string): Promise<string>;
  sendDM(userId: string, content: string, options?: MessageOptions): Promise<string>;
  editMessage(channelId: string, messageId: string, content: string): Promise<void>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
  pinMessage(channelId: string, messageId: string): Promise<void>;
  unpinMessage(channelId: string, messageId: string): Promise<void>;

  // Reactions
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  removeReaction(channelId: string, messageId: string, emoji: string): Promise<void>;

  // Member Management
  banMember(guildId: string, userId: string, reason?: string, deleteMessageDays?: number): Promise<void>;
  kickMember(guildId: string, userId: string, reason?: string): Promise<void>;
  timeoutMember(guildId: string, userId: string, durationMs: number, reason?: string): Promise<void>;
  addRole(guildId: string, userId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, userId: string, roleId: string): Promise<void>;
  setNickname(guildId: string, userId: string, nickname: string): Promise<void>;

  // Channel Management
  createChannel(guildId: string, name: string, type: ChannelType, options?: ChannelOptions): Promise<string>;
  deleteChannel(channelId: string): Promise<void>;
  createThread(channelId: string, name: string, options?: ThreadOptions): Promise<string>;
  sendThreadMessage(threadId: string, content: string): Promise<string>;

  // Guild Management
  createRole(guildId: string, name: string, options?: RoleOptions): Promise<string>;
  createInvite(channelId: string, options?: InviteOptions): Promise<string>;
  moveMember(guildId: string, userId: string, channelId: string): Promise<void>;
  createScheduledEvent(guildId: string, name: string, options: ScheduledEventOptions): Promise<string>;
}
```

#### Task 2.3 — Implement DiscordJsTransport
**File:** `packages/discord-transport/src/transport/DiscordJsTransport.ts`
- Wrap discord.js `Client` with the `IDiscordTransport` interface
- Handle connection lifecycle (login/destroy)
- Implement all methods using discord.js API

#### Task 2.4 — Implement FakeDiscordTransport + CircuitBreaker
- `FakeDiscordTransport` — test double tracking all calls
- `CircuitBreaker` — same pattern as telegram-transport (proxy with circuit-breaking)

#### Task 2.5 — Export & build
- Export all types and implementations from `src/index.ts`
- Verify `pnpm build` passes

---

### Chunk 3: Discord Bot App

**Goal:** Create `apps/discord-bot` — the Discord equivalent of `apps/manager-bot`.

#### Task 3.1 — Initialize app
- Create `apps/discord-bot/` with:
  ```
  package.json (deps: discord.js, hono, @flowbot/db, @flowbot/discord-transport)
  tsconfig.json
  src/
    index.ts            — entry point
    bot/
      index.ts          — discord.js Client setup
      events/           — event handlers
        message.ts
        member-join.ts
        member-leave.ts
        reaction.ts
        interaction.ts
        voice-state.ts
      middlewares/
        flow-events.ts  — forward events to flow engine
    server/
      index.ts          — Hono HTTP server (parallel to manager-bot)
    services/
      flow-events.ts    — FlowEventForwarder for Discord events
    config.ts
  ```

#### Task 3.2 — Implement Discord bot client
**File:** `apps/discord-bot/src/bot/index.ts`
- Create discord.js `Client` with required intents:
  - `Guilds, GuildMessages, GuildMembers, GuildMessageReactions, GuildVoiceStates, MessageContent, GuildScheduledEvents`
- Register event handlers for all trigger types
- Handle slash command registration

#### Task 3.3 — Implement event forwarding to flow engine
**File:** `apps/discord-bot/src/bot/middlewares/flow-events.ts`
- On each Discord event, normalize to flow trigger format:
  ```typescript
  {
    platform: 'discord',
    eventType: 'DISCORD_MESSAGE_RECEIVED',
    guildId: string,
    channelId: string,
    userId: string,
    messageId?: string,
    content?: string,
    // ... event-specific data
  }
  ```
- POST to `http://localhost:3000/api/flow/webhook` (same as manager-bot)

#### Task 3.4 — Implement Hono HTTP server
**File:** `apps/discord-bot/src/server/index.ts`
- `GET /health` — health check
- `POST /api/execute-action` — action execution endpoint (used by dispatcher)
  - Accept `{ action: string; params: Record<string, unknown> }`
  - Route to discord.js API calls (parallel to manager-bot's Telegram actions)
- `POST /api/flow-event` — forward events to flow engine

#### Task 3.5 — Add Docker/env configuration
- Add `.env.example` with `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL`
- Add to root `docker-compose.yml` if applicable

---

### Chunk 4: Flow Engine Integration

**Goal:** Make the flow engine dispatch actions to Discord.

#### Task 4.1 — Add Discord action executors
**File:** `apps/trigger/src/lib/flow-engine/actions.ts`
- Add executor functions for all Discord action types
- Same pattern as Telegram actions: return data objects, actual dispatch by dispatcher
  ```typescript
  export function executeDiscordSendMessage(node, triggerData) {
    return {
      platform: 'discord',
      channelId: resolveTemplate(node.data.channelId, triggerData),
      content: resolveTemplate(node.data.content, triggerData),
      // ...
    };
  }
  ```

#### Task 4.2 — Add Discord condition evaluators
**File:** `apps/trigger/src/lib/flow-engine/conditions.ts`
- Add evaluators for Discord conditions:
  - `evaluateDiscordHasRole(node, triggerData)` — check if user has specific role
  - `evaluateDiscordChannelType(node, triggerData)` — text/voice/forum/stage
  - `evaluateDiscordIsBot(node, triggerData)` — check if event author is a bot
  - `evaluateDiscordMessageHasEmbed(node, triggerData)` — check for embeds
  - `evaluateDiscordMemberPermissions(node, triggerData)` — check permissions bitfield

#### Task 4.3 — Extend dispatcher with Discord routing
**File:** `apps/trigger/src/lib/flow-engine/dispatcher.ts`
- Add `dispatchToDiscord()` function:
  - Initialize `DiscordJsTransport` (lazy, like Telegram)
  - Map Discord action types to transport methods
- Add `dispatchViaDiscordBotApi()` function:
  - Look up Discord bot instance from DB
  - POST to Discord bot's `/api/execute-action`
- Update `dispatchActions()` routing:
  ```typescript
  // Determine platform from node type prefix or transportConfig
  if (nodeType.startsWith('discord_') || config?.platform === 'discord') {
    return dispatchToDiscord(result, transport);
  }
  // else: existing Telegram dispatch
  ```

#### Task 4.4 — Update flow-execution task
**File:** `apps/trigger/src/trigger/flow-execution.ts`
- Handle `platform` field in trigger data to determine dispatch target
- Support mixed-platform flows (some nodes dispatch to Telegram, others to Discord)

---

### Chunk 5: API Updates

**Goal:** Update the API layer to handle multi-platform flows and Discord bot instances.

#### Task 5.1 — Update Flow DTOs
**File:** `apps/api/src/flows/dto/index.ts`
- Add `platform?: string` to `CreateFlowDto` and `UpdateFlowDto`
- Update `transportConfig` type to include `platform` field

#### Task 5.2 — Update FlowsService
**File:** `apps/api/src/flows/flows.service.ts`
- Persist `platform` on flow creation/update
- Add Discord node types to `getSimulatedOutput()` with simulated outputs
- Update validation to check Discord-specific node constraints

#### Task 5.3 — Update BotInstance endpoints
**File:** `apps/api/src/bot-instances/` (may need new module)
- Add `platform` filter to `GET /bot-instances?platform=discord`
- Support creating Discord bot instances with `platform: 'discord'`
- Store Discord-specific metadata (guild IDs, permissions intents)

#### Task 5.4 — Add Discord webhook ingress
**File:** `apps/api/src/flows/flows.controller.ts`
- Add endpoint or update existing webhook to accept Discord-formatted events
- Normalize Discord event payloads to flow trigger format

---

### Chunk 6: Frontend — Multi-Platform UI

**Goal:** Redesign the frontend to support multiple integrations, extensible for future platforms.

#### Task 6.1 — Platform-aware node palette
**File:** `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`
- Add Discord node types to `NODE_TYPES_CONFIG` with distinct colors:
  - Discord triggers: `#5865F2` (Discord blurple)
  - Discord conditions: `#57F287` (Discord green)
  - Discord actions: `#5865F2`
- Group nodes by platform in the sidebar:
  ```
  ▸ Telegram
    ▸ Triggers (14)
    ▸ Conditions (11)
    ▸ Actions (49)
  ▸ Discord
    ▸ Triggers (11)
    ▸ Conditions (5)
    ▸ Actions (22)
  ▸ General
    ▸ Conditions (time_based, etc.)
    ▸ Actions (delay, api_call, etc.)
  ```

#### Task 6.2 — Discord property panels
**File:** `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`
- Add `DiscordActionPropertyPanel` with fields for:
  - Channel ID / Guild ID selectors
  - Embed builder (title, description, color, fields, footer, image)
  - Role selectors
  - Permission checkboxes
- Add `DiscordTriggerPropertyPanel`:
  - Guild selector, channel filter
  - Slash command name/description
- Add `DiscordConditionPropertyPanel`:
  - Role dropdown, channel type select, permissions bitfield

#### Task 6.3 — Multi-platform transport config
**File:** `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`
- Replace single transport dropdown with platform-aware config:
  ```
  Platform: [Telegram ▾] [Discord ▾] [Cross-Platform ▾]

  Telegram Transport: [Auto ▾]  Bot: [MyBot (@mybot) ▾]
  Discord Transport:  [Bot ▾]   Bot: [MyDiscordBot ▾]
  ```
- When "Cross-Platform" is selected, show both transport configs
- Node dispatch routes based on node type prefix (discord_ vs telegram)

#### Task 6.4 — Integration management page
**File:** `apps/frontend/src/app/dashboard/integrations/page.tsx` (NEW)
- List all configured bot instances grouped by platform
- Add/edit/delete bot instances
- Connection status indicators
- Platform-specific setup wizards:
  - Telegram: Bot token + MTProto session
  - Discord: Bot token + OAuth2 URL + guild selector + intent configuration

#### Task 6.5 — Update API client
**File:** `apps/frontend/src/lib/api.ts`
- Add `platform` filter to `getBotInstances(platform?: string)`
- Add Discord bot instance CRUD methods
- Update `FlowDefinition` type with `platform` field

---

### Chunk 7: Testing

**Goal:** Comprehensive tests for all Discord integration points.

#### Task 7.1 — Discord transport unit tests
**File:** `packages/discord-transport/src/__tests__/`
- Test `DiscordJsTransport` methods with mocked discord.js Client
- Test `CircuitBreaker` proxy behavior
- Test `FakeDiscordTransport` tracking

#### Task 7.2 — Discord bot integration tests
**File:** `apps/discord-bot/src/__tests__/integration/`
- Test `POST /api/execute-action` with all Discord action types
- Test `POST /api/flow-event` forwarding
- Test health endpoint

#### Task 7.3 — Dispatcher Discord routing tests
**File:** `apps/trigger/src/__tests__/flow-dispatcher-discord.test.ts`
- Test all Discord action type routing
- Test cross-platform flow (Telegram trigger → Discord action)
- Test Discord bot_api dispatch mode
- Test error handling and fallback

#### Task 7.4 — Frontend component tests
- Test Discord node property panels render correctly
- Test platform selector state management
- Test integration management page CRUD

---

### Chunk 8: Cross-Platform Flows & Polish

**Goal:** Enable flows that span both Telegram and Discord.

#### Task 8.1 — Cross-platform trigger routing
- A Telegram event can trigger a flow that sends a Discord message
- A Discord event can trigger a flow that sends a Telegram message
- Dispatcher inspects each node's type prefix to determine target platform

#### Task 8.2 — Platform-specific template variables
- Telegram: `{{trigger.chatId}}`, `{{trigger.userId}}`, `{{trigger.messageText}}`
- Discord: `{{trigger.guildId}}`, `{{trigger.channelId}}`, `{{trigger.authorId}}`, `{{trigger.content}}`
- Shared: `{{trigger.platform}}`, `{{trigger.timestamp}}`

#### Task 8.3 — Documentation
- Update `docs/architecture.md` with multi-platform architecture diagram
- Add `docs/integrations/discord.md` setup guide
- Update `docs/flow-builder.md` with Discord node types

---

## Dependency Graph

```
Chunk 1 (Schema)
  ├── Chunk 2 (Discord Transport Package)
  │     └── Chunk 3 (Discord Bot App)
  │           └── Chunk 4 (Flow Engine Integration)
  ├── Chunk 5 (API Updates)
  └── Chunk 6 (Frontend Multi-Platform UI)

Chunks 4, 5, 6 → Chunk 7 (Testing)
Chunk 7 → Chunk 8 (Cross-Platform & Polish)
```

**Parallelizable:**
- Chunk 2 + Chunk 5 + Chunk 6 (after Chunk 1)
- Chunk 3 can start once Chunk 2 is done
- Chunk 7 tasks can run in parallel per workspace

---

## Estimated Effort

| Chunk | Description | Size |
|-------|-------------|------|
| 1 | Schema & Type Foundation | S |
| 2 | Discord Transport Package | M |
| 3 | Discord Bot App | L |
| 4 | Flow Engine Integration | M |
| 5 | API Updates | S |
| 6 | Frontend Multi-Platform UI | L |
| 7 | Testing | M |
| 8 | Cross-Platform & Polish | M |

---

## Key Dependencies

- **discord.js** v14+ — Discord API wrapper
- Existing **Prisma 7** schema — extended with platform fields
- Existing **dispatcher pattern** — extended with Discord routing
- Existing **BotInstance model** — reused with platform discriminator
