# Telegram User Account Flow Builder Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable flow builders to select Telegram user account connections and use 18 user-account-only actions (read chat history, join groups, send as user, etc.) in the visual flow builder.

**Architecture:** Extend `NodeTypeDefinition` with `subcategory` and `requiresConnection` fields. Add 18 `user_*` node types to the registry. Extend the flow dispatcher to resolve `platformConnectionId` → GramJS transport (cached per connection). Update the flow editor UI with connection selection dropdown and sub-categorized node palette.

**Tech Stack:** GramJS (telegram MTProto), Trigger.dev, NestJS, Next.js, React Flow, Prisma 7

**Spec:** `docs/superpowers/specs/2026-03-19-user-account-flow-integration-design.md`

---

## File Map

### New Files
```
apps/trigger/src/lib/flow-engine/user-actions.ts            # Dispatch user_* actions to GramJS
apps/trigger/src/lib/flow-engine/connection-transport.ts     # Manage per-connection GramJS transport cache
apps/trigger/src/__tests__/user-actions.test.ts              # Tests for user action dispatch
```

### Modified Files
```
packages/flow-shared/src/node-registry.ts                    # Add subcategory/requiresConnection fields, 18 new nodes
apps/trigger/src/lib/flow-engine/dispatcher.ts               # Route user_* actions, accept platformConnectionId
apps/trigger/src/lib/flow-engine/index.ts                    # Export new modules
apps/frontend/src/components/flow-editor/NodePalette.tsx     # Sub-categorize Telegram nodes
apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx     # Connection dropdown in transport config
apps/api/src/flows/flows.service.ts                          # Validation for requiresConnection nodes
apps/frontend/src/app/dashboard/connections/page.tsx          # Clarify user account description
README.md                                                     # Bot vs User Account explanation
CLAUDE.md                                                     # Document user_* convention
```

---

## Task 1: Extend NodeTypeDefinition and Register User Account Nodes

**Files:**
- Modify: `packages/flow-shared/src/node-registry.ts`

- [ ] **Step 1: Add `subcategory` and `requiresConnection` fields to interface**

At the top of the file, update the `NodeTypeDefinition` interface:

```typescript
export interface NodeTypeDefinition {
  type: string
  label: string
  category: 'trigger' | 'condition' | 'action' | 'advanced' | 'annotation'
  platform: 'telegram' | 'discord' | 'general'
  color: string
  subcategory?: string              // 'user_account' for MTProto-only nodes
  requiresConnection?: boolean      // true if node needs a PlatformConnection
}
```

- [ ] **Step 2: Add 18 user account node definitions**

Append after the last Telegram action entry (before Discord triggers):

```typescript
  // === TELEGRAM USER ACCOUNT ACTIONS — Read ===
  { type: 'user_get_chat_history', label: 'Get Chat History', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_search_messages', label: 'Search Messages', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_all_members', label: 'Get All Members', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_chat_info', label: 'Get Chat Info', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_contacts', label: 'Get Contacts', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_dialogs', label: 'Get Dialogs', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },

  // === TELEGRAM USER ACCOUNT ACTIONS — Write ===
  { type: 'user_join_chat', label: 'Join Chat', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_leave_chat', label: 'Leave Chat', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_create_group', label: 'Create Group', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_create_channel', label: 'Create Channel', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_invite_users', label: 'Invite Users', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_send_message', label: 'Send as User', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_send_media', label: 'Send Media as User', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_forward_message', label: 'Forward Message', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_delete_messages', label: 'Delete Messages', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },

  // === TELEGRAM USER ACCOUNT ACTIONS — Account ===
  { type: 'user_update_profile', label: 'Update Profile', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_set_status', label: 'Set Status', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_profile_photos', label: 'Get Profile Photos', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /root/Development/tg-allegro && pnpm trigger typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/flow-shared/src/node-registry.ts
git commit -m "feat(flow-shared): add 18 user account node types with subcategory and requiresConnection fields"
```

---

## Task 1.5: Add Public Client Accessor to GramJsTransport

**Files:**
- Modify: `packages/telegram-transport/src/transport/GramJsTransport.ts`
- Modify: `packages/telegram-transport/src/transport/ITelegramTransport.ts`

