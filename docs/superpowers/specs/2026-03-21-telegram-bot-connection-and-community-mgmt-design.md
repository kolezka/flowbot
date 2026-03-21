# Telegram Bot Connection & Community Management

**Date:** 2026-03-21
**Status:** Draft

## Problem

The dashboard only supports adding Telegram connections as user accounts (MTProto). There is no way to:
1. Add a Telegram bot connection via bot token
2. Manually create communities/groups
3. Scope a bot's responses to specific groups or users

## Solution Overview

Approach A (Connection-First): Add a "Bot" vs "Account" type selector to the Telegram connection flow. Bot tokens are validated via the Telegram Bot API (`getMe`), and both a `PlatformConnection` and `BotInstance` are created in a single transaction. The existing `telegram-bot-pool` auto-discovers new bot instances and spawns workers automatically.

Communities are managed separately via a manual CRUD flow. Bots can be scoped to respond only to specific groups/users.

## Design

### 1. Connection Creation — Bot Token Flow

When the user selects Telegram as platform, a new step appears: **"Bot" or "Account"**.

**Bot path (two-step API sequence, matching existing Discord bot flow):**
1. User enters connection name
2. User pastes bot token from @BotFather
3. Frontend calls `POST /api/connections` — creates `PlatformConnection` with:
   - `platform: "telegram"`, `connectionType: "bot_token"`, `status: "inactive"`
4. Frontend calls `POST /api/connections/:id/auth/start` with `{ botToken }`:
   - Validates token format (pattern: `digits:alphanumeric`)
   - Calls Telegram `getMe` (5s timeout) to validate token and fetch bot info
   - On success: in a single transaction:
     - Creates `BotInstance` (`name`, `botToken`, `botUsername`, `platform: "telegram"`, `isActive: true`)
     - Updates `PlatformConnection`: sets `botInstanceId`, stores token in `credentials`, sets `status: "active"`, stores bot metadata
   - On failure: returns error with user-facing message:
     - Invalid format: "Bot token format is invalid. Expected format from @BotFather."
     - Rejected by Telegram: "Telegram rejected this token. Please check it's correct."
     - Network timeout: "Could not reach Telegram. Please try again."
   - Duplicate detection: checks `BotInstance` where `botToken = <token>` before creating. If found, returns error "This bot is already connected."
5. `telegram-bot-pool` reconciler auto-discovers the new `BotInstance` on next cycle (<=30s) and spawns a worker

**Account path:** Unchanged — existing MTProto phone/code/2FA flow with `connectionType: "mtproto"`.

### 2. Community Management — Manual CRUD

New manual community creation flow in the dashboard. Platform is inherited from the global nav platform selector (no separate platform dropdown in the form).

**Add Community form fields:**
- **Name** — display name in dashboard
- **Platform ID** — the group/chat ID, Discord server ID, etc.
- **Connected bot** — optional dropdown of `BotInstance` records filtered by current platform (maps to `Community.botInstanceId` FK)

**List view:** Table of communities with platform badge, name, platform ID, connected bot, member count.

**Edit:** Update name, change connected bot assignment.

**Delete:** Confirmation dialog, then remove.

The API already has community CRUD in the `communities` module. The primary gaps are:
- Frontend: add manual creation form
- API: expand `UpdateCommunityDto` to accept `botInstanceId` for changing connected bot assignment

### 3. Bot Response Scoping

Each bot instance can be configured with response scope on its **bot instance detail page** (accessed via the connection):

- **Groups** — select from communities linked to this bot (by platform ID)
- **Users** — enter specific user IDs or usernames

Scope is stored in `BotInstance.metadata` (not `PlatformConnection.metadata`) since scope is a per-bot concept — multiple connections could share one bot instance:
```json
{
  "scope": {
    "groupIds": ["chat_id_1", "chat_id_2"],
    "userIds": ["user_id_1"]
  }
}
```

Shared TypeScript type in `platform-kit`:
```typescript
export interface BotScope {
  groupIds?: string[];
  userIds?: string[];
}
```

**Default behavior:** When no scope is configured, the bot responds to everything. When scoped, it only processes messages from listed groups/users.

### 4. API Changes

#### Connections Module

**Strategy registry conflict resolution:** `PlatformStrategyRegistry` is keyed by `(module, platform)`, so only one strategy per platform. Create a single `TelegramConnectionStrategy` that dispatches internally based on `connectionType`:
- `connectionType: "mtproto"` → existing MTProto auth flow
- `connectionType: "bot_token"` → new bot token flow (validate via `getMe`, create `BotInstance` in transaction)

This avoids changing the registry interface.

**New endpoint:** `PUT /api/bot-instances/:id/scope` — update scope config in `BotInstance.metadata`. Uses `PUT` for consistency with existing controller patterns.

#### Communities Module
- **Ensure:** Manual creation accepts `name`, `platformId`, `botInstanceId`
- Frontend always sends `platform` from the nav selector
- If `botInstanceId` is provided, validate that the bot's platform matches the provided platform
- **Expand `UpdateCommunityDto`** to accept `botInstanceId` for changing connected bot assignment

#### Bot Instance Lifecycle
- Deactivating a bot connection sets `BotInstance.isActive = false` → pool stops the worker on next reconcile
- Reactivating reverses this: `BotInstance.isActive = true` → pool spawns a new worker
- Deleting a connection also deletes (or deactivates) the linked `BotInstance`

### 5. Connector Changes

`telegram-bot-connector` reads scope from `BotInstance.metadata` (passed via worker data) at startup and on config refresh:
- If `scope` is present, filter incoming messages:
  - Check `message.chat.id` against `scope.groupIds`
  - Check `message.from.id` against `scope.userIds`
  - Drop messages that don't match
- If `scope` is absent or empty, process all messages (default)

### 6. Pool Integration

**No changes required.** The existing `telegram-bot-pool`:
- Reads `BotInstance` records where `platform: 'telegram'` and `isActive: true`
- Reconciles every 30s — new instances get workers spawned automatically
- Updates `botInstance.apiUrl` to point to the pool for API routing

### 7. Database

**No schema changes required.** Existing fields cover all needs:
- `PlatformConnection.connectionType` — already supports `"bot_token"` as a value
- `PlatformConnection.botInstanceId` — FK to `BotInstance` already exists
- `PlatformConnection.credentials` — JSON field for encrypted bot token
- `PlatformConnection.metadata` — JSON field for bot metadata (username, name, canJoinGroups)
- `BotInstance` — already has `botToken`, `botUsername`, `platform` fields
- `BotInstance.metadata` — JSON field for scope config

**Recommended index:** Add unique filtered index on `BotInstance.botToken` (where not null) to enforce duplicate detection at DB level.

## Non-Goals

- Auto-discovery of groups the bot is in (manual entry only)
- Multi-platform pool (only Telegram bot pool exists today)
- Bot token rotation or management (store and use as-is)
- Webhook configuration in the dashboard (handled by pool/connector)
- Bot token encryption (stored as-is in JSON, consistent with existing credential storage for MTProto sessions and WhatsApp auth keys)
