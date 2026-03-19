# WhatsApp Integration Design

**Date:** 2026-03-19
**Status:** Approved
**Approach:** Transport Package + Thin Bot Shell (Approach C)

## Problem Statement

The Flowbot platform supports Telegram and Discord via the Platform Discriminator pattern. WhatsApp is declared in `PLATFORMS` constants but has no implementation. The platform needs a WhatsApp integration that enables interactive flows, broadcast, group management, and full messaging capabilities through WhatsApp groups and direct messages.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| WhatsApp API | Baileys (unofficial, user-account) | Full user-account capabilities, TypeScript-native, lightweight (no headless browser), active community. Same trade-off as GramJS for Telegram — unofficial but feature-complete |
| Library | `@whiskeysockets/baileys` | Actively maintained fork of original Baileys. Multi-device protocol support, ongoing fixes |
| Architecture | Transport package + thin bot shell | Mirrors telegram-transport/telegram-bot pattern. Transport testable in isolation, bot app is thin wiring |
| Execution model | Unified — bot handles events AND executes actions | Baileys has no bot/user distinction (unlike Telegram). Same session listens and acts. No need for separate transport instance in Trigger.dev |
| Auth flow | Dashboard-driven QR via WebSocket | Reuses existing Connections page + auth wizard pattern. QR streamed to frontend, user scans with phone |
| Session persistence | Custom Baileys auth adapter backed by PlatformConnection.credentials | Auth keys stored in DB (encrypted JSON), not filesystem. Enables multi-instance restarts without re-auth |
| Scope | All features (messaging, media, history, group admin, presence, broadcast) | Full feature set in first iteration since Baileys supports all natively |
| New DB models | None (one schema change) | Existing generic models handle WhatsApp via platform discriminator. One migration: make `BotInstance.botToken` optional for non-token-based platforms |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WhatsApp ToS violation (unofficial API) | Account ban | Same risk as GramJS/Telegram. Use dedicated phone numbers, avoid spam patterns, implement rate limiting via circuit breaker |
| Baileys breaking changes | Transport failures | Pin exact version, wrap behind IWhatsAppTransport interface so implementation can be swapped |
| QR code expiry during auth | UX friction | Auto-rotate QR via WebSocket push (~20s interval), clear error state if expired |
| Large auth state JSON | DB bloat | Baileys auth keys are ~50-100KB. Acceptable for JSON column. Monitor and compress if needed |
| Multi-device protocol changes | Session invalidation | Baileys community tracks protocol changes. Circuit breaker protects against cascading failures during outages |

---

## Section 1: `packages/whatsapp-transport`

### Directory Structure

```
packages/whatsapp-transport/
  src/
    transport/
      IWhatsAppTransport.ts      # Interface
      BaileysTransport.ts        # Baileys implementation
      CircuitBreaker.ts          # Decorator (same pattern as telegram/discord)
      FakeWhatsAppTransport.ts   # Test double
      errors.ts                  # WhatsApp-specific errors
    actions/
      runner.ts                  # Action executor dispatcher
      executors/
        send-message.ts
        send-media.ts
        group-admin.ts
        read-history.ts
        presence.ts
    logger.ts                    # Pino child logger
    index.ts                     # Public API exports
  __tests__/
    whatsapp-transport.test.ts
  package.json
  tsconfig.json                  # ESM, extends tsconfig.base.json
```

### `IWhatsAppTransport` Interface

| Category | Methods |
|----------|---------|
| Connection | `connect()`, `disconnect()`, `isConnected()`, `onQrCode(cb)`, `onConnectionUpdate(cb)`, `getClient()` |
| Messaging | `sendMessage(jid, text, opts)`, `sendMedia(jid, type, buffer/url, opts)`, `sendLocation(jid, lat, lng)`, `sendContact(jid, contact)`, `sendDocument(jid, buffer, opts)` |
| Message management | `editMessage(jid, msgKey, text)`, `deleteMessage(jid, msgKey)`, `forwardMessage(fromJid, toJid, msg)`, `readHistory(jid, count?)` |
| Group admin | `kickParticipant(groupJid, userJid)`, `promoteParticipant(groupJid, userJid)`, `demoteParticipant(groupJid, userJid)`, `getGroupMetadata(groupJid)`, `getGroupInviteLink(groupJid)` |
| Presence | `sendPresenceUpdate(jid, type)`, `getPresence(jid)` |

