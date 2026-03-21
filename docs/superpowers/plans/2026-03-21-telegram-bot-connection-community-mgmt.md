# Telegram Bot Connection & Community Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable adding Telegram bot connections via bot token, manual community CRUD, and bot response scoping in the dashboard.

**Architecture:** Three independent feature slices layered on the existing connection/community/connector infrastructure. The API gets a unified `TelegramConnectionStrategy` that dispatches by `connectionType`. The frontend gets a type selector in the Telegram auth flow and a community creation form. The connector gets scope-based message filtering. The existing `telegram-bot-pool` auto-discovers new bot instances with zero changes.

**Tech Stack:** NestJS 11 (API), Next.js 16 / React 19 (Frontend), grammY (Telegram Bot API), Prisma 7 (DB), Vitest (connector tests), Jest (API tests), platform-kit (shared types)

**Spec:** `docs/superpowers/specs/2026-03-21-telegram-bot-connection-and-community-mgmt-design.md`

---

## File Structure

### New Files
- `packages/platform-kit/src/types/bot-scope.ts` — shared `BotScope` interface
- `apps/api/src/connections/strategies/telegram-connection.strategy.ts` — unified Telegram strategy (replaces `telegram-mtproto.strategy.ts`)
- `apps/api/src/connections/strategies/telegram-connection.strategy.spec.ts` — tests
- `apps/api/src/bot-config/dto/bot-scope.dto.ts` — scope update DTO
- `apps/api/src/bot-config/bot-config.controller.spec.ts` — scope endpoint tests (if not existing)
- `apps/frontend/src/app/dashboard/connections/components/TelegramBotAuthFlow.tsx` — bot token auth wizard
- `apps/frontend/src/app/dashboard/communities/create/page.tsx` — community creation form

### Modified Files
- `packages/platform-kit/src/index.ts` — export `BotScope`
- `packages/telegram-bot-connector/src/connector.ts` — add scope filtering
- `packages/telegram-bot-connector/src/worker.ts` — pass scope from worker data
- `apps/telegram-bot-pool/src/main.ts` — include `metadata` in `toWorkerData`
- `apps/api/src/connections/connections.module.ts` — register new strategy
- `apps/api/src/connections/connections.service.ts` — bot token auth + BotInstance creation in `startAuth`
- `apps/api/src/communities/dto/community.dto.ts` — add `botInstanceId` to `UpdateCommunityDto`
- `apps/api/src/bot-config/bot-config.controller.ts` — add `PUT /:id/scope` endpoint
- `apps/api/src/bot-config/bot-config.service.ts` — add scope update method
- `apps/frontend/src/app/dashboard/connections/auth/page.tsx` — add Bot/Account selector, render `TelegramBotAuthFlow`
- `apps/frontend/src/app/dashboard/communities/page.tsx` — add "Add Community" button
- `apps/frontend/src/lib/api.ts` — add `createCommunity`, `deleteCommunity`, `getBotInstances`, `updateBotScope` methods
- `packages/db/prisma/schema.prisma` — add unique index on `BotInstance.botToken`

---

## Task 1: Add `BotScope` shared type to platform-kit

**Files:**
- Create: `packages/platform-kit/src/types/bot-scope.ts`
- Modify: `packages/platform-kit/src/index.ts`

- [ ] **Step 1: Create the BotScope interface**

```typescript
// packages/platform-kit/src/types/bot-scope.ts
export interface BotScope {
  groupIds?: string[];
  userIds?: string[];
}
```

- [ ] **Step 2: Export from platform-kit index**

Add to `packages/platform-kit/src/index.ts`:
```typescript
export type { BotScope } from './types/bot-scope.js';
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm platform-kit typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/platform-kit/src/types/bot-scope.ts packages/platform-kit/src/index.ts
git commit -m "feat(platform-kit): add BotScope shared type"
```

---

## Task 2: Add unique index on `BotInstance.botToken`

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add unique filtered index to BotInstance model**

In the `BotInstance` model in `schema.prisma`, add after the existing `@@unique([botUsername])`:
```prisma
@@index([botToken])
```

Note: Prisma does not support filtered unique indexes natively. Instead, enforce uniqueness in application code (check before insert). The index improves lookup performance for duplicate detection.

- [ ] **Step 2: Generate Prisma client and create migration**

Run:
```bash
pnpm db prisma:migrate -- --name add-bot-token-index
pnpm db generate
pnpm db build
```

