# Multi-Platform Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Telegram-first Flowbot platform into a generic multi-platform system supporting Telegram, Discord, and future platforms.

**Architecture:** Platform Discriminator with Shared Core. Each entity gets a `platform` string column. Platform-specific logic lives in strategy classes selected at runtime. Database uses new tables + data copy migration per slice.

**Tech Stack:** Prisma 7 (PostgreSQL), NestJS 11, Next.js 16.1, Trigger.dev SDK 3.x, Jest (API tests), Vitest (Trigger tests)

**Spec:** `docs/superpowers/specs/2026-03-19-multi-platform-architecture-design.md`

---

## File Map (All Slices)

### New Files to Create

```
# Slice 1: Platform Infrastructure + Identity
packages/db/prisma/schema.prisma                          # MODIFY — add new models
apps/api/src/platform/platform.module.ts                   # CREATE
apps/api/src/platform/platform.constants.ts                # CREATE — platform enum, types
apps/api/src/platform/strategy-registry.service.ts         # CREATE
apps/api/src/platform/strategy-registry.service.spec.ts    # CREATE
apps/api/src/identity/identity.module.ts                   # CREATE
apps/api/src/identity/accounts.controller.ts               # CREATE
apps/api/src/identity/accounts.service.ts                  # CREATE
apps/api/src/identity/accounts.service.spec.ts             # CREATE
apps/api/src/identity/identity.controller.ts               # CREATE
apps/api/src/identity/identity.service.ts                  # CREATE
apps/api/src/identity/identity.service.spec.ts             # CREATE
apps/api/src/identity/dto/platform-account.dto.ts          # CREATE
apps/api/src/identity/dto/user-identity.dto.ts             # CREATE
apps/api/src/identity/dto/index.ts                         # CREATE
scripts/migrate-slice1-identity.ts                         # CREATE — migration script
apps/frontend/src/components/platform-badge.tsx             # CREATE
apps/frontend/src/components/platform-filter.tsx            # CREATE
apps/frontend/src/lib/platform-context.tsx                  # CREATE
apps/frontend/src/app/dashboard/identity/accounts/page.tsx  # CREATE
apps/frontend/src/app/dashboard/identity/accounts/loading.tsx # CREATE
apps/frontend/src/app/dashboard/identity/linked/page.tsx    # CREATE
apps/frontend/src/app/dashboard/identity/linked/loading.tsx # CREATE

# Slice 2: Communities + Moderation
apps/api/src/communities/communities.module.ts              # CREATE
apps/api/src/communities/communities.controller.ts          # CREATE
apps/api/src/communities/communities.service.ts             # CREATE
apps/api/src/communities/communities.service.spec.ts        # CREATE
apps/api/src/communities/members.controller.ts              # CREATE
apps/api/src/communities/members.service.ts                 # CREATE
apps/api/src/communities/members.service.spec.ts            # CREATE
apps/api/src/communities/strategies/telegram-community.strategy.ts  # CREATE
apps/api/src/communities/strategies/discord-community.strategy.ts   # CREATE
apps/api/src/communities/dto/community.dto.ts               # CREATE
apps/api/src/communities/dto/community-config.dto.ts        # CREATE
apps/api/src/communities/dto/community-member.dto.ts        # CREATE
apps/api/src/communities/dto/index.ts                       # CREATE
scripts/migrate-slice2-communities.ts                       # CREATE
apps/frontend/src/app/dashboard/communities/page.tsx         # CREATE
apps/frontend/src/app/dashboard/communities/loading.tsx      # CREATE
apps/frontend/src/app/dashboard/communities/[id]/page.tsx    # CREATE
apps/frontend/src/app/dashboard/communities/[id]/loading.tsx # CREATE
apps/frontend/src/app/dashboard/communities/[id]/members/page.tsx    # CREATE
apps/frontend/src/app/dashboard/communities/[id]/members/loading.tsx # CREATE
apps/frontend/src/app/dashboard/communities/[id]/warnings/page.tsx   # CREATE
apps/frontend/src/app/dashboard/communities/[id]/warnings/loading.tsx # CREATE

# Slice 3: Connections
apps/api/src/connections/connections.module.ts               # CREATE
apps/api/src/connections/connections.controller.ts           # CREATE
apps/api/src/connections/connections.service.ts              # CREATE
apps/api/src/connections/connections.service.spec.ts         # CREATE
apps/api/src/connections/strategies/telegram-mtproto.strategy.ts  # CREATE
apps/api/src/connections/strategies/discord-oauth.strategy.ts     # CREATE
apps/api/src/connections/dto/connection.dto.ts               # CREATE
apps/api/src/connections/dto/index.ts                        # CREATE
scripts/migrate-slice3-connections.ts                        # CREATE
apps/frontend/src/app/dashboard/connections/page.tsx          # CREATE
apps/frontend/src/app/dashboard/connections/loading.tsx       # CREATE
apps/frontend/src/app/dashboard/connections/auth/page.tsx     # CREATE
apps/frontend/src/app/dashboard/connections/auth/loading.tsx  # CREATE
apps/frontend/src/app/dashboard/connections/health/page.tsx   # CREATE
apps/frontend/src/app/dashboard/connections/health/loading.tsx # CREATE

# Slice 4: Broadcast + Cross-post
scripts/migrate-slice4-broadcast.ts                          # CREATE

# Slice 5: Reputation + Analytics
scripts/migrate-slice5-reputation-analytics.ts               # CREATE

# Slice 6: Trigger.dev + Bot Integration
# Mostly modifications to existing files

# Slice 7: Cleanup
scripts/migrate-slice7-cleanup.ts                            # CREATE
```

### Files to Modify

```
# Slice 1
apps/api/src/app.module.ts                                  # Add PlatformModule, IdentityModule
apps/api/src/common/testing/prisma-mock.factory.ts           # Add new model mocks
apps/frontend/src/lib/api.ts                                 # Add identity/accounts API functions
apps/frontend/src/components/sidebar.tsx                      # Update nav structure
apps/frontend/src/app/layout.tsx                              # Update description

# Slice 2
apps/api/src/app.module.ts                                   # Add CommunitiesModule
apps/api/src/moderation/warnings/warnings.service.ts         # Re-point to Community/PlatformAccount
apps/api/src/moderation/warnings/warnings.controller.ts      # Update routes
apps/api/src/moderation/logs/logs.service.ts                 # Re-point
apps/api/src/moderation/logs/logs.controller.ts              # Update routes
apps/api/src/moderation/scheduled-messages/scheduled-messages.service.ts  # Re-point
apps/frontend/src/lib/api.ts                                  # Add communities API
apps/frontend/src/components/sidebar.tsx                       # Update nav

# Slice 3
apps/api/src/app.module.ts                                    # Add ConnectionsModule
apps/frontend/src/lib/api.ts                                   # Add connections API
apps/frontend/src/components/sidebar.tsx                        # Update nav

# Slice 4
apps/api/src/broadcast/broadcast.service.ts                    # Multi-platform support
apps/api/src/broadcast/broadcast.controller.ts                 # Update DTOs
apps/api/src/broadcast/dto/broadcast.dto.ts                    # New fields
apps/api/src/moderation/crosspost/crosspost.service.ts         # Re-point to Communities
apps/api/src/moderation/crosspost/dto/crosspost-template.dto.ts # New fields
apps/trigger/src/trigger/broadcast.ts                           # Multi-platform dispatch
apps/trigger/src/trigger/cross-post.ts                          # Multi-platform dispatch
apps/frontend/src/app/dashboard/broadcast/page.tsx              # Multi-platform UI

# Slice 5
apps/api/src/reputation/reputation.service.ts                   # Re-point to PlatformAccount
apps/api/src/reputation/reputation.controller.ts                # New routes
apps/api/src/analytics/analytics.service.ts                     # Re-point to Community
apps/api/src/analytics/analytics.controller.ts                  # Update routes
apps/frontend/src/app/dashboard/community/reputation/page.tsx   # Update

# Slice 6
apps/trigger/src/lib/flow-engine/dispatcher.ts                  # Data-driven routing
apps/trigger/src/trigger/flow-execution.ts                       # Update
apps/trigger/src/trigger/analytics-snapshot.ts                   # Community-based
apps/trigger/src/trigger/scheduled-message.ts                    # Community-based

# Slice 7
apps/api/src/app.module.ts                                      # Remove old modules
```