### Key Design Notes

**WhatsApp IDs are JIDs:** `1234567890@s.whatsapp.net` for users, `groupid@g.us` for groups. All transport methods accept string JIDs.

**Message keys are objects:** `{ remoteJid, fromMe, id }`, not integer IDs like Telegram. Methods that reference existing messages (`editMessage`, `deleteMessage`) accept this key structure.

**No parse mode:** WhatsApp does not support HTML or Markdown formatting in the Telegram sense. Text is plain with optional bold/italic via WhatsApp's own formatting markers (`*bold*`, `_italic_`). The transport accepts plain text and does not transform formatting.

**Media handling:** Media sent as `Buffer` or URL with automatic MIME type detection. Baileys handles download/upload internally. The `sendMedia` method accepts a `type` discriminator (`image`, `video`, `audio`, `document`, `sticker`).

**Session persistence via custom auth adapter:** Baileys supports pluggable auth state via `useMultiFileAuthState` (filesystem) or custom implementations. The transport implements a custom adapter conforming to Baileys' `AuthenticationState` contract:

```typescript
interface AuthenticationState {
  creds: AuthenticationCreds     // account credentials (noise key, registered, etc.)
  keys: SignalKeyStore           // signal protocol state
}

interface SignalKeyStore {
  get(type: string, ids: string[]): Promise<Record<string, unknown>>
  set(data: Record<string, Record<string, unknown>>): Promise<void>
}
```

The custom adapter:
- `creds` — loaded from `PlatformConnection.credentials.creds` on connect
- `saveCreds` callback — writes updated creds back to `PlatformConnection.credentials.creds` via Prisma
- `keys.get(type, ids)` — reads signal keys (pre-keys, sessions, sender-keys, app-state-sync-keys) from `PlatformConnection.credentials.keys[type]`
- `keys.set(data)` — writes signal keys back to `PlatformConnection.credentials.keys[type]`

This replaces Baileys' default filesystem auth. Auth keys are stored as encrypted JSON in the database, enabling the bot process to restart or migrate hosts without re-authentication.

**Circuit breaker:** Same pattern as `packages/telegram-transport/src/transport/CircuitBreaker.ts` and `packages/discord-transport/src/transport/CircuitBreaker.ts`. Wraps `IWhatsAppTransport`, implements the same interface, delegates all calls through `execute()` with failure tracking in a sliding window. Default config: 5 failures in 60s trips the circuit, 30s reset timeout.

### Dependencies

```json
{
  "@whiskeysockets/baileys": "6.7.16",
  "pino": "^9.9",
  "@flowbot/db": "workspace:*"
}
```

Pin the exact Baileys version to avoid breaking changes from the multi-device protocol. Update deliberately after testing.

**Transport package purpose:** `packages/whatsapp-transport` exists for testability and modularity, consistent with `telegram-transport` and `discord-transport`. In this iteration, the sole consumer is `apps/whatsapp-bot`. Trigger.dev does NOT import it directly (unlike `telegram-transport` which Trigger.dev uses for MTProto user-account actions). If a future need arises for Trigger.dev to execute WhatsApp actions independently of the bot process, the transport is already extracted and ready.

---

## Section 2: `apps/whatsapp-bot`

### Directory Structure

```
apps/whatsapp-bot/
  src/
    bot/
      index.ts                   # Bot class: init transport, register listeners
      events.ts                  # Event handlers (message, group-update, etc.)
      event-mapper.ts            # Maps Baileys events -> FlowTriggerEvent format
    server/
      index.ts                   # Hono HTTP server: /health, /api/execute-action
      actions.ts                 # Action switch -> transport method delegation
      qr-auth.ts                 # QR code handler: pushes QR updates to API via HTTP
    config.ts                    # Env var validation (Valibot schema)
    logger.ts                    # Pino logger setup
    main.ts                      # Entry point: boot transport, start server, heartbeat
  package.json
  tsconfig.json                  # ESM
  vitest.config.ts
```

### Boot Sequence (`main.ts`)