- [ ] **Step 3: Verify migration applied**

Run: `pnpm db prisma:migrate`
Expected: "Already in sync"

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(db): add index on BotInstance.botToken for duplicate detection"
```

---

## Task 3: Create unified `TelegramConnectionStrategy` with bot token validation

**Files:**
- Create: `apps/api/src/connections/strategies/telegram-connection.strategy.ts`
- Create: `apps/api/src/connections/strategies/telegram-connection.strategy.spec.ts`
- Modify: `apps/api/src/connections/connections.module.ts` — swap strategy registration, ensure `PlatformModule` is imported
- Modify: `apps/api/src/connections/connections.service.ts` — inject `PlatformStrategyRegistry`, add bot token handling in `startAuth`

**Important context:** The existing `TelegramMtprotoStrategy` (`telegram-mtproto.strategy.ts`) is a no-op stub — it only registers itself in the strategy registry and contains zero auth logic. The actual MTProto auth flow (phone/code/2FA) is handled entirely by the generic `startAuth`/`submitAuthStep` code in `ConnectionsService`. The new `TelegramConnectionStrategy` replaces this stub and adds bot token dispatch, while the MTProto path continues to work through the generic service code unchanged.

### Step-by-step:

- [ ] **Step 1: Write failing test for bot token validation**

Create `apps/api/src/connections/strategies/telegram-connection.strategy.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { TelegramConnectionStrategy } from './telegram-connection.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStrategyRegistry } from '../../platform/strategy-registry.service';