---

## Slice 1: Platform Infrastructure + Identity

### Task 1.1: Add New Prisma Models

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add PlatformAccount and update UserIdentity models to schema.prisma**

Append after the existing `UserIdentity` model (line 67):

```prisma
model PlatformAccount {
  id                  String    @id @default(cuid())
  identityId          String?
  identity            UserIdentity? @relation(fields: [identityId], references: [id])
  platform            String    // "telegram" | "discord" | "slack" | "whatsapp" | "custom"
  platformUserId      String    // Was telegramId (BigInt), now string for all platforms
  username            String?
  firstName           String?
  lastName            String?
  metadata            Json?     // Platform-specific: language_code, is_premium, avatar, etc.
  isBanned            Boolean   @default(false)
  bannedAt            DateTime?
  banReason           String?
  messageCount        Int       @default(0)
  commandCount        Int       @default(0)
  isVerified          Boolean   @default(false)
  verifiedAt          DateTime?
  lastSeenAt          DateTime?
  lastMessageAt       DateTime?
  lastCommunityId     String?
  referralCode        String?   @unique
  referredByAccountId String?
  referredBy          PlatformAccount? @relation("AccountReferrals", fields: [referredByAccountId], references: [id])
  referrals           PlatformAccount[] @relation("AccountReferrals")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([platform, platformUserId])
  @@index([platform])
  @@index([isBanned])
  @@index([lastSeenAt])
  @@index([username])
  @@index([createdAt])
  @@index([identityId])
}
```

Update the existing `UserIdentity` model to add the `platformAccounts` relation and new fields:

```prisma
model UserIdentity {
  id               String            @id @default(cuid())
  telegramId       BigInt            @unique  // kept for backward compat during migration
  userId           String?           @unique
  user             User?             @relation(fields: [userId], references: [id])
  displayName      String?
  email            String?
  reputationScore  Int               @default(0)
  platformAccounts PlatformAccount[]
  firstSeenAt      DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@index([telegramId])
  @@index([userId])
}
```

- [ ] **Step 2: Run prisma generate and build**

```bash
cd /root/Development/tg-allegro && pnpm db generate && pnpm db build
```

Expected: Success, no errors.

- [ ] **Step 3: Create migration**

```bash
cd /root/Development/tg-allegro && pnpm db prisma:push
```

Expected: Schema pushed to database with new `PlatformAccount` table and updated `UserIdentity`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): add PlatformAccount model and update UserIdentity for multi-platform identity"
```

---

### Task 1.2: Platform Module — Constants and Strategy Registry

**Files:**
- Create: `apps/api/src/platform/platform.constants.ts`
- Create: `apps/api/src/platform/strategy-registry.service.ts`
- Create: `apps/api/src/platform/strategy-registry.service.spec.ts`
- Create: `apps/api/src/platform/platform.module.ts`

- [ ] **Step 1: Write the strategy registry test**

Create `apps/api/src/platform/strategy-registry.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformStrategyRegistry, IPlatformStrategy } from './strategy-registry.service';

class TestStrategy implements IPlatformStrategy {
  platform = 'telegram';
}

class AnotherStrategy implements IPlatformStrategy {
  platform = 'discord';
}