1. Load and validate config from environment variables (Valibot schema)
2. Initialize Prisma client, load PlatformConnection by `WA_CONNECTION_ID`
3. Create `BaileysTransport` with DB-backed auth state from connection credentials
4. Wrap in `CircuitBreaker`
5. Register event listeners (messages, group updates, presence changes)
6. Start Hono HTTP server on `SERVER_HOST:SERVER_PORT`
7. Send heartbeat to `POST /api/bot-config/instances/:id/heartbeat` with capabilities list
8. If no stored session (fresh connection) → enter "awaiting QR" state. Bot HTTP server runs, but events are not forwarded until authentication completes via QR scan

### Event Mapping

Baileys emits raw events via `ev.on()`. The event mapper transforms them to the standardized `FlowTriggerEvent` format and forwards via `POST /api/flows/webhook`.

| Baileys Event | `FlowTriggerEvent.eventType` | Data Extracted |
|--------------|------------------------------|----------------|
| `messages.upsert` | `message_received` | text, mediaType, mediaUrl, quotedMessage, senderJid, pushName |
| `group-participants.update` (add) | `member_join` | participantJids, groupJid |
| `group-participants.update` (remove) | `member_leave` | participantJids, groupJid |
| `group-participants.update` (promote) | `member_promoted` | participantJids, groupJid |
| `group-participants.update` (demote) | `member_demoted` | participantJids, groupJid |
| `groups.update` | `group_updated` | subject, description, groupJid |
| `presence.update` | `presence_update` | presenceType, jid |

Each forwarded event includes:

```typescript
{
  platform: "whatsapp",
  communityId: groupJid,        // null for DMs (see DM handling below)
  accountId: senderJid,
  eventType: "message_received",
  data: { text, mediaType, quotedMessage, isDirectMessage, ... },
  timestamp: ISO string,
  botInstanceId: WA_BOT_INSTANCE_ID
}
```

**DM handling:** For direct messages (non-group), `communityId` is set to `null`. The flow engine already supports community-less events for DM-based flows. The `data.isDirectMessage` flag is set to `true` so flows can branch on message context. The bot uses the sender's JID (`accountId`) for routing responses back. No synthetic "DM community" records are created — DMs are not communities.

### HTTP API

**`GET /health`** — returns bot status, uptime, memory, connection state, DB health.

**`POST /api/execute-action`** — same contract as telegram-bot. Action dispatch table:

| Action | Transport Method |
|--------|-----------------|
| `send_message` | `sendMessage(jid, text)` |
| `send_photo` | `sendMedia(jid, 'image', url/buffer)` |
| `send_video` | `sendMedia(jid, 'video', url/buffer)` |
| `send_document` | `sendDocument(jid, url/buffer, opts)` |
| `send_audio` | `sendMedia(jid, 'audio', url/buffer)` |
| `send_voice` | `sendMedia(jid, 'audio', url/buffer, { ptt: true })` |
| `send_sticker` | `sendMedia(jid, 'sticker', url/buffer)` |
| `send_location` | `sendLocation(jid, lat, lng)` |
| `send_contact` | `sendContact(jid, contact)` |
| `forward_message` | `forwardMessage(fromJid, toJid, msg)` |
| `edit_message` | `editMessage(jid, msgKey, text)` |
| `delete_message` | `deleteMessage(jid, msgKey)` |
| `read_history` | `readHistory(jid, count)` |
| `kick_user` | `kickParticipant(groupJid, userJid)` |
| `promote_user` | `promoteParticipant(groupJid, userJid)` |
| `demote_user` | `demoteParticipant(groupJid, userJid)` |
| `get_group_info` | `getGroupMetadata(groupJid)` |
| `get_invite_link` | `getGroupInviteLink(groupJid)` |
| `send_presence` | `sendPresenceUpdate(jid, type)` |

**`POST /api/qr-auth/start`** — called by the API server to initiate QR generation for a connection. Bot starts Baileys auth and pushes QR updates back to the API via `POST {apiUrl}/api/connections/:id/qr-update`. See Section 3 for the full auth flow.

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `WA_CONNECTION_ID` | Yes | PlatformConnection ID (loads session from DB) |
| `WA_BOT_INSTANCE_ID` | Yes | BotInstance ID (heartbeat + event metadata) |
| `DATABASE_URL` | Yes | Prisma connection |
| `API_SERVER_HOST` | No | Flow engine API host (default: `localhost`) |
| `API_SERVER_PORT` | No | Flow engine API port (default: `3000`) |
| `SERVER_HOST` | No | Bot HTTP server bind host (default: `0.0.0.0`) |
| `SERVER_PORT` | No | Bot HTTP server bind port (default: `3004`) |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |

