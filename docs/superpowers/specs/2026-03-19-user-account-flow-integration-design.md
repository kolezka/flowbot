# Telegram User Account Flow Builder Integration

**Date:** 2026-03-19
**Status:** Approved

## Problem Statement

The Telegram User Client (MTProto/GramJS) impersonates a real Telegram user account and has fundamentally different capabilities than a Telegram bot. The current UI/docs don't make this distinction clear. Additionally, while the flow dispatcher supports MTProto transport, it reads a single hardcoded session from env vars — users can't select which account to use or leverage user-account-only capabilities in flows.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Connection selection | Per-flow default + per-node override |
| Node palette organization | Sub-category under Telegram ("Bot Actions" vs "User Account Actions") |
| Missing connection behavior | Allow node on canvas with yellow warning badge; validation catches it |
| User account nodes | 17 new `user_*` prefixed nodes (read, write, account operations) |

---

## Section 1: Terminology & Documentation Clarity

### UI Label Changes

- Flow editor transport dropdown: "MTProto (User Account)" → **"User Account"**
- Connections page: connections with `connectionType: "mtproto"` display description: "Telegram User Account — acts as a real user, not a bot. Can access private groups, read chat history, and perform actions without bot restrictions."
- Node palette: user-account-only nodes get a purple color (#8B5CF6) and small user icon badge

### Documentation

- README: add a section explaining Bot API vs MTProto User Client distinction
- CLAUDE.md: document the `user_*` node prefix convention and connection selection pattern

---

## Section 2: PlatformConnection Selection in Flow Editor

### transportConfig Changes

`FlowDefinition.transportConfig` gains a `platformConnectionId` field:

```json
{
  "transport": "mtproto | bot_api | auto",
  "botInstanceId": "optional — for Bot API",
  "platformConnectionId": "optional — for User Account (NEW)",
  "discordBotInstanceId": "optional — for Discord"
}
```

No schema migration needed — `transportConfig` is already a `Json?` field.

### Flow Editor UI

When transport is "User Account" or "Auto":
- Show a **"User Account"** dropdown listing all active PlatformConnections where `connectionType = 'mtproto'` and `status = 'active'`
- Dropdown shows: connection name + phone number (from `metadata.phoneNumber`)
- If no connections exist, show a link to `/dashboard/connections/auth`
- Saved to `transportConfig.platformConnectionId` on flow save

### Per-Node Override

Action nodes gain an optional `connectionOverride` field in their node config (stored in `nodesJson`):
- Small "Override connection" toggle in the node property panel, collapsed by default
- When expanded, shows the same PlatformConnection dropdown
- If set, that node uses a different connection than the flow default

### Dispatcher Changes

In `apps/trigger/src/lib/flow-engine/dispatcher.ts`:

1. When `platformConnectionId` is set on transportConfig (or node override), load the PlatformConnection record from DB
2. Extract `credentials.sessionString` from the connection
3. Create/cache a GramJS transport instance keyed by connection ID (lazy singleton per session)
4. Use that transport instead of the env var global session
5. If no `platformConnectionId` set, fall back to env var session (`TG_CLIENT_SESSION`) for backward compatibility

Transport cache structure:
```typescript
const transportCache = new Map<string, GramJsTransport>();

async function getTransportForConnection(connectionId: string): Promise<GramJsTransport> {
  if (transportCache.has(connectionId)) return transportCache.get(connectionId)!;

  const prisma = getPrisma();
  const connection = await prisma.platformConnection.findUnique({ where: { id: connectionId } });
  // ... create GramJsTransport from credentials.sessionString
  // ... cache and return
}
```

---

## Section 3: User Account Node Types

17 new flow nodes, all prefixed with `user_`, organized into three categories.

### Read Operations

| Node | Type | Description |
|------|------|-------------|
| `user_get_chat_history` | action | Fetch N recent messages from a chat. Returns message array. |
| `user_search_messages` | action | Search messages in a chat by keyword. Returns matches. |
| `user_get_all_members` | action | Get full member list of a group/channel. |
| `user_get_chat_info` | action | Get detailed chat info including private groups the user is in. |
| `user_get_contacts` | action | Get the user account's contact list. |
| `user_get_dialogs` | action | List all chats/groups/channels the user is in. |

### Write Operations

| Node | Type | Description |
|------|------|-------------|
| `user_join_chat` | action | Join a group/channel by invite link or username. |
| `user_leave_chat` | action | Leave a group/channel. |
| `user_create_group` | action | Create a new group with specified members. |
| `user_create_channel` | action | Create a new channel. |
| `user_invite_users` | action | Invite users to a group by phone or username. |
| `user_send_message` | action | Send message as user (no bot badge). |
| `user_send_media` | action | Send photo/video/document as user. |
| `user_forward_message` | action | Forward with original author attribution. |
| `user_delete_messages` | action | Delete messages (own or others if admin). |

### Account Operations

| Node | Type | Description |
|------|------|-------------|
| `user_update_profile` | action | Update first name, last name, bio. |
| `user_set_status` | action | Set online status / custom emoji status. |
| `user_get_profile_photos` | action | Get a user's profile photos. |

### Node Registry Registration

Each node in `packages/flow-shared/src/node-registry.ts`:

```typescript
{
  type: 'user_get_chat_history',
  label: 'Get Chat History',
  category: 'action',
  platform: 'telegram',
  subcategory: 'user_account',       // NEW field
  requiresConnection: true,          // NEW field
  color: '#8B5CF6',                  // purple
}
```

New fields on `NodeTypeDefinition`:
- `subcategory?: string` — `'user_account'` for these nodes, undefined for regular nodes
- `requiresConnection?: boolean` — true if node requires a PlatformConnection

### Node Palette UI

Under the Telegram filter, nodes split into two collapsible groups:
- **Bot Actions** — existing nodes (no subcategory or `subcategory !== 'user_account'`)
- **User Account Actions** — nodes with `subcategory: 'user_account'`, purple color, user icon badge

### Validation

`FlowsService.validateGraph()` adds a new check:
- If any node in the flow has `requiresConnection: true` AND the flow's `transportConfig.platformConnectionId` is not set AND the node has no `connectionOverride`, flag as validation error: "Node '{label}' requires a User Account connection. Select one in flow settings or set a per-node override."

### Dispatcher Routing

In `dispatcher.ts`:
1. If action starts with `user_`, it MUST route through GramJS MTProto — never Bot API
2. Resolve PlatformConnection: check node's `connectionOverride` first, then flow's `transportConfig.platformConnectionId`
3. If neither is set, return `{ dispatched: false, error: 'User account connection required for user_* actions' }`
4. Load/cache GramJS transport for the resolved connection
5. Map `user_*` action to the appropriate GramJS method (e.g., `user_get_chat_history` → `transport.getMessages()`)

### GramJS Method Mapping

New function in dispatcher or a separate `user-actions.ts` file:

| Flow Action | GramJS Method |
|-------------|---------------|
| `user_get_chat_history` | `client.getMessages(peer, { limit })` |
| `user_search_messages` | `client.getMessages(peer, { search })` |
| `user_get_all_members` | `client.getParticipants(peer, {})` |
| `user_get_chat_info` | `client.getEntity(peer)` |
| `user_get_contacts` | `client.getContacts()` |
| `user_get_dialogs` | `client.getDialogs({ limit })` |
| `user_join_chat` | `client.invoke(JoinChannelRequest)` |
| `user_leave_chat` | `client.invoke(LeaveChannelRequest)` |
| `user_create_group` | `client.invoke(CreateChatRequest)` |
| `user_create_channel` | `client.invoke(CreateChannelRequest)` |
| `user_invite_users` | `client.invoke(InviteToChannelRequest)` |
| `user_send_message` | `client.sendMessage(peer, { message })` |
| `user_send_media` | `client.sendFile(peer, { file })` |
| `user_forward_message` | `client.forwardMessages(from, to, ids)` |
| `user_delete_messages` | `client.deleteMessages(peer, ids)` |
| `user_update_profile` | `client.invoke(UpdateProfileRequest)` |
| `user_set_status` | `client.invoke(UpdateStatusRequest)` |
| `user_get_profile_photos` | `client.invoke(GetUserPhotosRequest)` |