The `client` field on `GramJsTransport` is `private readonly`. User account actions need access to the raw GramJS `TelegramClient` for operations not covered by `ITelegramTransport` (getMessages, getParticipants, getDialogs, invoke, etc.).

- [ ] **Step 1: Add `getClient()` to ITelegramTransport**

At the end of the `ITelegramTransport` interface, add:

```typescript
  /** Access the underlying platform client for advanced operations. */
  getClient(): unknown
```

- [ ] **Step 2: Implement `getClient()` on GramJsTransport**

Add to `GramJsTransport`:

```typescript
  getClient(): TelegramClient {
    return this.client
  }
```

- [ ] **Step 3: Add `getClient()` to FakeTelegramTransport**

In `packages/telegram-transport/src/transport/FakeTelegramTransport.ts`, add a stub:

```typescript
  getClient(): unknown {
    return null
  }
```

- [ ] **Step 4: Run transport tests**

```bash
cd /root/Development/tg-allegro && pnpm telegram-transport test
```

- [ ] **Step 5: Rebuild db and trigger to pick up the type change**

```bash
cd /root/Development/tg-allegro && pnpm telegram-transport typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/telegram-transport/
git commit -m "feat(telegram-transport): add getClient() accessor for raw GramJS TelegramClient"
```

---

## Task 2: Connection Transport Cache

**Files:**
- Create: `apps/trigger/src/lib/flow-engine/connection-transport.ts`

- [ ] **Step 1: Create connection transport manager**

```typescript
import { pino } from 'pino';
import { StringSession } from 'telegram/sessions/index.js';
import { GramJsTransport } from '@flowbot/telegram-transport';
import { getPrisma } from '../prisma.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const transportCache = new Map<string, { transport: GramJsTransport; lastUsed: number }>();

const MAX_CACHE_SIZE = 10;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a GramJS transport for a specific PlatformConnection.
 * Transports are cached by connection ID and evicted after TTL or when cache is full.
 */
export async function getTransportForConnection(connectionId: string): Promise<GramJsTransport> {
  // Check cache
  const cached = transportCache.get(connectionId);
  if (cached && cached.transport.isConnected()) {
    cached.lastUsed = Date.now();
    return cached.transport;
  }

  // Evict stale entries
  evictStaleEntries();

  // Load connection from DB
  const prisma = getPrisma();
  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`PlatformConnection ${connectionId} not found`);
  }

  if (connection.status !== 'active') {
    throw new Error(`PlatformConnection ${connectionId} is not active (status: ${connection.status})`);
  }

  if (connection.connectionType !== 'mtproto') {
    throw new Error(`PlatformConnection ${connectionId} is not an MTProto connection (type: ${connection.connectionType})`);
  }

  const credentials = connection.credentials as Record<string, unknown> | null;
  const sessionString = credentials?.sessionString as string | undefined;

  if (!sessionString) {
    throw new Error(`PlatformConnection ${connectionId} has no session string`);
  }

  const apiId = Number(process.env.TG_CLIENT_API_ID);
  const apiHash = process.env.TG_CLIENT_API_HASH;

  if (!apiId || !apiHash) {
    throw new Error('TG_CLIENT_API_ID and TG_CLIENT_API_HASH are required');
  }

  const stringSession = new StringSession(sessionString);
  const transport = new GramJsTransport(
    apiId,
    apiHash,
    stringSession,
    logger.child({ component: 'gramjs', connectionId }),
  );

  await transport.connect();

  transportCache.set(connectionId, { transport, lastUsed: Date.now() });

  return transport;
}

function evictStaleEntries(): void {
  const now = Date.now();

  for (const [id, entry] of transportCache) {
    if (now - entry.lastUsed > CACHE_TTL_MS) {
      entry.transport.disconnect().catch(() => {});
      transportCache.delete(id);
    }
  }

  // If still over limit, evict oldest
  if (transportCache.size >= MAX_CACHE_SIZE) {
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, entry] of transportCache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestId = id;
      }
    }
    if (oldestId) {
      const entry = transportCache.get(oldestId);
      entry?.transport.disconnect().catch(() => {});
      transportCache.delete(oldestId);
    }
  }
}

/** Disconnect and clear all cached transports. */
export function clearTransportCache(): void {
  for (const [, entry] of transportCache) {
    entry.transport.disconnect().catch(() => {});
  }
  transportCache.clear();
}
```