---

## Section 3: API Strategies & Database

### New Strategy Classes

**`WhatsAppBaileysStrategy`** (`apps/api/src/connections/strategies/whatsapp-baileys.strategy.ts`):

```typescript
@Injectable()
export class WhatsAppBaileysStrategy implements IPlatformStrategy, OnModuleInit {
  readonly platform = PLATFORMS.WHATSAPP;

  constructor(private readonly registry: PlatformStrategyRegistry) {}

  onModuleInit(): void {
    this.registry.register('connections', this);
  }
}
```

Responsibilities:
- `startAuth()` → creates PlatformConnection with `connectionType: "baileys"`, `status: "authenticating"`, signals bot to start QR generation
- `submitStep()` → not needed (QR flow is push-based via WebSocket, no multi-step form)
- `validateConnection()` → calls bot's `/health` endpoint, checks Baileys session is alive

**`WhatsAppCommunityStrategy`** (`apps/api/src/communities/strategies/whatsapp-community.strategy.ts`):

```typescript
@Injectable()
export class WhatsAppCommunityStrategy implements IPlatformStrategy, OnModuleInit {
  readonly platform = PLATFORMS.WHATSAPP;

  constructor(private readonly registry: PlatformStrategyRegistry) {}

  onModuleInit(): void {
    this.registry.register('communities', this);
  }
}
```

Responsibilities:
- WhatsApp-specific community operations (group metadata fetch, invite link generation via bot HTTP call)
- Community auto-creation: when bot joins a WhatsApp group, event forwarded to API, API creates Community with `platform: "whatsapp"`, `platformCommunityId: groupJid`

### Database — No New Models

All existing generic models support WhatsApp via the platform discriminator:

| Model | WhatsApp Usage |
|-------|---------------|
| `PlatformConnection` | `platform: "whatsapp"`, `connectionType: "baileys"` (add to schema comment listing valid types), `credentials: { creds, keys }`, `metadata: { phoneNumber, pushName }` |
| `Community` | `platform: "whatsapp"`, `platformCommunityId: groupJid` |
| `CommunityMember` | Linked via `platformAccountId` to WhatsApp PlatformAccount |
| `PlatformAccount` | `platform: "whatsapp"`, `platformUserId: jid` (e.g., `1234567890@s.whatsapp.net`) |
| `BotInstance` | `platform: "whatsapp"`, `apiUrl: "http://whatsapp-bot:3004"`, `botToken: null` (see schema change below) |
| `CommunityConfig` | Shared config applies as-is (welcome messages, anti-spam thresholds) |

### Schema Change: `BotInstance.botToken` → Optional

The `BotInstance` model currently has a required `botToken` field. WhatsApp connections authenticate via QR/session keys stored in `PlatformConnection`, not via a bot token. A Prisma migration is required to make `botToken` optional:

```prisma
model BotInstance {
  botToken  String?    // Was required, now optional for non-token platforms (WhatsApp)
}
```

This is the only schema change needed. WhatsApp BotInstance records have `botToken: null`.

**Implementation note:** Audit all references to `botInstance.botToken` in `apps/telegram-bot`, `apps/api`, and `apps/trigger` to add null guards. Code that accesses `botToken` without null checks will break at runtime for WhatsApp instances.

**No `CommunityWhatsAppConfig` table** in this iteration. WhatsApp groups have fewer configurable knobs than Telegram (no captcha, no slow mode, no forum topics). Deferred to a follow-up slice if needed.

### QR Authentication Flow (End-to-End)

The QR WebSocket is proxied through the NestJS API server (which already has Socket.IO via WsGateway). The frontend never connects directly to the bot process — this avoids CORS issues, network topology concerns, and maintains the existing pattern where the frontend only talks to the API.

