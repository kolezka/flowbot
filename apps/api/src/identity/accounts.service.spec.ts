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
    groupBy: jest.fn(),
    upsert: jest.fn(),
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
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.data[0]?.id).toBe('acc-1');
      expect(prisma.platformAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter by platform', async () => {
      prisma.platformAccount.findMany.mockResolvedValue([]);
      prisma.platformAccount.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, undefined, 'telegram');

      expect(prisma.platformAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { platform: 'telegram' },
        }),
      );
    });

    it('should filter by search (username contains, case-insensitive)', async () => {
      prisma.platformAccount.findMany.mockResolvedValue([]);
      prisma.platformAccount.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'testuser');

      expect(prisma.platformAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            username: { contains: 'testuser', mode: 'insensitive' },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return account by ID', async () => {
      prisma.platformAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.findOne('acc-1');

      expect(result.id).toBe('acc-1');
      expect(result.platform).toBe('telegram');
      expect(result.platformUserId).toBe('12345');
      expect(result.username).toBe('testuser');
      expect(prisma.platformAccount.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
    });

    it('should throw NotFoundException for non-existent account', async () => {
      prisma.platformAccount.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setBanStatus', () => {
    it('should ban an account', async () => {
      prisma.platformAccount.findUnique.mockResolvedValue(mockAccount);
      const bannedAccount = {
        ...mockAccount,
        isBanned: true,
        bannedAt: new Date(),
        banReason: 'spam',
      };
      prisma.platformAccount.update.mockResolvedValue(bannedAccount);

      const result = await service.setBanStatus('acc-1', true, 'spam');

      expect(result.isBanned).toBe(true);
      expect(result.banReason).toBe('spam');
      expect(prisma.platformAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: expect.objectContaining({
          isBanned: true,
          banReason: 'spam',
        }),
      });
    });

    it('should throw NotFoundException for non-existent account', async () => {
      prisma.platformAccount.findUnique.mockResolvedValue(null);

      await expect(service.setBanStatus('nonexistent', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return stats with platform breakdown', async () => {
      prisma.platformAccount.count
        .mockResolvedValueOnce(200)   // totalAccounts
        .mockResolvedValueOnce(80)    // activeAccounts
        .mockResolvedValueOnce(10)    // bannedAccounts
        .mockResolvedValueOnce(5)     // newAccountsToday
        .mockResolvedValueOnce(150);  // verifiedAccounts

      prisma.platformAccount.aggregate.mockResolvedValue({
        _sum: { messageCount: 10000, commandCount: 500 },
      });

      prisma.platformAccount.groupBy.mockResolvedValue([
        { platform: 'telegram', _count: { id: 180 } },
        { platform: 'discord', _count: { id: 20 } },
      ]);

      const result = await service.getStats();

      expect(result.totalAccounts).toBe(200);
      expect(result.activeAccounts).toBe(80);
      expect(result.bannedAccounts).toBe(10);
      expect(result.newAccountsToday).toBe(5);
      expect(result.verifiedAccounts).toBe(150);
      expect(result.totalMessages).toBe(10000);
      expect(result.totalCommands).toBe(500);
      expect(result.platformBreakdown).toEqual({ telegram: 180, discord: 20 });
    });

    it('should handle null aggregate sums', async () => {
      prisma.platformAccount.count.mockResolvedValue(0);
      prisma.platformAccount.aggregate.mockResolvedValue({
        _sum: { messageCount: null, commandCount: null },
      });
      prisma.platformAccount.groupBy.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.totalMessages).toBe(0);
      expect(result.totalCommands).toBe(0);
      expect(result.platformBreakdown).toEqual({});
    });
  });
});