- [ ] **Step 2: Export from index**

Add to `apps/trigger/src/lib/flow-engine/index.ts`:
```typescript
export { getTransportForConnection, clearTransportCache } from './connection-transport.js';
```

- [ ] **Step 3: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/connection-transport.ts apps/trigger/src/lib/flow-engine/index.ts
git commit -m "feat(trigger): add per-connection GramJS transport cache with TTL eviction"
```

---

## Task 3: User Action Dispatcher

**Files:**
- Create: `apps/trigger/src/lib/flow-engine/user-actions.ts`
- Create: `apps/trigger/src/__tests__/user-actions.test.ts`

- [ ] **Step 1: Write tests for user action dispatch**

Create `apps/trigger/src/__tests__/user-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchUserAction } from '../lib/flow-engine/user-actions.js';

// Mock raw GramJS client (returned by getClient())
const mockClient = {
  getEntity: vi.fn().mockResolvedValue({ id: 123 }),
  getMessages: vi.fn().mockResolvedValue([{ id: 1, message: 'hello' }]),
  getParticipants: vi.fn().mockResolvedValue([]),
  getDialogs: vi.fn().mockResolvedValue([]),
  invoke: vi.fn().mockResolvedValue({}),
};

// Mock GramJS transport (wraps the client)
const mockTransport = {
  sendMessage: vi.fn().mockResolvedValue({ id: 1, date: Date.now(), peerId: '123' }),
  sendPhoto: vi.fn().mockResolvedValue({ id: 2, date: Date.now(), peerId: '123' }),
  sendVideo: vi.fn().mockResolvedValue({ id: 3, date: Date.now(), peerId: '123' }),
  sendDocument: vi.fn().mockResolvedValue({ id: 4, date: Date.now(), peerId: '123' }),
  forwardMessage: vi.fn().mockResolvedValue([{ id: 5 }]),
  deleteMessages: vi.fn().mockResolvedValue(true),
  getClient: vi.fn().mockReturnValue(mockClient),
  isConnected: vi.fn().mockReturnValue(true),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

// Mock connection-transport module
vi.mock('../lib/flow-engine/connection-transport.js', () => ({
  getTransportForConnection: vi.fn().mockResolvedValue(mockTransport),
}));

describe('dispatchUserAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.getClient.mockReturnValue(mockClient);
  });

  it('should reject non-user_ actions', async () => {
    const result = await dispatchUserAction('send_message', {}, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('not a user account action');
  });

  it('should dispatch user_send_message via transport.sendMessage', async () => {
    const result = await dispatchUserAction('user_send_message', {
      chatId: '123',
      text: 'Hello from user',
    }, 'conn-1');

    expect(result.dispatched).toBe(true);
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('123', 'Hello from user', expect.any(Object));
  });

  it('should dispatch user_get_chat_history via client.getMessages', async () => {
    const result = await dispatchUserAction('user_get_chat_history', {
      chatId: '123',
      limit: 50,
    }, 'conn-1');

    expect(result.dispatched).toBe(true);
    expect(mockClient.getEntity).toHaveBeenCalledWith('123');
    expect(mockClient.getMessages).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 50 }),
    );
  });

  it('should dispatch user_get_all_members via client.getParticipants', async () => {
    const result = await dispatchUserAction('user_get_all_members', {
      chatId: '123',
      limit: 200,
    }, 'conn-1');

    expect(result.dispatched).toBe(true);
    expect(mockClient.getParticipants).toHaveBeenCalled();
  });

  it('should dispatch user_get_dialogs via client.getDialogs', async () => {
    const result = await dispatchUserAction('user_get_dialogs', {
      limit: 100,
    }, 'conn-1');

    expect(result.dispatched).toBe(true);
    expect(mockClient.getDialogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('should return error when connection fails', async () => {
    const { getTransportForConnection } = await import('../lib/flow-engine/connection-transport.js');
    (getTransportForConnection as any).mockRejectedValueOnce(new Error('Connection inactive'));

    const result = await dispatchUserAction('user_send_message', { chatId: '123', text: 'test' }, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('Connection inactive');
  });

  it('should return error when getClient() returns null', async () => {
    mockTransport.getClient.mockReturnValue(null);

    const result = await dispatchUserAction('user_get_chat_history', { chatId: '123' }, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('no underlying client');
  });

  it('should return error for unknown user action', async () => {
    const result = await dispatchUserAction('user_nonexistent', {}, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('Unknown user action');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=user-actions
```

- [ ] **Step 3: Implement user action dispatcher**

Create `apps/trigger/src/lib/flow-engine/user-actions.ts`:

```typescript
import { logger } from '@trigger.dev/sdk/v3';
import { getTransportForConnection } from './connection-transport.js';
import type { DispatchResult } from './dispatcher.js';

/**
 * Dispatch a user_* action via a specific PlatformConnection's GramJS transport.
 * These actions ONLY work with MTProto user accounts, never Bot API.
 */
export async function dispatchUserAction(
  action: string,
  params: Record<string, unknown>,
  connectionId: string,
): Promise<DispatchResult> {
  if (!action.startsWith('user_')) {
    return { nodeId: '', dispatched: false, error: `'${action}' is not a user account action` };
  }

  try {
    const transport = await getTransportForConnection(connectionId);
    const client = transport.getClient() as import('telegram').TelegramClient;

    if (!client) {
      return { nodeId: '', dispatched: false, error: 'Transport has no underlying client' };
    }

    const chatId = String(params.chatId ?? '');
    let response: unknown;

    switch (action) {
      // --- Read Operations ---
      case 'user_get_chat_history': {
        const limit = Number(params.limit ?? 50);
        const entity = await client.getEntity(chatId);
        response = await client.getMessages(entity, { limit });
        break;
      }

      case 'user_search_messages': {
        const entity = await client.getEntity(chatId);
        response = await client.getMessages(entity, {
          search: String(params.query ?? ''),
          limit: Number(params.limit ?? 50),
        });
        break;
      }

      case 'user_get_all_members': {
        const entity = await client.getEntity(chatId);
        response = await client.getParticipants(entity, {
          limit: Number(params.limit ?? 200),
        });
        break;
      }

      case 'user_get_chat_info': {
        response = await client.getEntity(chatId);
        break;
      }

      case 'user_get_contacts': {
        const { Api } = await import('telegram');
        response = await client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) }));
        break;
      }

      case 'user_get_dialogs': {
        response = await client.getDialogs({ limit: Number(params.limit ?? 100) });
        break;
      }

      // --- Write Operations ---
      case 'user_send_message': {
        response = await transport.sendMessage(chatId, String(params.text ?? ''), {
          parseMode: mapParseMode(params.parseMode),
          silent: Boolean(params.disableNotification),
          replyToMsgId: params.replyToMessageId ? Number(params.replyToMessageId) : undefined,
        });
        break;
      }

      case 'user_send_media': {
        const mediaType = String(params.mediaType ?? 'photo');
        const url = String(params.url ?? '');
        if (mediaType === 'video') {
          response = await transport.sendVideo(chatId, url, { caption: params.caption ? String(params.caption) : undefined });
        } else if (mediaType === 'document') {
          response = await transport.sendDocument(chatId, url, { caption: params.caption ? String(params.caption) : undefined });
        } else {
          response = await transport.sendPhoto(chatId, url, { caption: params.caption ? String(params.caption) : undefined });
        }
        break;
      }

      case 'user_forward_message': {
        const fromChatId = String(params.fromChatId ?? '');
        const toChatId = String(params.toChatId ?? chatId);
        const messageIds = Array.isArray(params.messageIds)
          ? (params.messageIds as number[])
          : [Number(params.messageId ?? 0)];
        response = await transport.forwardMessage(fromChatId, toChatId, messageIds);
        break;
      }

      case 'user_delete_messages': {
        const msgIds = Array.isArray(params.messageIds)
          ? (params.messageIds as number[])
          : [Number(params.messageId ?? 0)];
        response = await transport.deleteMessages(chatId, msgIds);
        break;
      }

      case 'user_join_chat': {
        const { Api } = await import('telegram');
        const link = String(params.invite ?? params.username ?? '');
        if (link.includes('+') || link.includes('joinchat')) {
          const hash = link.split('+').pop() || link.split('joinchat/').pop() || '';
          response = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
        } else {
          const entity = await client.getEntity(link);
          response = await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
        }
        break;
      }

      case 'user_leave_chat': {
        const entity = await client.getEntity(chatId);
        const { Api } = await import('telegram');
        response = await client.invoke(new Api.channels.LeaveChannel({ channel: entity }));
        break;
      }

      case 'user_create_group': {
        const { Api } = await import('telegram');
        const users = (params.users as string[] ?? []);
        const entities = await Promise.all(users.map(u => client.getEntity(u)));
        response = await client.invoke(new Api.messages.CreateChat({
          title: String(params.title ?? 'New Group'),
          users: entities,
        }));
        break;
      }

      case 'user_create_channel': {
        const { Api } = await import('telegram');
        response = await client.invoke(new Api.channels.CreateChannel({
          title: String(params.title ?? 'New Channel'),
          about: String(params.about ?? ''),
          broadcast: Boolean(params.broadcast ?? true),
          megagroup: Boolean(params.megagroup ?? false),
        }));
        break;
      }

      case 'user_invite_users': {
        const { Api } = await import('telegram');
        const entity = await client.getEntity(chatId);
        const inviteUsers = (params.users as string[] ?? []);
        const userEntities = await Promise.all(inviteUsers.map(u => client.getEntity(u)));
        response = await client.invoke(new Api.channels.InviteToChannel({
          channel: entity,
          users: userEntities,
        }));
        break;
      }

      // --- Account Operations ---
      case 'user_update_profile': {
        const { Api } = await import('telegram');
        response = await client.invoke(new Api.account.UpdateProfile({
          firstName: params.firstName ? String(params.firstName) : undefined,
          lastName: params.lastName ? String(params.lastName) : undefined,
          about: params.bio ? String(params.bio) : undefined,
        }));
        break;
      }

      case 'user_set_status': {
        const { Api } = await import('telegram');
        const offline = Boolean(params.offline ?? false);
        response = await client.invoke(new Api.account.UpdateStatus({ offline }));
        break;
      }

      case 'user_get_profile_photos': {
        const { Api } = await import('telegram');
        const entity = await client.getEntity(String(params.userId ?? chatId));
        response = await client.invoke(new Api.photos.GetUserPhotos({
          userId: entity,
          offset: 0,
          maxId: BigInt(0),
          limit: Number(params.limit ?? 10),
        }));
        break;
      }

      default:
        return { nodeId: '', dispatched: false, error: `Unknown user action: ${action}` };
    }

    return { nodeId: '', dispatched: true, response };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`User action dispatch failed for ${action}: ${msg}`);
    return { nodeId: '', dispatched: false, error: msg };
  }
}

function mapParseMode(mode: unknown): 'html' | 'markdown' | undefined {
  const str = String(mode ?? '').toLowerCase();
  if (str === 'html') return 'html';
  if (str === 'markdownv2' || str === 'markdown') return 'markdown';
  return undefined;
}
```

- [ ] **Step 4: Export from index**

Add to `apps/trigger/src/lib/flow-engine/index.ts`:
```typescript
export { dispatchUserAction } from './user-actions.js';
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=user-actions
```

- [ ] **Step 6: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/user-actions.ts apps/trigger/src/__tests__/user-actions.test.ts apps/trigger/src/lib/flow-engine/index.ts
git commit -m "feat(trigger): add user account action dispatcher with 18 GramJS action handlers"
```

---

## Task 4: Update Flow Dispatcher to Route user_* Actions

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`

- [ ] **Step 1: Add user_* routing to dispatchActions**

Read the full dispatcher file first. Then in the `dispatchActions` function (starts around line 32), inside the for-loop, add a check for `user_*` actions AFTER the `BOT_API_ACTIONS` skip (around line 60) and BEFORE the `unified_*` check (around line 66). The insertion point is between `if (BOT_API_ACTIONS.has(action)) continue;` and `if (action.startsWith('unified_'))`:

```typescript
// Import at top of file:
import { dispatchUserAction } from './user-actions.js';

// Inside the for loop, after the internal/context/bot_api action skips:

      // Handle user account actions (MTProto only)
      if (action.startsWith('user_')) {
        // Resolve connection: node override > flow transport config
        const nodeConfig = output.connectionOverride as string | undefined;
        const connectionId = nodeConfig ?? transportConfig?.platformConnectionId;

        if (!connectionId) {
          results.push({ nodeId, dispatched: false, error: 'User account connection required for user_* actions' });
          continue;
        }

        const result = await dispatchUserAction(action, output, connectionId);
        results.push({ ...result, nodeId });
        continue;
      }
```

Also update the `transportConfig` parameter type to include `platformConnectionId`:

```typescript
export async function dispatchActions(
  ctx: FlowContext,
  transportConfig?: {
    transport?: string;
    botInstanceId?: string;
    platform?: string;
    discordBotInstanceId?: string;
    platformConnectionId?: string;  // NEW
  },
): Promise<DispatchResult[]> {
```

- [ ] **Step 2: Run all trigger tests**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

- [ ] **Step 3: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/dispatcher.ts
git commit -m "feat(trigger): route user_* actions through connection-specific GramJS transport"
```

---

## Task 5: Flow Validation for requiresConnection Nodes

**Files:**
- Modify: `apps/api/src/flows/flows.service.ts`

- [ ] **Step 1: Read the flows service to find validateGraph method**

Read `apps/api/src/flows/flows.service.ts` and locate the `validateGraph` method.

- [ ] **Step 2: Add requiresConnection validation**

In the `validateGraph` method, add a check that inspects each node: if its type matches a `requiresConnection: true` entry in the node registry, verify that the flow's `transportConfig.platformConnectionId` is set OR the node has a `connectionOverride` in its data.

Import NODE_TYPES from flow-shared:
```typescript
import { NODE_TYPES } from '@flowbot/flow-shared';
```

Add validation:
```typescript
// Check for user account nodes without a connection
const requiresConnectionTypes = new Set(
  NODE_TYPES.filter(n => n.requiresConnection).map(n => n.type),
);

const transportConfig = flow.transportConfig as Record<string, unknown> | null;
const hasFlowConnection = !!transportConfig?.platformConnectionId;

for (const node of nodes) {
  if (requiresConnectionTypes.has(node.type)) {
    const nodeData = node.data as Record<string, unknown> | undefined;
    const hasNodeOverride = !!nodeData?.connectionOverride;

    if (!hasFlowConnection && !hasNodeOverride) {
      errors.push(
        `Node "${node.data?.label ?? node.type}" requires a User Account connection. ` +
        `Select one in flow settings or set a per-node override.`,
      );
    }
  }
}
```

- [ ] **Step 3: Run API tests**

```bash
cd /root/Development/tg-allegro && pnpm api test
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/flows/flows.service.ts
git commit -m "feat(api): validate that user account nodes have a connection configured"
```

---

## Task 6: Frontend — Node Palette Sub-categories

**Files:**
- Modify: `apps/frontend/src/components/flow-editor/NodePalette.tsx`

- [ ] **Step 1: Update palette to split Telegram nodes into Bot Actions and User Account Actions**

Read the current NodePalette.tsx. Then update the rendering logic:

When `platformFilter` is "telegram" or "all", and category is "action", split Telegram action nodes into two collapsible sub-groups:

1. **Bot Actions** — nodes where `subcategory` is undefined or not `'user_account'`
2. **User Account Actions** — nodes where `subcategory === 'user_account'`

Show a small user icon (from lucide-react `User` icon) next to User Account Actions header. User account nodes render with their purple color (#8B5CF6).

When a user account node is dragged onto the canvas, check if the flow has a `platformConnectionId` in transportConfig. If not, show a yellow warning badge on the node (this is handled by the flow editor canvas, not the palette — but the palette should pass the `requiresConnection` flag in the drag data).

Update `onDragStart` to include `requiresConnection`:
```typescript
onDragStart: (type: string, label: string, category: string, requiresConnection?: boolean) => void;
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd /root/Development/tg-allegro && pnpm frontend build
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/flow-editor/NodePalette.tsx
git commit -m "feat(frontend): split node palette into Bot Actions and User Account Actions sub-categories"
```

---

## Task 7: Frontend — Connection Selection in Flow Editor

**Files:**
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Step 1: Add API function to fetch active MTProto connections**

Add to `apps/frontend/src/lib/api.ts` (if not already present from Slice 3):

Ensure `getConnections` supports filtering by `connectionType`:
```typescript
// Should already exist — verify it supports: getConnections({ platform: 'telegram', status: 'active' })
// The connection list already returns connectionType, so frontend can filter client-side
```

- [ ] **Step 2: Add connection dropdown to flow editor transport config**

Read the flow editor page first (`apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`). Find the transport config section (around lines 1309-1370).

Add a "User Account" dropdown that:
1. Fetches active MTProto connections via `getConnections({ platform: 'telegram', status: 'active' })`
2. Filters to `connectionType === 'mtproto'`
3. Shows connection name + phone number
4. Saves to `transportConfig.platformConnectionId`
5. Shown when transport is "User Account" or "Auto"
6. If empty, shows a link: "No user accounts connected. [Add one →](/dashboard/connections/auth)"

- [ ] **Step 3: Add per-node connection override to property panel**

In the node property panel (where node params are edited), add a collapsible "Advanced" section with a "Connection Override" dropdown. Only shown for nodes where `requiresConnection: true`. Uses the same connection list. Saves to `node.data.connectionOverride`.

- [ ] **Step 4: Add yellow warning badge for nodes missing connection**

When rendering a node on the canvas that has `requiresConnection: true` and neither the flow's `platformConnectionId` nor the node's `connectionOverride` is set, render a small yellow warning triangle icon on the node.

- [ ] **Step 5: Verify frontend builds**

```bash
cd /root/Development/tg-allegro && pnpm frontend build
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx apps/frontend/src/lib/api.ts
git commit -m "feat(frontend): add user account connection selection and per-node override in flow editor"
```

---

## Task 8: Documentation Updates

**Files:**
- Modify: `apps/frontend/src/app/dashboard/connections/page.tsx`
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Connections page descriptions**

In `apps/frontend/src/app/dashboard/connections/page.tsx`, where connections are listed, add a description for MTProto connections:
- Show "Telegram User Account" as the type label (not just "mtproto")
- Add a subtitle: "Acts as a real user — can access private groups, read history, send without bot badge"

- [ ] **Step 2: Update README**

In `README.md`, in the "Key Features" section or near the Flow Builder description, add:

```markdown
### Telegram User Account (MTProto Client)

Flowbot supports connecting real Telegram user accounts via MTProto protocol. Unlike bots, user accounts can:
- Access private groups and channels the user has joined
- Read full chat history and search messages
- Send messages without the "bot" badge
- Join/leave groups, create groups and channels
- Invite users by phone number or username

User account actions are available as purple "User Account Actions" in the flow builder node palette, and require an authenticated connection from the Connections page.
```

- [ ] **Step 3: Update CLAUDE.md**

Add to the Trigger.dev Patterns section:

```markdown
### User Account Actions (user_* prefix)
- Nodes prefixed with `user_` require MTProto transport via PlatformConnection
- Dispatched through `dispatchUserAction()` in `lib/flow-engine/user-actions.ts`
- Transport cached per connection ID in `lib/flow-engine/connection-transport.ts`
- Never routed through Bot API — always direct GramJS
- Flow validation enforces `platformConnectionId` or per-node `connectionOverride`
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/dashboard/connections/page.tsx README.md CLAUDE.md
git commit -m "docs: clarify Telegram User Account vs Bot distinction in UI, README, and CLAUDE.md"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | flow-shared/node-registry.ts | 18 user account nodes + interface extension |
| 1.5 | telegram-transport/GramJsTransport.ts | Add `getClient()` accessor for raw TelegramClient |
| 2 | trigger/connection-transport.ts | Per-connection GramJS transport cache |
| 3 | trigger/user-actions.ts + tests | 18 action handlers mapped to GramJS via `getClient()` |
| 4 | trigger/dispatcher.ts | Route `user_*` actions through connection transport |
| 5 | api/flows.service.ts | Validate requiresConnection nodes |
| 6 | frontend/NodePalette.tsx | Sub-categorized palette |
| 7 | frontend/flows/edit/page.tsx | Connection dropdown + per-node override + warning badge |
| 8 | connections page, README, CLAUDE.md | Documentation clarity |