// Mock global fetch for getMe tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('TelegramConnectionStrategy', () => {
  let strategy: TelegramConnectionStrategy;
  let prisma: { botInstance: { findFirst: jest.Mock; create: jest.Mock }; platformConnection: { update: jest.Mock }; $transaction: jest.Mock };

  beforeEach(async () => {
    mockFetch.mockReset();
    prisma = {
      botInstance: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      platformConnection: { update: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const module = await Test.createTestingModule({
      providers: [
        TelegramConnectionStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformStrategyRegistry, useValue: { register: jest.fn() } },
      ],
    }).compile();

    strategy = module.get(TelegramConnectionStrategy);
  });

  describe('validateBotToken', () => {
    it('should reject invalid token format', async () => {
      await expect(strategy.handleBotTokenAuth('conn-1', 'invalid-token')).rejects.toThrow(
        'Bot token format is invalid',
      );
    });

    it('should reject duplicate bot token', async () => {
      prisma.botInstance.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        strategy.handleBotTokenAuth('conn-1', '123456:ABCdefGHIjklMNO'),
      ).rejects.toThrow('already connected');
    });
  });

  describe('getMe validation', () => {
    const validToken = '123456:ABCdefGHIjklMNO';

    it('should create BotInstance and update connection on valid token', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          result: { id: 123, first_name: 'TestBot', username: 'test_bot', can_join_groups: true },
        }),
      });
      prisma.botInstance.create.mockResolvedValue({ id: 'bot-1' });

      const result = await strategy.handleBotTokenAuth('conn-1', validToken);

      expect(result.botUsername).toBe('test_bot');
      expect(result.botName).toBe('TestBot');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw when Telegram rejects the token', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: false, description: 'Unauthorized' }),
      });

      await expect(strategy.handleBotTokenAuth('conn-1', validToken)).rejects.toThrow(
        'Telegram rejected this token',
      );
    });

    it('should throw on network timeout', async () => {
      mockFetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

      await expect(strategy.handleBotTokenAuth('conn-1', validToken)).rejects.toThrow(
        'Could not reach Telegram',
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm api test -- --testPathPattern=telegram-connection.strategy`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TelegramConnectionStrategy**

Create `apps/api/src/connections/strategies/telegram-connection.strategy.ts`:

```typescript
import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStrategyRegistry } from '../../platform/strategy-registry.service';
import { PLATFORMS } from '../../platform/platform.constants';

const BOT_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]+$/;
const GETME_TIMEOUT_MS = 5000;

@Injectable()
export class TelegramConnectionStrategy implements OnModuleInit {
  readonly platform = PLATFORMS.TELEGRAM;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PlatformStrategyRegistry,
  ) {}

  onModuleInit() {
    this.registry.register('connections', this);
  }

  async handleBotTokenAuth(
    connectionId: string,
    botToken: string,
  ): Promise<{ botUsername: string; botName: string }> {
    // 1. Validate format
    if (!BOT_TOKEN_PATTERN.test(botToken)) {
      throw new BadRequestException(
        'Bot token format is invalid. Expected format from @BotFather.',
      );
    }

    // 2. Check for duplicates
    const existing = await this.prisma.botInstance.findFirst({
      where: { botToken },
    });
    if (existing) {
      throw new BadRequestException('This bot is already connected.');
    }

    // 3. Call Telegram getMe
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GETME_TIMEOUT_MS);

    let botInfo: { id: number; first_name: string; username: string; can_join_groups: boolean };
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`,
        { signal: controller.signal },
      );
      const result = await response.json();
      if (!result.ok) {
        throw new BadRequestException(
          'Telegram rejected this token. Please check it\'s correct.',
        );
      }
      botInfo = result.result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error?.name === 'AbortError') {
        throw new BadRequestException('Could not reach Telegram. Please try again.');
      }
      throw new BadRequestException('Could not reach Telegram. Please try again.');
    } finally {
      clearTimeout(timeout);
    }

    // 4. Create BotInstance + update PlatformConnection in transaction
    await this.prisma.$transaction(async (tx) => {
      const botInstance = await tx.botInstance.create({
        data: {
          name: botInfo.first_name,
          botToken,
          botUsername: botInfo.username,
          platform: 'telegram',
          isActive: true,
        },
      });

      await tx.platformConnection.update({
        where: { id: connectionId },
        data: {
          botInstanceId: botInstance.id,
          credentials: { botToken },
          status: 'active',
          lastActiveAt: new Date(),
          metadata: {
            botUsername: botInfo.username,
            botName: botInfo.first_name,
            canJoinGroups: botInfo.can_join_groups,
          },
        },
      });
    });

    return { botUsername: botInfo.username, botName: botInfo.first_name };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm api test -- --testPathPattern=telegram-connection.strategy`
Expected: PASS (format and duplicate tests pass; getMe tests mock fetch)

- [ ] **Step 5: Remove old stub and wire new strategy + registry injection**

In `apps/api/src/connections/connections.module.ts`:
1. Replace `TelegramMtprotoStrategy` with `TelegramConnectionStrategy` in the providers array
2. Ensure `PlatformModule` is in the `imports` array (so `PlatformStrategyRegistry` is available)

Delete `apps/api/src/connections/strategies/telegram-mtproto.strategy.ts` (it's a no-op stub — see context note above).

In `apps/api/src/connections/connections.service.ts`, add `PlatformStrategyRegistry` to the constructor injection:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly registry: PlatformStrategyRegistry,  // Add this
) {}
```

Add the import at the top:
```typescript
import { PlatformStrategyRegistry } from '../platform/strategy-registry.service';
```

- [ ] **Step 6: Wire bot token path into `connections.service.ts` startAuth**

In `apps/api/src/connections/connections.service.ts`, modify `startAuth()` to check `connectionType`:

```typescript
async startAuth(id: string, params: Record<string, unknown>) {
  const connection = await this.findOne(id);

  // Bot token flow — delegate to strategy
  if (connection.connectionType === 'bot_token' && connection.platform === 'telegram') {
    const strategy = this.registry.get<TelegramConnectionStrategy>('connections', 'telegram');
    const result = await strategy.handleBotTokenAuth(id, params.botToken as string);
    return { connectionId: id, status: 'active', ...result };
  }

  // Existing MTProto / other flows below...
  await this.prisma.platformConnection.update({
    where: { id },
    data: {
      status: 'authenticating',
      metadata: {
        ...((connection.metadata as Record<string, unknown>) || {}),
        authState: { params, startedAt: new Date().toISOString() },
      },
    },
  });
  // ... rest of existing logic
}
```

- [ ] **Step 7: Add lifecycle coupling for deactivate/reactivate**

In `connections.service.ts`, modify `deactivate()` to also deactivate linked BotInstance:

```typescript
async deactivate(id: string) {
  const connection = await this.findOne(id);

  // Deactivate linked bot instance if present
  if (connection.botInstanceId) {
    await this.prisma.botInstance.update({
      where: { id: connection.botInstanceId },
      data: { isActive: false },
    });
  }

  return this.prisma.platformConnection.update({
    where: { id },
    data: { status: 'inactive' },
  });
}
```

In `updateStatus()`, when status transitions to `'active'` and connection has a `botInstanceId`, reactivate the linked bot instance:

```typescript
// Inside updateStatus(), after the existing logic:
if (status === 'active' && connection.botInstanceId) {
  await this.prisma.botInstance.update({
    where: { id: connection.botInstanceId },
    data: { isActive: true },
  });
}
```

- [ ] **Step 8: Run all connection tests**

Run: `pnpm api test -- --testPathPattern=connection`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/connections/
git commit -m "feat(api): add TelegramConnectionStrategy with bot token validation and getMe"
```

---

## Task 4: Add bot scope endpoint to bot-config module

**Files:**
- Modify: `apps/api/src/bot-config/bot-config.controller.ts` — add `PUT /:id/scope`
- Modify: `apps/api/src/bot-config/bot-config.service.ts` — add `updateScope` method
- Create: `apps/api/src/bot-config/dto/bot-scope.dto.ts` — scope DTO

- [ ] **Step 1: Write failing test for scope endpoint**

Add to bot-config controller test file (create if needed):

```typescript
describe('PUT /api/bot-config/:id/scope', () => {
  it('should update bot instance scope in metadata', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/bot-config/bot-1/scope')
      .send({ groupIds: ['chat-123'], userIds: ['user-456'] })
      .expect(200);

    expect(response.body.metadata.scope).toEqual({
      groupIds: ['chat-123'],
      userIds: ['user-456'],
    });
  });
});
```

- [ ] **Step 2: Create BotScopeDto**

Create `apps/api/src/bot-config/dto/bot-scope.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional } from 'class-validator';

export class BotScopeDto {
  @ApiPropertyOptional({ type: [String], description: 'Group/chat IDs to respond to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'User IDs to respond to' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}
```

- [ ] **Step 3: Add updateScope to bot-config service**

In `apps/api/src/bot-config/bot-config.service.ts`, add:

```typescript
async updateScope(botInstanceId: string, scope: { groupIds?: string[]; userIds?: string[] }) {
  const instance = await this.prisma.botInstance.findUnique({
    where: { id: botInstanceId },
  });
  if (!instance) {
    throw new NotFoundException(`Bot instance ${botInstanceId} not found`);
  }

  const currentMetadata = (instance.metadata as Record<string, unknown>) || {};
  return this.prisma.botInstance.update({
    where: { id: botInstanceId },
    data: {
      metadata: { ...currentMetadata, scope },
    },
  });
}
```

- [ ] **Step 4: Add PUT /:id/scope endpoint to controller**

In `apps/api/src/bot-config/bot-config.controller.ts`, add:

```typescript
@Put(':botId/scope')
@ApiOperation({ summary: 'Update bot response scope' })
async updateScope(
  @Param('botId') botId: string,
  @Body() dto: BotScopeDto,
) {
  return this.botConfigService.updateScope(botId, dto);
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm api test -- --testPathPattern=bot-config`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/bot-config/
git commit -m "feat(api): add PUT /bot-config/:id/scope for bot response scoping"
```

---

## Task 5: Expand `UpdateCommunityDto` with `botInstanceId`

**Files:**
- Modify: `apps/api/src/communities/dto/community.dto.ts`
- Modify: `apps/api/src/communities/communities.service.ts` — handle `botInstanceId` in update

- [ ] **Step 1: Add botInstanceId to UpdateCommunityDto**

In `apps/api/src/communities/dto/community.dto.ts`, in the `UpdateCommunityDto` class, add:

```typescript
@ApiPropertyOptional({ description: 'Bot instance ID to link' })
@IsOptional()
@IsString()
botInstanceId?: string;
```

- [ ] **Step 2: Handle botInstanceId in community service update**

In `apps/api/src/communities/communities.service.ts`, ensure the `update()` method passes `botInstanceId` to Prisma when provided. Check the existing update method — if it already spreads the DTO, this may work automatically. If not, add `botInstanceId` to the update data.

- [ ] **Step 3: Add platform validation for botInstanceId**

In the community service `update()` method, when `botInstanceId` is provided, validate that the bot instance's platform matches the community's platform. Use the variable name from the existing `update()` method (likely `existing` or `community` — check the actual code):

```typescript
if (dto.botInstanceId) {
  const botInstance = await this.prisma.botInstance.findUnique({
    where: { id: dto.botInstanceId },
  });
  if (!botInstance) {
    throw new NotFoundException('Bot instance not found');
  }
  // Use the existing community record fetched earlier in the method
  if (botInstance.platform !== existing.platform) {
    throw new BadRequestException('Bot instance platform does not match community platform');
  }
}
```

Also apply the same validation in `create()` when `botInstanceId` is provided in the DTO.

- [ ] **Step 4: Run community tests**

Run: `pnpm api test -- --testPathPattern=communit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/communities/
git commit -m "feat(api): add botInstanceId to UpdateCommunityDto with platform validation"
```

---

## Task 6: Add scope filtering to telegram-bot-connector

**Files:**
- Modify: `packages/telegram-bot-connector/src/connector.ts` — add scope filter
- Modify: `packages/telegram-bot-connector/src/worker.ts` — pass scope from worker data
- Modify: `apps/telegram-bot-pool/src/main.ts` — include metadata in toWorkerData

- [ ] **Step 1: Write failing test for scope filtering**

Create or add to connector test file:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldProcessMessage } from './scope-filter.js';

describe('shouldProcessMessage', () => {
  it('should process all messages when no scope set', () => {
    expect(shouldProcessMessage(undefined, 'chat-1', 'user-1')).toBe(true);
  });

  it('should process all messages when scope is empty', () => {
    expect(shouldProcessMessage({}, 'chat-1', 'user-1')).toBe(true);
  });

  it('should allow message from scoped group', () => {
    expect(shouldProcessMessage({ groupIds: ['chat-1'] }, 'chat-1', 'user-1')).toBe(true);
  });

  it('should allow message from scoped user', () => {
    expect(shouldProcessMessage({ userIds: ['user-1'] }, 'chat-2', 'user-1')).toBe(true);
  });

  it('should reject message not matching any scope', () => {
    expect(
      shouldProcessMessage({ groupIds: ['chat-1'], userIds: ['user-1'] }, 'chat-2', 'user-2'),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm telegram-bot-connector test`
Expected: FAIL — module not found

- [ ] **Step 3: Implement scope filter**

Create `packages/telegram-bot-connector/src/scope-filter.ts`:

```typescript
import type { BotScope } from '@flowbot/platform-kit';

export function shouldProcessMessage(
  scope: BotScope | undefined,
  chatId: string,
  userId: string,
): boolean {
  if (!scope) return true;

  const hasGroupScope = scope.groupIds && scope.groupIds.length > 0;
  const hasUserScope = scope.userIds && scope.userIds.length > 0;

  if (!hasGroupScope && !hasUserScope) return true;

  if (hasGroupScope && scope.groupIds!.includes(chatId)) return true;
  if (hasUserScope && scope.userIds!.includes(userId)) return true;

  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm telegram-bot-connector test`
Expected: PASS

- [ ] **Step 5: Wire scope filter as grammY middleware in connector**

In `packages/telegram-bot-connector/src/connector.ts`, accept `scope` in constructor options and register a grammY middleware **before** `registerFeatures()` and `registerEventListeners()`. This ensures scope filtering applies to ALL event types without modifying the standalone `registerEventListeners()` function.

```typescript
import { shouldProcessMessage } from './scope-filter.js';
import type { BotScope } from '@flowbot/platform-kit';

// Add to constructor options interface:
scope?: BotScope;

// In connect(), after creating transport but BEFORE registering features/listeners:
if (this.scope) {
  const scope = this.scope;
  this.transport.getBot().use(async (ctx, next) => {
    const chatId = String(ctx.chat?.id ?? '');
    const userId = String(ctx.from?.id ?? '');
    if (!shouldProcessMessage(scope, chatId, userId)) {
      return; // Drop — not in scope
    }
    await next();
  });
}

// Then continue with existing:
// this.registerActions();
// registerFeatures(this.transport.getBot());
// registerEventListeners(this.transport.getBot(), this.forwarder, ...);
```

- [ ] **Step 6: Pass scope from worker data**

In `packages/telegram-bot-connector/src/worker.ts`, pass `config.scope` to the connector constructor:

```typescript
runWorker((config) => {
  return new TelegramBotConnector({
    botToken: config.botToken,
    botInstanceId: config.instanceId,
    logger,
    apiUrl: config.apiUrl,
    scope: config.scope,  // Add this
  });
});
```

- [ ] **Step 7: Include metadata in pool's toWorkerData**

In `apps/telegram-bot-pool/src/main.ts`, update `toWorkerData` to pass scope from instance metadata:

```typescript
toWorkerData: (instance) => ({
  instanceId: instance.id,
  botToken: instance.botToken,
  apiUrl: config.apiUrl,
  logLevel: config.logLevel,
  scope: (instance.metadata as Record<string, unknown>)?.scope,  // Add this
}),
```

- [ ] **Step 8: Run all connector tests**

Run: `pnpm telegram-bot-connector test`
Expected: PASS

- [ ] **Step 9: Typecheck pool and connector**

Run: `pnpm telegram-bot-connector typecheck && pnpm platform-kit typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add packages/telegram-bot-connector/ packages/platform-kit/ apps/telegram-bot-pool/
git commit -m "feat(connector): add scope-based message filtering for bot instances"
```

---

## Task 7: Frontend — Add Bot/Account type selector to Telegram auth flow

**Files:**
- Create: `apps/frontend/src/app/dashboard/connections/components/TelegramBotAuthFlow.tsx`
- Modify: `apps/frontend/src/app/dashboard/connections/auth/page.tsx`
- Modify: `apps/frontend/src/lib/api.ts` — add `getBotInstances` method

**Note:** Use the UI agent (`ui-design:create-component` or `frontend-design:frontend-design`) for component implementation. The steps below describe the required behavior.

- [ ] **Step 1: Add API client methods**

In `apps/frontend/src/lib/api.ts`, add:

```typescript
// In ApiClient class:
async getBotInstances(params?: { platform?: string }): Promise<{ data: BotInstance[] }> {
  const query = new URLSearchParams();
  if (params?.platform) query.set('platform', params.platform);
  return this.request(`/bot-config?${query}`);
}

async updateBotScope(botInstanceId: string, scope: { groupIds?: string[]; userIds?: string[] }) {
  return this.request(`/bot-config/${botInstanceId}/scope`, {
    method: 'PUT',
    body: JSON.stringify(scope),
  });
}

async createCommunity(data: {
  platform: string;
  platformCommunityId: string;
  name: string;
  botInstanceId?: string;
}) {
  return this.request('/communities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async deleteCommunity(id: string) {
  return this.request(`/communities/${id}`, { method: 'DELETE' });
}
```

Also add standalone exports at the bottom of the file for these methods.

- [ ] **Step 2: Create TelegramBotAuthFlow component**

Create `apps/frontend/src/app/dashboard/connections/components/TelegramBotAuthFlow.tsx`:

This component follows the same pattern as the existing Discord bot flow:
1. Step 1: Enter connection name
2. Step 2: Paste bot token
3. Step 3: Validating... (loading state while API calls `getMe`)
4. Step 4: Success — show bot username, redirect

**API calls:**
1. `api.createConnection({ platform: "telegram", name, connectionType: "bot_token" })`
2. `api.startConnectionAuth(connectionId, { botToken: token })`
3. On success → redirect to `/dashboard/connections`

**Error handling:**
- Display error messages from API (format invalid, token rejected, network timeout, duplicate)
- Allow retry without starting over

Use `StepIndicator` component from the parent page (extract if needed).

- [ ] **Step 3: Add Bot/Account selector to Telegram flow**

In `apps/frontend/src/app/dashboard/connections/auth/page.tsx`:

After user selects "Telegram" platform, show a type selector before the auth flow:

```tsx
// New state
const [telegramType, setTelegramType] = useState<"bot" | "account" | null>(null);

// When platform === "telegram" and telegramType === null, show:
// Two cards/buttons: "Bot" (icon: Bot/Robot) and "Account" (icon: User)
// "Bot" → sets telegramType to "bot", renders TelegramBotAuthFlow
// "Account" → sets telegramType to "account", renders existing TelegramAuthFlow (MTProto)
```

- [ ] **Step 4: Verify the flow works end-to-end**

Run: `pnpm frontend dev`
- Navigate to Connections → Add Connection → Telegram
- Should see Bot / Account choice
- Select Bot → should show name + token form
- Select Account → should show existing phone/code flow

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/dashboard/connections/ apps/frontend/src/lib/api.ts
git commit -m "feat(frontend): add Telegram bot token connection flow with type selector"
```

---

## Task 8: Frontend — Community creation form

**Files:**
- Create: `apps/frontend/src/app/dashboard/communities/create/page.tsx`
- Modify: `apps/frontend/src/app/dashboard/communities/page.tsx` — add "Add Community" button

**Note:** Use the UI agent for component implementation.

- [ ] **Step 1: Add "Add Community" button to communities list page**

In `apps/frontend/src/app/dashboard/communities/page.tsx`, add a button in the header that links to `/dashboard/communities/create`:

```tsx
<Link href="/dashboard/communities/create">
  <Button>Add Community</Button>
</Link>
```

- [ ] **Step 2: Create community creation page**

Create `apps/frontend/src/app/dashboard/communities/create/page.tsx`:

**Form fields:**
- Name (text input, required)
- Platform ID (text input, required — "Group/Chat ID")
- Connected Bot (dropdown, optional — fetches `api.getBotInstances({ platform: queryParam })`)

**Platform** is inherited from `usePlatform()` context — the nav selector. Display it as a read-only badge.

**Submit handler:**
```typescript
const { queryParam } = usePlatform();
await api.createCommunity({
  platform: queryParam || 'telegram',
  platformCommunityId: platformId,
  name,
  botInstanceId: selectedBot || undefined,
});
router.push('/dashboard/communities');
```

**Validation:**
- Name and Platform ID are required
- Show error if platform is "all" (must select a specific platform)

- [ ] **Step 3: Verify the flow works**

Run: `pnpm frontend dev`
- Navigate to Communities → Add Community
- Fill in name and platform ID
- Optionally select a bot
- Submit → should redirect to communities list
- New community should appear in the list

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/dashboard/communities/
git commit -m "feat(frontend): add manual community creation form"
```

---

## Task 9: Frontend — Bot scope configuration on connection detail page

**Files:**
- Create: `apps/frontend/src/app/dashboard/connections/[id]/page.tsx` — connection detail page with scope config (or modify if it exists)

**Note:** Use the UI agent for component implementation. Per the spec, scope is a per-bot concept configured on the "bot instance detail page (accessed via the connection)."

- [ ] **Step 1: Add scope configuration section to connection detail page**

On the connection detail page, when the connection has `connectionType: "bot_token"` and a linked `botInstanceId`, show a "Response Scope" section:

1. **Current scope** — list of scoped group IDs and user IDs (fetched from bot instance metadata)
2. **Add group** — text input to add a group/chat ID (or select from linked communities)
3. **Add user** — text input to add a user ID
4. **Remove** — button to remove entries
5. **Save** — calls `api.updateBotScope(botInstanceId, { groupIds, userIds })`

If no scope is configured, show a message: "This bot responds to all messages. Add groups or users to restrict."

Fetch the bot instance data via existing `api.getBotInstances()` or a new `api.getBotInstance(id)` method.

- [ ] **Step 2: Verify scope configuration works**

Run: `pnpm frontend dev`
- Navigate to Connections → click a bot connection
- Should see Response Scope section
- Add group IDs and user IDs to scope
- Save → should persist
- Reload → should show saved scope
- Should NOT show scope section for MTProto connections

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/dashboard/connections/
git commit -m "feat(frontend): add bot scope configuration to connection detail page"
```

---

## Task 10: Integration testing

- [ ] **Step 1: Run all API tests**

Run: `pnpm api test`
Expected: All 238+ tests pass

- [ ] **Step 2: Run all connector tests**

Run: `pnpm telegram-bot-connector test && pnpm platform-kit test`
Expected: All tests pass

- [ ] **Step 3: Typecheck all modified workspaces**

Run:
```bash
pnpm telegram-bot-connector typecheck
pnpm platform-kit typecheck
pnpm api build
```
Expected: All pass

- [ ] **Step 4: Manual E2E test**

1. Start API: `pnpm api start:dev`
2. Start frontend: `pnpm frontend dev`
3. Start pool: Run telegram-bot-pool (needs DATABASE_URL)
4. Test bot connection flow:
   - Add Connection → Telegram → Bot → enter name + token → verify bot appears
   - Check pool logs — bot worker should spawn within 30s
5. Test community creation:
   - Communities → Add Community → enter name + platform ID → optionally link bot
   - Verify community appears in list
6. Test scope:
   - Open community with linked bot → configure scope → save
   - Verify bot only responds to scoped groups/users

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration test fixes for bot connection and community management"
```