```
Dashboard                    API (NestJS)                WhatsApp Bot
   |                          |                              |
   |-- POST /connections      |                              |
   |   {platform:"whatsapp"}  |                              |
   |                          |-- Create PlatformConnection  |
   |                          |   status: "authenticating"   |
   |                          |                              |
   |-- POST /connections/:id/ |                              |
   |   auth/start             |                              |
   |                          |-- POST bot /api/qr-auth/start|
   |                          |   {connectionId}             |
   |                          |                              |
   |-- WS (Socket.IO)        |                              |
   |   subscribe to           |                              |
   |   "qr-auth:{connId}"    |                              |
   |                          |                              |-- Init Baileys
   |                          |                              |-- Generate QR
   |                          | <-- POST /api/qr-auth/update |
   |                          |     {connectionId, qr}       |
   |   <-- emit "qr-auth:qr" |                              |
   |       {qr: base64}      |                              |
   |                          | <-- POST /api/qr-auth/update |
   |   <-- emit "qr-auth:qr" |     (rotated ~20s)           |
   |                          |                              |
   |   User scans QR          |                              |
   |                          |                              |-- Auth success
   |                          |                              |-- Save keys to DB
   |                          | <-- POST /api/qr-auth/update |
   |                          |     {connectionId,           |
   |                          |      status:"connected",     |
   |                          |      pushName, phoneNumber}  |
   |   <-- emit "qr-auth:ok" |                              |
   |       {pushName, phone}  |                              |
   |                          |                              |
   |-- GET /connections/:id   |-- status: "active"           |
```

The bot pushes QR updates to the API via HTTP POST. The API relays them to the subscribed frontend client via Socket.IO. This keeps the bot in the internal network and the frontend only talks to the API.

### Flow Engine Dispatcher Update

In `apps/trigger/src/lib/flow-engine/dispatcher.ts`, add WhatsApp routing. Two changes required:

**1. Fix prefix-based fallback in `dispatchActions`:**
The current dispatcher has a fallback that treats any non-`discord_` action as Telegram. This must be updated to handle `whatsapp_*` prefixed actions explicitly BEFORE the Telegram fallback:

```typescript
// BEFORE (current):
// if (action.startsWith('discord_')) → discord
// else → telegram (fallback)

// AFTER:
// if (action.startsWith('discord_')) → discord
// else if (action.startsWith('whatsapp_')) → whatsapp (NEW)
// else → telegram (fallback)
```

WhatsApp-prefixed actions resolve the target Community → BotInstance with `platform: "whatsapp"` → dispatch to bot's `/api/execute-action`.

**2. Update `UnifiedDispatchError.platform` type:**
Extend the type union from `'telegram' | 'discord'` to `'telegram' | 'discord' | 'whatsapp'`.

**3. Add `platform === 'whatsapp'` branch in `dispatchUnifiedAction`:**
The existing `dispatchUnifiedAction` function has branches for `platform === 'telegram'` and `platform === 'discord'`. Add a `platform === 'whatsapp'` branch that maps via `UNIFIED_TO_WHATSAPP` and dispatches to the WhatsApp bot's `/api/execute-action`. Without this, unified cross-platform actions (e.g., `unified_send_message`) targeting WhatsApp communities will silently do nothing.

**Unified action mapping:**

```typescript
const UNIFIED_TO_WHATSAPP: Record<string, string> = {
  'unified_send_message': 'send_message',
  'unified_ban_user': 'kick_user',       // WhatsApp has no "ban", only kick+remove
  'unified_send_dm': 'send_message',     // DM = message to user JID directly
  'unified_kick_user': 'kick_user',
  'unified_promote_user': 'promote_user',
  'unified_demote_user': 'demote_user',
}
```

**Note on `unified_ban_user`:** WhatsApp does not have a ban mechanism. Kicking a participant removes them, but they can rejoin via invite link. The mapping sends `kick_user` as the closest equivalent. The flow engine should document this behavioral difference for cross-platform flows.

---

## Section 4: Frontend

### New Component

**`WhatsAppAuthWizard.tsx`** (`apps/frontend/src/app/dashboard/connections/components/WhatsAppAuthWizard.tsx`):