describe('PlatformStrategyRegistry', () => {
  let registry: PlatformStrategyRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformStrategyRegistry],
    }).compile();

    registry = module.get(PlatformStrategyRegistry);
  });

  it('should register and retrieve a strategy', () => {
    const strategy = new TestStrategy();
    registry.register('moderation', strategy);

    const result = registry.get<TestStrategy>('moderation', 'telegram');
    expect(result).toBe(strategy);
  });

  it('should throw for unregistered module', () => {
    expect(() => registry.get('unknown', 'telegram')).toThrow();
  });

  it('should throw for unregistered platform', () => {
    registry.register('moderation', new TestStrategy());
    expect(() => registry.get('moderation', 'slack')).toThrow();
  });

  it('should return all strategies for a module', () => {
    const tg = new TestStrategy();
    const dc = new AnotherStrategy();
    registry.register('moderation', tg);
    registry.register('moderation', dc);

    const all = registry.getAll('moderation');
    expect(all).toHaveLength(2);
  });

  it('should check if platform is supported', () => {
    registry.register('moderation', new TestStrategy());

    expect(registry.supports('moderation', 'telegram')).toBe(true);
    expect(registry.supports('moderation', 'discord')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/Development/tg-allegro && pnpm api test -- --testPathPattern=strategy-registry
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create platform constants**

Create `apps/api/src/platform/platform.constants.ts`:

```typescript
export const PLATFORMS = {
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
  SLACK: 'slack',
  WHATSAPP: 'whatsapp',
  CUSTOM: 'custom',
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

export const PLATFORM_LABELS: Record<Platform, string> = {
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  custom: 'Custom',
};
```

- [ ] **Step 4: Create strategy registry service**

Create `apps/api/src/platform/strategy-registry.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

export interface IPlatformStrategy {
  platform: string;
}

@Injectable()
export class PlatformStrategyRegistry {
  private readonly logger = new Logger(PlatformStrategyRegistry.name);
  private readonly strategies = new Map<string, Map<string, IPlatformStrategy>>();

  register(module: string, strategy: IPlatformStrategy): void {
    if (!this.strategies.has(module)) {
      this.strategies.set(module, new Map());
    }
    this.strategies.get(module)!.set(strategy.platform, strategy);
    this.logger.log(`Registered ${strategy.platform} strategy for ${module}`);
  }

  get<T extends IPlatformStrategy>(module: string, platform: string): T {
    const moduleStrategies = this.strategies.get(module);
    if (!moduleStrategies) {
      throw new Error(`No strategies registered for module: ${module}`);
    }
    const strategy = moduleStrategies.get(platform);
    if (!strategy) {
      throw new Error(`No ${platform} strategy registered for module: ${module}`);
    }
    return strategy as T;
  }

  getAll(module: string): IPlatformStrategy[] {
    const moduleStrategies = this.strategies.get(module);
    if (!moduleStrategies) {
      return [];
    }
    return Array.from(moduleStrategies.values());
  }

  supports(module: string, platform: string): boolean {
    return this.strategies.get(module)?.has(platform) ?? false;
  }
}
```

- [ ] **Step 5: Create platform module**

Create `apps/api/src/platform/platform.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PlatformStrategyRegistry } from './strategy-registry.service';

@Global()
@Module({
  providers: [PlatformStrategyRegistry],
  exports: [PlatformStrategyRegistry],
})
export class PlatformModule {}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /root/Development/tg-allegro && pnpm api test -- --testPathPattern=strategy-registry
```

Expected: PASS — all 5 tests pass.

- [ ] **Step 7: Register PlatformModule in AppModule**

Modify `apps/api/src/app.module.ts` — add import and add to imports array:

```typescript
import { PlatformModule } from './platform/platform.module';
// ... in imports array, add:
    PlatformModule,
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/platform/
git commit -m "feat(api): add PlatformModule with strategy registry and platform constants"
```

---

### Task 1.3: Identity Module — Accounts Service

**Files:**
- Create: `apps/api/src/identity/dto/platform-account.dto.ts`
- Create: `apps/api/src/identity/dto/user-identity.dto.ts`
- Create: `apps/api/src/identity/dto/index.ts`
- Create: `apps/api/src/identity/accounts.service.ts`
- Create: `apps/api/src/identity/accounts.service.spec.ts`

- [ ] **Step 1: Create DTOs**

Create `apps/api/src/identity/dto/platform-account.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class PlatformAccountDto {
  @ApiProperty() id!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() platformUserId!: string;
  @ApiProperty({ required: false }) identityId?: string;
  @ApiProperty({ required: false }) username?: string;
  @ApiProperty({ required: false }) firstName?: string;
  @ApiProperty({ required: false }) lastName?: string;
  @ApiProperty({ required: false }) metadata?: Record<string, unknown>;
  @ApiProperty() isBanned!: boolean;
  @ApiProperty({ required: false }) bannedAt?: Date;
  @ApiProperty({ required: false }) banReason?: string;
  @ApiProperty() messageCount!: number;
  @ApiProperty() commandCount!: number;
  @ApiProperty() isVerified!: boolean;
  @ApiProperty({ required: false }) verifiedAt?: Date;
  @ApiProperty({ required: false }) lastSeenAt?: Date;
  @ApiProperty({ required: false }) lastMessageAt?: Date;
  @ApiProperty({ required: false }) referralCode?: string;
  @ApiProperty({ required: false }) referredByAccountId?: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PlatformAccountListResponseDto {
  @ApiProperty({ type: [PlatformAccountDto] }) data!: PlatformAccountDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class BanAccountDto {
  @IsBoolean() @ApiProperty() isBanned!: boolean;
  @IsString() @IsOptional() @ApiProperty({ required: false }) banReason?: string;
}

export class AccountStatsDto {
  @ApiProperty() totalAccounts!: number;
  @ApiProperty() activeAccounts!: number;
  @ApiProperty() bannedAccounts!: number;
  @ApiProperty() newAccountsToday!: number;
  @ApiProperty() verifiedAccounts!: number;
  @ApiProperty() totalMessages!: number;
  @ApiProperty() totalCommands!: number;
  @ApiProperty() platformBreakdown!: Record<string, number>;
}
```

Create `apps/api/src/identity/dto/user-identity.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { PlatformAccountDto } from './platform-account.dto';

export class UserIdentityDto {
  @ApiProperty() id!: string;
  @ApiProperty({ required: false }) displayName?: string;
  @ApiProperty({ required: false }) email?: string;
  @ApiProperty({ type: [PlatformAccountDto] }) platformAccounts!: PlatformAccountDto[];
  @ApiProperty() createdAt!: Date;
}

export class UserIdentityListResponseDto {
  @ApiProperty({ type: [UserIdentityDto] }) data!: UserIdentityDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class LinkAccountDto {
  @ApiProperty() platformAccountId!: string;
}
```

Create `apps/api/src/identity/dto/index.ts`:

```typescript
export * from './platform-account.dto';
export * from './user-identity.dto';
```

- [ ] **Step 2: Write accounts service test**

Create `apps/api/src/identity/accounts.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';

function createMockModel() {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
    groupBy: jest.fn(),
  };
}

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: Record<string, any>;

  const mockAccount = {
    id: 'acc-1',
    identityId: null,
    platform: 'telegram',
    platformUserId: '12345',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    metadata: { languageCode: 'en' },
    isBanned: false,
    bannedAt: null,
    banReason: null,
    messageCount: 100,
    commandCount: 10,
    isVerified: true,
    verifiedAt: new Date('2026-02-01'),
    lastSeenAt: new Date('2026-03-01'),
    lastMessageAt: new Date('2026-03-01'),
    lastCommunityId: null,
    referralCode: 'REF123',
    referredByAccountId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      platformAccount: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  describe('findAll', () => {
    it('should return paginated accounts', async () => {
      prisma.platformAccount.findMany.mockResolvedValue([mockAccount]);
      prisma.platformAccount.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].platform).toBe('telegram');
      expect(result.data[0].platformUserId).toBe('12345');
    });

    it('should filter by platform', async () => {
      prisma.platformAccount.findMany.mockResolvedValue([]);
      prisma.platformAccount.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, undefined, 'telegram');

      expect(prisma.platformAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ platform: 'telegram' }),
        }),
      );
    });

    it('should filter by search', async () => {
      prisma.platformAccount.findMany.mockResolvedValue([]);
      prisma.platformAccount.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'testuser');

      expect(prisma.platformAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            username: { contains: 'testuser', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an account by ID', async () => {
      prisma.platformAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.findOne('acc-1');

      expect(result.id).toBe('acc-1');
      expect(result.platform).toBe('telegram');
    });

    it('should throw NotFoundException for non-existent account', async () => {
      prisma.platformAccount.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setBanStatus', () => {
    it('should ban an account', async () => {
      prisma.platformAccount.findUnique.mockResolvedValue(mockAccount);
      prisma.platformAccount.update.mockResolvedValue({
        ...mockAccount,
        isBanned: true,
        bannedAt: new Date(),
        banReason: 'spam',
      });

      const result = await service.setBanStatus('acc-1', true, 'spam');

      expect(result.isBanned).toBe(true);
      expect(result.banReason).toBe('spam');
    });

    it('should throw NotFoundException for non-existent account', async () => {
      prisma.platformAccount.findUnique.mockResolvedValue(null);

      await expect(service.setBanStatus('nonexistent', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return account statistics with platform breakdown', async () => {
      prisma.platformAccount.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(50)  // active
        .mockResolvedValueOnce(5)   // banned
        .mockResolvedValueOnce(3)   // new today
        .mockResolvedValueOnce(80); // verified

      prisma.platformAccount.aggregate.mockResolvedValue({
        _sum: { messageCount: 5000, commandCount: 200 },
      });

      prisma.platformAccount.groupBy.mockResolvedValue([
        { platform: 'telegram', _count: { id: 90 } },
        { platform: 'discord', _count: { id: 10 } },
      ]);

      const result = await service.getStats();

      expect(result.totalAccounts).toBe(100);
      expect(result.platformBreakdown).toEqual({ telegram: 90, discord: 10 });
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /root/Development/tg-allegro && pnpm api test -- --testPathPattern=accounts.service
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement accounts service**

Create `apps/api/src/identity/accounts.service.ts`:

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PlatformAccountDto,
  PlatformAccountListResponseDto,
  AccountStatsDto,
} from './dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    search?: string,
    isBanned?: boolean,
    platform?: string,
  ): Promise<PlatformAccountListResponseDto> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (search) {
      where.username = { contains: search, mode: 'insensitive' };
    }
    if (isBanned !== undefined) {
      where.isBanned = isBanned;
    }
    if (platform) {
      where.platform = platform;
    }

    const [accounts, total] = await Promise.all([
      this.prisma.platformAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.platformAccount.count({ where }),
    ]);

    return {
      data: accounts.map(this.mapToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<PlatformAccountDto> {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return this.mapToDto(account);
  }

  async setBanStatus(id: string, isBanned: boolean, banReason?: string): Promise<PlatformAccountDto> {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    const updated = await this.prisma.platformAccount.update({
      where: { id },
      data: {
        isBanned,
        bannedAt: isBanned ? new Date() : null,
        banReason: isBanned ? (banReason ?? null) : null,
      },
    });

    this.logger.log(
      `Account ${id} (${account.platform}/${account.platformUserId}) ban status set to ${isBanned}`,
    );

    return this.mapToDto(updated);
  }

  async getStats(): Promise<AccountStatsDto> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalAccounts, activeAccounts, bannedAccounts, newAccountsToday, verifiedAccounts, aggregates, platformGroups] =
      await Promise.all([
        this.prisma.platformAccount.count(),
        this.prisma.platformAccount.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
        this.prisma.platformAccount.count({ where: { isBanned: true } }),
        this.prisma.platformAccount.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.platformAccount.count({ where: { verifiedAt: { not: null } } }),
        this.prisma.platformAccount.aggregate({
          _sum: { messageCount: true, commandCount: true },
        }),
        this.prisma.platformAccount.groupBy({
          by: ['platform'],
          _count: { id: true },
        }),
      ]);

    const platformBreakdown: Record<string, number> = {};
    for (const group of platformGroups) {
      platformBreakdown[group.platform] = group._count.id;
    }

    return {
      totalAccounts,
      activeAccounts,
      bannedAccounts,
      newAccountsToday,
      verifiedAccounts,
      totalMessages: aggregates._sum.messageCount ?? 0,
      totalCommands: aggregates._sum.commandCount ?? 0,
      platformBreakdown,
    };
  }

  private mapToDto(account: any): PlatformAccountDto {
    return {
      id: account.id,
      platform: account.platform,
      platformUserId: account.platformUserId,
      identityId: account.identityId ?? undefined,
      username: account.username ?? undefined,
      firstName: account.firstName ?? undefined,
      lastName: account.lastName ?? undefined,
      metadata: account.metadata ?? undefined,
      isBanned: account.isBanned,
      bannedAt: account.bannedAt ?? undefined,
      banReason: account.banReason ?? undefined,
      messageCount: account.messageCount,
      commandCount: account.commandCount,
      isVerified: account.isVerified,
      verifiedAt: account.verifiedAt ?? undefined,
      lastSeenAt: account.lastSeenAt ?? undefined,
      lastMessageAt: account.lastMessageAt ?? undefined,
      referralCode: account.referralCode ?? undefined,
      referredByAccountId: account.referredByAccountId ?? undefined,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /root/Development/tg-allegro && pnpm api test -- --testPathPattern=accounts.service
```

Expected: PASS — all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/identity/
git commit -m "feat(api): add AccountsService with CRUD, ban management, and platform-aware stats"
```

---

### Task 1.4: Identity Module — Identity Service (Linking)

**Files:**
- Create: `apps/api/src/identity/identity.service.ts`
- Create: `apps/api/src/identity/identity.service.spec.ts`

- [ ] **Step 1: Write identity service test**

Create `apps/api/src/identity/identity.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { PrismaService } from '../prisma/prisma.service';

function createMockModel() {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };
}

describe('IdentityService', () => {
  let service: IdentityService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      userIdentity: createMockModel(),
      platformAccount: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
  });

  describe('findAll', () => {
    it('should return paginated identities with linked accounts', async () => {
      const mockIdentity = {
        id: 'ident-1',
        displayName: 'Test User',
        email: null,
        firstSeenAt: new Date(),
        platformAccounts: [
          { id: 'acc-1', platform: 'telegram', platformUserId: '12345', username: 'test' },
        ],
      };

      prisma.userIdentity.findMany.mockResolvedValue([mockIdentity]);
      prisma.userIdentity.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].platformAccounts).toHaveLength(1);
    });
  });

  describe('linkAccount', () => {
    it('should link an account to an identity', async () => {
      const identity = { id: 'ident-1', displayName: 'Test' };
      const account = { id: 'acc-1', identityId: null, platform: 'telegram' };

      prisma.userIdentity.findUnique.mockResolvedValue(identity);
      prisma.platformAccount.findUnique.mockResolvedValue(account);
      prisma.platformAccount.update.mockResolvedValue({ ...account, identityId: 'ident-1' });
      prisma.userIdentity.findUnique.mockResolvedValueOnce(identity).mockResolvedValueOnce({
        ...identity,
        platformAccounts: [{ ...account, identityId: 'ident-1' }],
      });

      const result = await service.linkAccount('ident-1', 'acc-1');

      expect(prisma.platformAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { identityId: 'ident-1' },
      });
    });

    it('should throw if account already linked to another identity', async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({ id: 'ident-1' });
      prisma.platformAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        identityId: 'ident-other',
      });

      await expect(service.linkAccount('ident-1', 'acc-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unlinkAccount', () => {
    it('should unlink an account from an identity', async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({ id: 'ident-1' });
      prisma.platformAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        identityId: 'ident-1',
      });
      prisma.platformAccount.update.mockResolvedValue({ id: 'acc-1', identityId: null });

      await service.unlinkAccount('ident-1', 'acc-1');

      expect(prisma.platformAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { identityId: null },
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/Development/tg-allegro && pnpm api test -- --testPathPattern=identity.service
```

Expected: FAIL.

- [ ] **Step 3: Implement identity service**

Create `apps/api/src/identity/identity.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserIdentityDto, UserIdentityListResponseDto } from './dto';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 20, search?: string): Promise<UserIdentityListResponseDto> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { platformAccounts: { some: { username: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [identities, total] = await Promise.all([
      this.prisma.userIdentity.findMany({
        where,
        skip,
        take: limit,
        include: {
          platformAccounts: {
            select: {
              id: true,
              platform: true,
              platformUserId: true,
              username: true,
              firstName: true,
              lastName: true,
              isBanned: true,
              messageCount: true,
              isVerified: true,
              createdAt: true,
            },
          },
        },
        orderBy: { firstSeenAt: 'desc' },
      }),
      this.prisma.userIdentity.count({ where }),
    ]);

    return {
      data: identities.map(this.mapToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<UserIdentityDto> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id },
      include: { platformAccounts: true },
    });

    if (!identity) {
      throw new NotFoundException(`Identity with ID ${id} not found`);
    }

    return this.mapToDto(identity);
  }

  async linkAccount(identityId: string, accountId: string): Promise<UserIdentityDto> {
    const identity = await this.prisma.userIdentity.findUnique({ where: { id: identityId } });
    if (!identity) {
      throw new NotFoundException(`Identity ${identityId} not found`);
    }

    const account = await this.prisma.platformAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (account.identityId && account.identityId !== identityId) {
      throw new BadRequestException(
        `Account ${accountId} is already linked to identity ${account.identityId}`,
      );
    }

    await this.prisma.platformAccount.update({
      where: { id: accountId },
      data: { identityId },
    });

    this.logger.log(`Linked account ${accountId} to identity ${identityId}`);

    return this.findOne(identityId);
  }

  async unlinkAccount(identityId: string, accountId: string): Promise<UserIdentityDto> {
    const identity = await this.prisma.userIdentity.findUnique({ where: { id: identityId } });
    if (!identity) {
      throw new NotFoundException(`Identity ${identityId} not found`);
    }

    const account = await this.prisma.platformAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (account.identityId !== identityId) {
      throw new BadRequestException(`Account ${accountId} is not linked to identity ${identityId}`);
    }

    await this.prisma.platformAccount.update({
      where: { id: accountId },
      data: { identityId: null },
    });

    this.logger.log(`Unlinked account ${accountId} from identity ${identityId}`);

    return this.findOne(identityId);
  }

  async createIdentity(displayName?: string, email?: string): Promise<UserIdentityDto> {
    const identity = await this.prisma.userIdentity.create({
      data: {
        telegramId: BigInt(0), // placeholder for non-telegram identities; will be removed in cleanup
        displayName,
        email,
      },
      include: { platformAccounts: true },
    });

    return this.mapToDto(identity);
  }

  private mapToDto(identity: any): UserIdentityDto {
    return {
      id: identity.id,
      displayName: identity.displayName ?? undefined,
      email: identity.email ?? undefined,
      platformAccounts: (identity.platformAccounts ?? []).map((a: any) => ({
        id: a.id,
        platform: a.platform,
        platformUserId: a.platformUserId,
        username: a.username ?? undefined,
        firstName: a.firstName ?? undefined,
        lastName: a.lastName ?? undefined,
        isBanned: a.isBanned,
        messageCount: a.messageCount,
        isVerified: a.isVerified,
        commandCount: a.commandCount ?? 0,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        metadata: a.metadata ?? undefined,
      })),
      createdAt: identity.firstSeenAt,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/Development/tg-allegro && pnpm api test -- --testPathPattern=identity.service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/identity/
git commit -m "feat(api): add IdentityService with account linking/unlinking"
```

---

### Task 1.5: Identity Module — Controllers and Module Wiring

**Files:**
- Create: `apps/api/src/identity/accounts.controller.ts`
- Create: `apps/api/src/identity/identity.controller.ts`
- Create: `apps/api/src/identity/identity.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/common/testing/prisma-mock.factory.ts`

- [ ] **Step 1: Create accounts controller**

Create `apps/api/src/identity/accounts.controller.ts`:

```typescript
import {
  Controller, Get, Put, Param, Query, Body,
  ParseIntPipe, DefaultValuePipe, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { PlatformAccountDto, PlatformAccountListResponseDto, AccountStatsDto, BanAccountDto } from './dto';

@ApiTags('accounts')
@Controller('api/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated platform accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isBanned', required: false, type: Boolean })
  @ApiQuery({ name: 'platform', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('isBanned') isBanned?: string,
    @Query('platform') platform?: string,
  ): Promise<PlatformAccountListResponseDto> {
    const parsedBanned = isBanned === 'true' ? true : isBanned === 'false' ? false : undefined;
    return this.accountsService.findAll(page, limit, search, parsedBanned, platform);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get account statistics' })
  async getStats(): Promise<AccountStatsDto> {
    return this.accountsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  async findOne(@Param('id') id: string): Promise<PlatformAccountDto> {
    return this.accountsService.findOne(id);
  }

  @Put(':id/ban')
  @ApiOperation({ summary: 'Ban or unban an account' })
  async setBanStatus(
    @Param('id') id: string,
    @Body() dto: BanAccountDto,
  ): Promise<PlatformAccountDto> {
    return this.accountsService.setBanStatus(id, dto.isBanned, dto.banReason);
  }
}
```

- [ ] **Step 2: Create identity controller**

Create `apps/api/src/identity/identity.controller.ts`:

```typescript
import {
  Controller, Get, Post, Delete, Param, Query, Body,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { UserIdentityDto, UserIdentityListResponseDto, LinkAccountDto } from './dto';

@ApiTags('identities')
@Controller('api/identities')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated identities with linked accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<UserIdentityListResponseDto> {
    return this.identityService.findAll(page, limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get identity by ID' })
  async findOne(@Param('id') id: string): Promise<UserIdentityDto> {
    return this.identityService.findOne(id);
  }

  @Post(':id/link')
  @ApiOperation({ summary: 'Link a platform account to this identity' })
  async linkAccount(
    @Param('id') id: string,
    @Body() dto: LinkAccountDto,
  ): Promise<UserIdentityDto> {
    return this.identityService.linkAccount(id, dto.platformAccountId);
  }

  @Delete(':id/link/:accountId')
  @ApiOperation({ summary: 'Unlink a platform account from this identity' })
  async unlinkAccount(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
  ): Promise<UserIdentityDto> {
    return this.identityService.unlinkAccount(id, accountId);
  }
}
```

- [ ] **Step 3: Create identity module**

Create `apps/api/src/identity/identity.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  controllers: [AccountsController, IdentityController],
  providers: [AccountsService, IdentityService],
  exports: [AccountsService, IdentityService],
})
export class IdentityModule {}
```

- [ ] **Step 4: Register IdentityModule in AppModule**

Modify `apps/api/src/app.module.ts`:

```typescript
import { IdentityModule } from './identity/identity.module';
// Add to imports array:
    IdentityModule,
```

- [ ] **Step 5: Update prisma-mock.factory.ts**

Add to `apps/api/src/common/testing/prisma-mock.factory.ts`:

```typescript
    platformAccount: createMockModel(),
```

(Add after the existing `userIdentity` line in `createMockPrismaService`.)

- [ ] **Step 6: Run all API tests to verify nothing is broken**

```bash
cd /root/Development/tg-allegro && pnpm api test
```

Expected: All existing tests + new tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/identity/ apps/api/src/app.module.ts apps/api/src/common/testing/prisma-mock.factory.ts
git commit -m "feat(api): add IdentityModule with accounts and identity controllers, wire into AppModule"
```

---

### Task 1.6: Migration Script — User → PlatformAccount + UserIdentity

**Files:**
- Create: `scripts/migrate-slice1-identity.ts`

- [ ] **Step 1: Write migration script**

Create `scripts/migrate-slice1-identity.ts`:

```typescript
/**
 * Slice 1 Migration: User → PlatformAccount + UserIdentity
 *
 * Reads all User records and creates:
 * 1. A UserIdentity (umbrella) for each user
 * 2. A PlatformAccount with platform="telegram" for each user
 *
 * Run: npx tsx scripts/migrate-slice1-identity.ts
 * Requires: DATABASE_URL environment variable
 */

import { PrismaClient } from '@flowbot/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Slice 1 migration: User → PlatformAccount + UserIdentity');

  const users = await prisma.user.findMany({
    include: { identity: true },
  });

  console.log(`Found ${users.length} users to migrate`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    // Check if PlatformAccount already exists for this telegramId
    const existing = await prisma.platformAccount.findUnique({
      where: {
        platform_platformUserId: {
          platform: 'telegram',
          platformUserId: user.telegramId.toString(),
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Resolve or create UserIdentity
    let identityId: string | null = null;

    if (user.identity) {
      // Update existing identity with new fields
      await prisma.userIdentity.update({
        where: { id: user.identity.id },
        data: {
          displayName: user.username ?? user.firstName ?? undefined,
        },
      });
      identityId = user.identity.id;
    } else {
      // Create new UserIdentity
      const identity = await prisma.userIdentity.create({
        data: {
          telegramId: user.telegramId,
          userId: user.id,
          displayName: user.username ?? user.firstName ?? null,
        },
      });
      identityId = identity.id;
    }

    // Resolve referredByAccountId (will be null for now, fixed in second pass)
    await prisma.platformAccount.create({
      data: {
        identityId,
        platform: 'telegram',
        platformUserId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        metadata: user.languageCode ? { languageCode: user.languageCode } : undefined,
        isBanned: user.isBanned,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
        messageCount: user.messageCount,
        commandCount: user.commandCount,
        isVerified: user.verifiedAt !== null,
        verifiedAt: user.verifiedAt,
        lastSeenAt: user.lastSeenAt,
        lastMessageAt: user.lastMessageAt,
        lastCommunityId: user.lastChatId?.toString() ?? null,
        referralCode: user.referralCode,
        // referredByAccountId resolved in second pass
      },
    });

    created++;
  }

  // Second pass: resolve referral links
  const usersWithReferrals = users.filter((u) => u.referredByUserId);
  let referralsLinked = 0;

  for (const user of usersWithReferrals) {
    const referrer = users.find((u) => u.id === user.referredByUserId);
    if (!referrer) continue;

    const referrerAccount = await prisma.platformAccount.findUnique({
      where: {
        platform_platformUserId: {
          platform: 'telegram',
          platformUserId: referrer.telegramId.toString(),
        },
      },
    });

    const userAccount = await prisma.platformAccount.findUnique({
      where: {
        platform_platformUserId: {
          platform: 'telegram',
          platformUserId: user.telegramId.toString(),
        },
      },
    });

    if (referrerAccount && userAccount) {
      await prisma.platformAccount.update({
        where: { id: userAccount.id },
        data: { referredByAccountId: referrerAccount.id },
      });
      referralsLinked++;
    }
  }

  console.log(`Migration complete: ${created} created, ${skipped} skipped, ${referralsLinked} referrals linked`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate-slice1-identity.ts
git commit -m "feat(scripts): add Slice 1 migration script — User to PlatformAccount + UserIdentity"
```

---

### Task 1.7: Frontend — Platform Context and Shared Components

**Files:**
- Create: `apps/frontend/src/lib/platform-context.tsx`
- Create: `apps/frontend/src/components/platform-badge.tsx`
- Create: `apps/frontend/src/components/platform-filter.tsx`

- [ ] **Step 1: Create platform context provider**

Create `apps/frontend/src/lib/platform-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Platform = "all" | "telegram" | "discord" | "slack" | "whatsapp" | "custom";

interface PlatformContextValue {
  platform: Platform;
  setPlatform: (p: Platform) => void;
  queryParam: string | undefined;
}

const PlatformContext = createContext<PlatformContextValue>({
  platform: "all",
  setPlatform: () => {},
  queryParam: undefined,
});

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatformState] = useState<Platform>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("flowbot-platform-filter") as Platform) || "all";
    }
    return "all";
  });

  const setPlatform = useCallback((p: Platform) => {
    setPlatformState(p);
    if (typeof window !== "undefined") {
      localStorage.setItem("flowbot-platform-filter", p);
    }
  }, []);

  const queryParam = platform === "all" ? undefined : platform;

  return (
    <PlatformContext.Provider value={{ platform, setPlatform, queryParam }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
```

- [ ] **Step 2: Create PlatformBadge component**

Create `apps/frontend/src/components/platform-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  telegram: { label: "Telegram", color: "bg-[#0088cc]/10 text-[#0088cc] border-[#0088cc]/20" },
  discord: { label: "Discord", color: "bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/20" },
  slack: { label: "Slack", color: "bg-[#4A154B]/10 text-[#4A154B] border-[#4A154B]/20" },
  whatsapp: { label: "WhatsApp", color: "bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20" },
  custom: { label: "Custom", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

interface PlatformBadgeProps {
  platform: string;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.custom;

  return (
    <Badge variant="outline" className={cn(config.color, className)}>
      {config.label}
    </Badge>
  );
}
```

- [ ] **Step 3: Create PlatformFilter component**

Create `apps/frontend/src/components/platform-filter.tsx`:

```tsx
"use client";

import { usePlatform, type Platform } from "@/lib/platform-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "all", label: "All" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
];

export function PlatformFilter() {
  const { platform, setPlatform } = usePlatform();

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      {PLATFORMS.map((p) => (
        <Button
          key={p.value}
          variant={platform === p.value ? "default" : "ghost"}
          size="sm"
          className={cn("h-7 px-3 text-xs")}
          onClick={() => setPlatform(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/platform-context.tsx apps/frontend/src/components/platform-badge.tsx apps/frontend/src/components/platform-filter.tsx
git commit -m "feat(frontend): add PlatformContext, PlatformBadge, and PlatformFilter components"
```

---

### Task 1.8: Frontend — API Client Updates and Identity Pages

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`
- Create: `apps/frontend/src/app/dashboard/identity/accounts/page.tsx`
- Create: `apps/frontend/src/app/dashboard/identity/accounts/loading.tsx`
- Create: `apps/frontend/src/app/dashboard/identity/linked/page.tsx`
- Create: `apps/frontend/src/app/dashboard/identity/linked/loading.tsx`

- [ ] **Step 1: Add identity/accounts API functions to api.ts**

Add these interfaces and functions to the end of `apps/frontend/src/lib/api.ts`:

```typescript
// Platform Account types
export interface PlatformAccount {
  id: string;
  platform: string;
  platformUserId: string;
  identityId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, unknown>;
  isBanned: boolean;
  bannedAt?: string;
  banReason?: string;
  messageCount: number;
  commandCount: number;
  isVerified: boolean;
  verifiedAt?: string;
  lastSeenAt?: string;
  lastMessageAt?: string;
  referralCode?: string;
  referredByAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserIdentity {
  id: string;
  displayName?: string;
  email?: string;
  platformAccounts: PlatformAccount[];
  createdAt: string;
}

// Platform Account API
export async function getAccounts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  platform?: string;
  isBanned?: boolean;
}): Promise<{ data: PlatformAccount[]; total: number; page: number; limit: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.isBanned !== undefined) searchParams.set("isBanned", String(params.isBanned));

  const res = await fetchApi(`/api/accounts?${searchParams}`);
  return res.json();
}

export async function getAccountStats(): Promise<{
  totalAccounts: number;
  activeAccounts: number;
  bannedAccounts: number;
  newAccountsToday: number;
  verifiedAccounts: number;
  totalMessages: number;
  totalCommands: number;
  platformBreakdown: Record<string, number>;
}> {
  const res = await fetchApi("/api/accounts/stats");
  return res.json();
}

export async function banAccount(id: string, isBanned: boolean, banReason?: string): Promise<PlatformAccount> {
  const res = await fetchApi(`/api/accounts/${id}/ban`, {
    method: "PUT",
    body: JSON.stringify({ isBanned, banReason }),
  });
  return res.json();
}

// Identity API
export async function getIdentities(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ data: UserIdentity[]; total: number; page: number; limit: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);

  const res = await fetchApi(`/api/identities?${searchParams}`);
  return res.json();
}

export async function linkAccount(identityId: string, platformAccountId: string): Promise<UserIdentity> {
  const res = await fetchApi(`/api/identities/${identityId}/link`, {
    method: "POST",
    body: JSON.stringify({ platformAccountId }),
  });
  return res.json();
}

export async function unlinkAccount(identityId: string, accountId: string): Promise<UserIdentity> {
  const res = await fetchApi(`/api/identities/${identityId}/link/${accountId}`, {
    method: "DELETE",
  });
  return res.json();
}
```

- [ ] **Step 2: Create Accounts page**

Create `apps/frontend/src/app/dashboard/identity/accounts/page.tsx` — a list page showing all PlatformAccounts with platform badge, search, and pagination. Follow the pattern from `apps/frontend/src/app/dashboard/users/page.tsx` but use `getAccounts` API and show `PlatformBadge` in each row. Include columns: Platform, Username, Display Name, Messages, Status, Created.

- [ ] **Step 3: Create Accounts loading page**

Create `apps/frontend/src/app/dashboard/identity/accounts/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Linked Identities page**

Create `apps/frontend/src/app/dashboard/identity/linked/page.tsx` — shows UserIdentity records with expandable rows listing their linked PlatformAccounts. Include link/unlink buttons. Use `getIdentities` API.

- [ ] **Step 5: Create Linked Identities loading page**

Create `apps/frontend/src/app/dashboard/identity/linked/loading.tsx` (same skeleton pattern).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/lib/api.ts apps/frontend/src/app/dashboard/identity/
git commit -m "feat(frontend): add Identity pages — Accounts list and Linked Identities with API integration"
```

---

### Task 1.9: Frontend — Update Sidebar Navigation

**Files:**
- Modify: `apps/frontend/src/components/sidebar.tsx`

- [ ] **Step 1: Update sidebar nav to add Identity section and PlatformFilter**

In `apps/frontend/src/components/sidebar.tsx`:

1. Add "Identity" section with children: "Accounts" (`/dashboard/identity/accounts`) and "Linked Identities" (`/dashboard/identity/linked`)
2. Add `<PlatformFilter />` component near the top of the sidebar, below the logo
3. Import `PlatformFilter` from `@/components/platform-filter`

Follow the existing `NavSection` pattern. Use `Users` icon for Accounts, `Layers` icon for Linked Identities.

- [ ] **Step 2: Verify frontend builds**

```bash
cd /root/Development/tg-allegro && pnpm frontend build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/sidebar.tsx
git commit -m "feat(frontend): add Identity section and PlatformFilter to sidebar navigation"
```

---

## Slice 2: Communities + Moderation

> **Prerequisite:** Slice 1 must be complete (PlatformAccount model exists).

### Task 2.1: Add Community Prisma Models

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add Community, CommunityConfig, CommunityTelegramConfig, CommunityDiscordConfig, CommunityMember models**

Add after PlatformAccount model. Refer to spec Section 2 for exact fields. Include all CommunityConfig fields from the spec (rulesText, antiSpam*, antiLink*, warnThreshold*, keyword*, aiMod*, pipeline*, etc.). Include `botInstanceId` as optional FK to BotInstance. Add `@@unique([platform, platformCommunityId])` on Community.

- [ ] **Step 2: Run prisma generate and build**

```bash
cd /root/Development/tg-allegro && pnpm db generate && pnpm db build
```

- [ ] **Step 3: Push schema**

```bash
cd /root/Development/tg-allegro && pnpm db prisma:push
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): add Community, CommunityConfig, CommunityMember, and platform-specific config models"
```

---

### Task 2.2: Communities Service and Controller

**Files:**
- Create: `apps/api/src/communities/` (module, service, controller, DTOs, strategies)

- [ ] **Step 1: Write communities service test** — CRUD for communities with platform filtering, config management. Follow pattern from `groups.service.spec.ts`.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement CommunitiesService** — findAll (with platform filter), findOne (include config + platform config), create, update config, deactivate. Include `getTelegramConfig()` and `getDiscordConfig()` helpers.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Write members service test** — CRUD for CommunityMember with platform awareness.

- [ ] **Step 6: Implement MembersService**

- [ ] **Step 7: Create DTOs** — community.dto.ts, community-config.dto.ts, community-member.dto.ts, index.ts

- [ ] **Step 8: Create controllers** — communities.controller.ts (`/api/communities`), members.controller.ts (`/api/communities/:id/members`)

- [ ] **Step 9: Create platform strategies** — `telegram-community.strategy.ts`, `discord-community.strategy.ts` implementing `IModerationStrategy`. Register in module via `onModuleInit`.

- [ ] **Step 10: Create CommunitiesModule, wire into AppModule**

- [ ] **Step 11: Run all API tests**

- [ ] **Step 12: Commit**

---

### Task 2.3: Re-point Warnings and Logs to Community/PlatformAccount

**Files:**
- Modify: `apps/api/src/moderation/warnings/warnings.service.ts`
- Modify: `apps/api/src/moderation/warnings/warnings.controller.ts`
- Modify: `apps/api/src/moderation/logs/logs.service.ts`
- Modify: `apps/api/src/moderation/logs/logs.controller.ts`
- Modify: `apps/api/src/moderation/scheduled-messages/scheduled-messages.service.ts`

- [ ] **Step 1: Update warnings service** — query Warning via communityId + memberId (CommunityMember FK) instead of groupId + GroupMember FK. Update create/findAll/deactivate methods.

- [ ] **Step 2: Update warnings controller** — route changes: `/api/communities/:communityId/warnings`

- [ ] **Step 3: Update logs service** — query ModerationLog via communityId + actorAccountId/targetAccountId

- [ ] **Step 4: Update logs controller** — route: `/api/communities/:communityId/logs`

- [ ] **Step 5: Update scheduled-messages service** — use communityId, createdByAccountId, content JSON

- [ ] **Step 6: Run all API tests, fix any breakage**

- [ ] **Step 7: Commit**

---

### Task 2.4: Migration Script and Frontend — Communities

**Files:**
- Create: `scripts/migrate-slice2-communities.ts`
- Create: `apps/frontend/src/app/dashboard/communities/` (pages)
- Modify: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/src/components/sidebar.tsx`

- [ ] **Step 1: Write migration script** — ManagedGroup → Community, GroupConfig → CommunityConfig + CommunityTelegramConfig, GroupMember → CommunityMember. Resolve botInstanceId per spec.

- [ ] **Step 2: Add communities API functions to frontend api.ts**

- [ ] **Step 3: Create Communities list page** (`/dashboard/communities`) — with PlatformBadge, search, platform filter

- [ ] **Step 4: Create Community detail page** (`/dashboard/communities/[id]`) — tabs: General Config, Platform-Specific Config (rendered based on community.platform)

- [ ] **Step 5: Create Members page** (`/dashboard/communities/[id]/members`)

- [ ] **Step 6: Create Warnings page** (`/dashboard/communities/[id]/warnings`)

- [ ] **Step 7: Update sidebar** — replace "Moderation > Groups" with "Communities"

- [ ] **Step 8: Commit**

---

## Slice 3: Connections

> **Prerequisite:** Slice 1 complete.

### Task 3.1: Add PlatformConnection Prisma Models

- [ ] **Step 1: Add PlatformConnection and PlatformConnectionLog to schema.prisma** — per spec Section 3

- [ ] **Step 2: Generate and push**

- [ ] **Step 3: Commit**

---

### Task 3.2: Connections Service and Controller

- [ ] **Step 1: Write connections service test** — CRUD, auth flow state machine, health check

- [ ] **Step 2: Implement ConnectionsService** — findAll (platform filter), findOne, create, updateStatus, startAuth, submitAuthStep, getHealth

- [ ] **Step 3: Create auth strategies** — `telegram-mtproto.strategy.ts` (wraps existing TgClient auth flow), `discord-oauth.strategy.ts`

- [ ] **Step 4: Create DTOs, controller, module**

- [ ] **Step 5: Wire into AppModule**

- [ ] **Step 6: Run tests**

- [ ] **Step 7: Commit**

---

### Task 3.3: Migration Script and Frontend — Connections

- [ ] **Step 1: Write migration script** — ClientSession → PlatformConnection, ClientLog → PlatformConnectionLog (with legacy connection for orphan logs)

- [ ] **Step 2: Add connections API functions to frontend api.ts**

- [ ] **Step 3: Create Connections pages** — overview, auth wizard (platform selector → platform-specific form), health

- [ ] **Step 4: Update sidebar** — replace "TG Client" with "Connections"

- [ ] **Step 5: Commit**

---

## Slice 4: Broadcast + Cross-post

> **Prerequisite:** Slice 2 complete (Communities exist).

### Task 4.1: Update Broadcast Models and Service

- [ ] **Step 1: Update BroadcastMessage schema** — add `content` Json, `platforms` String[], `targetCommunities` String[]. Keep old fields temporarily.

- [ ] **Step 2: Update BroadcastService** — accept platforms[], targetCommunities[]. Group by platform for dispatch.

- [ ] **Step 3: Update BroadcastController and DTOs**

- [ ] **Step 4: Update CrossPostTemplate schema** — add content Json, targetCommunities, platforms, isActive, createdByAccountId

- [ ] **Step 5: Update CrossPostService** — re-point to Community IDs

- [ ] **Step 6: Update Trigger.dev broadcast task** (`apps/trigger/src/trigger/broadcast.ts`) — group targetCommunities by platform, resolve BotInstance per community, dispatch via HTTP to each bot

- [ ] **Step 7: Update Trigger.dev cross-post task** — same pattern

- [ ] **Step 8: Run tests (API + Trigger)**

- [ ] **Step 9: Write migration script** — targetChatIds → targetCommunities, text → content

- [ ] **Step 10: Update frontend broadcast page** — platform multi-select, community picker

- [ ] **Step 11: Commit**

---

## Slice 5: Reputation + Analytics

> **Prerequisite:** Slices 1 + 2 complete.

### Task 5.1: Update Reputation

- [ ] **Step 1: Update ReputationScore schema** — FK to PlatformAccount instead of telegramId. Add optional communityId.

- [ ] **Step 2: Update ReputationService** — query by accountId. Add cross-platform aggregation at UserIdentity level.

- [ ] **Step 3: Update ReputationController** — routes: `/api/reputation/account/:accountId`, `/api/reputation/identity/:identityId`

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

### Task 5.2: Update Analytics

- [ ] **Step 1: Add CommunityAnalyticsSnapshot to schema** — communityId FK, granularity, metadata Json for overflow counters

- [ ] **Step 2: Update AnalyticsService** — query Community instead of ManagedGroup

- [ ] **Step 3: Update AnalyticsController** — routes: `/api/analytics/communities/:id`

- [ ] **Step 4: Update Trigger.dev analytics-snapshot task** — query Community

- [ ] **Step 5: Write migration script** — re-link existing snapshots to Communities

- [ ] **Step 6: Update frontend analytics page**

- [ ] **Step 7: Commit**

---

## Slice 6: Trigger.dev + Bot Integration

> **Prerequisite:** All previous slices complete.

### Task 6.1: Update Flow Dispatcher to Data-Driven Routing

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`

- [ ] **Step 1: Update dispatcher** — remove prefix-based routing. Resolve platform from Community → BotInstance. Route all actions via `{botInstance.apiUrl}/api/execute-action`.

- [ ] **Step 2: Update flow-execution task** — pass Community context to dispatcher

- [ ] **Step 3: Update existing dispatcher tests** — verify data-driven routing

- [ ] **Step 4: Run Trigger tests**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

- [ ] **Step 5: Commit**

### Task 6.2: Standardize Bot HTTP API Contract

- [ ] **Step 1: Update manager-bot execute-action handler** — accept standardized `ExecuteActionRequest` (no platform prefix on action names)

- [ ] **Step 2: Update discord-bot execute-action handler** — same standardized contract

- [ ] **Step 3: Add bot heartbeat endpoint** — `POST /api/bot-config/instances/:id/heartbeat` in API

- [ ] **Step 4: Add heartbeat call on bot startup** — both manager-bot and discord-bot

- [ ] **Step 5: Standardize FlowTriggerEvent** — both event forwarders emit identical structure

- [ ] **Step 6: Commit**

### Task 6.3: Update FlowDefinition.transportConfig

- [ ] **Step 1: Simplify transportConfig** — drop `discordBotInstanceId`, resolve from Community. Keep `botInstanceId` as optional override.

- [ ] **Step 2: Update flow editor frontend** — remove discordBotInstanceId from transport config UI

- [ ] **Step 3: Run all tests (API + Trigger)**

- [ ] **Step 4: Commit**

---

## Slice 7: Frontend Polish + Cleanup

> **Prerequisite:** All previous slices working.

### Task 7.1: Remove Deprecated Routes and Modules

- [ ] **Step 1: Remove old frontend routes** — delete `apps/frontend/src/app/dashboard/users/` (replaced by identity/accounts), delete `apps/frontend/src/app/dashboard/tg-client/` (replaced by connections), delete `apps/frontend/src/app/dashboard/moderation/groups/` (replaced by communities)

- [ ] **Step 2: Remove old API modules** — remove `UsersModule` import from AppModule (replaced by IdentityModule), remove `TgClientModule` import (replaced by ConnectionsModule). Keep the old module files for one more release, but disconnect them from the app.

- [ ] **Step 3: Update sidebar** — remove any remaining old nav entries

- [ ] **Step 4: Update frontend layout.tsx** — change description from "Telegram bot dashboard" to "Multi-platform bot dashboard"

- [ ] **Step 5: Verify frontend builds**

- [ ] **Step 6: Commit**

### Task 7.2: Write Cleanup Migration — Drop Old Tables

- [ ] **Step 1: Write cleanup migration script** (`scripts/migrate-slice7-cleanup.ts`) — verifies all data is migrated, then documents which old tables/columns can be dropped in a future Prisma migration

- [ ] **Step 2: Update prisma-mock.factory.ts** — add all new model mocks, keep old ones for backward compat tests

- [ ] **Step 3: Run full test suite**

```bash
cd /root/Development/tg-allegro && pnpm api test && pnpm trigger test && pnpm manager-bot test && pnpm telegram-transport test
```

- [ ] **Step 4: Final commit**

```bash
git commit -m "chore: Slice 7 cleanup — remove deprecated routes, update descriptions, finalize migration"
```

---

## Summary

| Slice | Tasks | Est. Commits | Key Deliverables |
|-------|-------|-------------|------------------|
| 1 | 9 | 9 | PlatformAccount model, PlatformModule, IdentityModule, frontend identity pages, platform filter |
| 2 | 4 | 4 | Community models, CommunitiesModule, re-pointed warnings/logs, frontend communities pages |
| 3 | 3 | 3 | PlatformConnection model, ConnectionsModule, frontend connections pages |
| 4 | 1 | 1 | Multi-platform broadcast/crosspost, updated Trigger tasks |
| 5 | 2 | 2 | Re-pointed reputation/analytics, cross-platform aggregation |
| 6 | 3 | 3 | Data-driven dispatcher, standardized bot contract, heartbeat |
| 7 | 2 | 2 | Cleanup deprecated code, drop old routes |
| **Total** | **24** | **24** | |