1. Triggered when user selects "WhatsApp" in platform picker on Connections page
2. Calls `POST /api/connections` to create PlatformConnection
3. Calls `POST /api/connections/:id/auth/start` to initiate QR flow
4. Subscribes to Socket.IO event `qr-auth:{connectionId}` via existing WebSocket connection to the API server (no direct bot connection)
5. Renders QR code image (base64 from Socket.IO `qr-auth:qr` event)
6. QR auto-rotates every ~20s (new Socket.IO event)
7. On success (`qr-auth:ok` event): shows connected state with phone number and push name
8. On timeout/failure: shows retry button

### Existing Component Updates

**`PlatformBadge`** — add WhatsApp icon (green chat bubble). The component already supports dynamic platform rendering; just needs the icon mapping entry.

**No other frontend changes required.** All list pages, community detail, broadcast composer, and flow builder are data-driven from existing components. WhatsApp entities appear automatically when `platform: "whatsapp"` data exists in the API responses.

---

## Section 5: Workspace Configuration & Integration Points

### pnpm Workspace

Add to `pnpm-workspace.yaml`:
```yaml
- packages/whatsapp-transport
- apps/whatsapp-bot
```

### Package Configuration

| Package | Key Dependencies |
|---------|-----------------|
| `packages/whatsapp-transport` | `@whiskeysockets/baileys`, `pino@^9.9`, `@flowbot/db` (workspace) |
| `apps/whatsapp-bot` | `@flowbot/whatsapp-transport` (workspace), `@flowbot/db` (workspace), `hono@^4.10`, `@hono/node-server`, `pino@^9.9`, `valibot@^0.42` |

### TypeScript Configuration

- Both packages use ESM (consistent with telegram-bot, telegram-transport)
- Both extend `tsconfig.base.json`
- Verify that the existing `@flowbot/*` wildcard path alias in `tsconfig.base.json` resolves `@flowbot/whatsapp-transport` automatically. If the wildcard maps to `packages/*/src`, no explicit alias is needed. Only add an explicit entry if the wildcard does not cover it.

### Root Package Scripts

```json
"whatsapp-bot": "pnpm --filter @flowbot/whatsapp-bot",
"whatsapp-transport": "pnpm --filter @flowbot/whatsapp-transport"
```

### CI Pipeline

Mirror telegram-bot jobs:
- `whatsapp-transport:typecheck`
- `whatsapp-transport:test`
- `whatsapp-bot:typecheck`
- `whatsapp-bot:lint`
- `whatsapp-bot:test`

### Docker Compose (Local Dev)

```yaml
whatsapp-bot:
  build: ./apps/whatsapp-bot
  env_file: ./apps/whatsapp-bot/.env
  depends_on: [postgres]
  ports: ["3004:3004"]
```

### Integration Point Summary

| Touchpoint | Change |
|-----------|--------|
| `packages/db` | Make `BotInstance.botToken` optional (one Prisma migration) |
| `apps/api` connections module | Add `WhatsAppBaileysStrategy`, register in module providers |
| `apps/api` communities module | Add `WhatsAppCommunityStrategy`, register in module providers |
| `apps/api` events/WsGateway | Add QR auth relay: accept bot POST updates, emit to subscribed frontend clients via Socket.IO |
| `apps/trigger` dispatcher | Add `whatsapp_*` prefix handling before Telegram fallback, add `UNIFIED_TO_WHATSAPP` mapping, extend `UnifiedDispatchError.platform` type |
| `apps/frontend` connections | Add `WhatsAppAuthWizard` component (uses existing Socket.IO connection) |
| `apps/frontend` PlatformBadge | Add WhatsApp icon entry |
| `tsconfig.base.json` | Verify `@flowbot/*` wildcard covers whatsapp-transport; add explicit alias only if needed |
| `pnpm-workspace.yaml` | Add two new workspace entries |
| Root `package.json` | Add `whatsapp-bot` and `whatsapp-transport` workspace scripts |

### Deferred (Not in Scope)

- `CommunityWhatsAppConfig` table — no WhatsApp-specific group config in v1
- WhatsApp-specific flow nodes — standard actions cover the feature set
- Multi-session support — one WhatsApp connection per bot instance
- WhatsApp Business API fallback — Baileys only
- WhatsApp Business message templates — not relevant for unofficial API
- End-to-end encryption key management UI — Baileys handles internally
- Moderation feature parity (captcha, slow mode, forum topics) — WhatsApp does not support these
