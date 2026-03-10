import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
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

describe('UsersService', () => {
  let service: UsersService;
  let prisma: Record<string, any>;

  const mockUser = {
    id: 'user-1',
    telegramId: BigInt(12345),
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    languageCode: 'en',
    lastChatId: BigInt(99999),
    lastSeenAt: new Date('2026-03-01'),
    lastMessageAt: new Date('2026-03-01'),
    verifiedAt: new Date('2026-02-01'),
    isBanned: false,
    bannedAt: null,
    banReason: null,
    messageCount: 100,
    commandCount: 10,
    referralCode: 'REF123',
    referredByUserId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      user: createMockModel(),
      userIdentity: createMockModel(),
      groupMember: createMockModel(),
      moderationLog: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.data[0].telegramId).toBe('12345');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should handle search filter', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'testuser');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            username: { contains: 'testuser', mode: 'insensitive' },
          },
        }),
      );
    });

    it('should handle isBanned filter', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, true);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isBanned: true },
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(45);

      const result = await service.findAll(1, 20);

      expect(result.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(result.id).toBe('user-1');
      expect(result.telegramId).toBe('12345');
      expect(result.username).toBe('testuser');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      prisma.user.count
        .mockResolvedValueOnce(100)  // totalUsers
        .mockResolvedValueOnce(50)   // activeUsers
        .mockResolvedValueOnce(5)    // bannedUsers
        .mockResolvedValueOnce(3)    // newUsersToday
        .mockResolvedValueOnce(80);  // verifiedUsers

      prisma.user.aggregate.mockResolvedValue({
        _sum: { messageCount: 5000, commandCount: 200 },
      });

      const result = await service.getStats();

      expect(result.totalUsers).toBe(100);
      expect(result.activeUsers).toBe(50);
      expect(result.bannedUsers).toBe(5);
      expect(result.newUsersToday).toBe(3);
      expect(result.verifiedUsers).toBe(80);
      expect(result.totalMessages).toBe(5000);
      expect(result.totalCommands).toBe(200);
    });

    it('should handle null aggregate sums', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.aggregate.mockResolvedValue({
        _sum: { messageCount: null, commandCount: null },
      });

      const result = await service.getStats();

      expect(result.totalMessages).toBe(0);
      expect(result.totalCommands).toBe(0);
    });
  });

  describe('setBanStatus', () => {
    it('should ban a user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const bannedUser = {
        ...mockUser,
        isBanned: true,
        bannedAt: new Date(),
        banReason: 'spam',
      };
      prisma.user.update.mockResolvedValue(bannedUser);

      const result = await service.setBanStatus('user-1', true, 'spam');

      expect(result.isBanned).toBe(true);
      expect(result.banReason).toBe('spam');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          isBanned: true,
          banReason: 'spam',
        }),
      });
    });

    it('should unban a user', async () => {
      const bannedUser = { ...mockUser, isBanned: true, bannedAt: new Date(), banReason: 'spam' };
      prisma.user.findUnique.mockResolvedValue(bannedUser);
      const unbannedUser = { ...mockUser, isBanned: false, bannedAt: null, banReason: null };
      prisma.user.update.mockResolvedValue(unbannedUser);

      const result = await service.setBanStatus('user-1', false);

      expect(result.isBanned).toBe(false);
      expect(result.banReason).toBeNull();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          isBanned: false,
          bannedAt: null,
          banReason: null,
        }),
      });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.setBanStatus('nonexistent', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUnifiedProfile', () => {
    it('should return profile data when identity exists', async () => {
      const identity = {
        telegramId: BigInt(12345),
        reputationScore: 85,
        firstSeenAt: new Date('2026-01-01'),
        user: mockUser,
      };

      prisma.userIdentity.findUnique.mockResolvedValue(identity);
      prisma.groupMember.findMany.mockResolvedValue([]);
      prisma.moderationLog.findMany.mockResolvedValue([]);

      const result = await service.getUnifiedProfile('12345');

      expect(result.telegramId).toBe('12345');
      expect(result.reputationScore).toBe(85);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-1');
      expect(result.memberships).toEqual([]);
      expect(result.moderationLogs).toEqual([]);
    });

    it('should create identity if not exists and user found', async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      const createdIdentity = {
        telegramId: BigInt(12345),
        reputationScore: 0,
        firstSeenAt: new Date(),
        user: mockUser,
      };
      prisma.userIdentity.create.mockResolvedValue(createdIdentity);
      prisma.groupMember.findMany.mockResolvedValue([]);
      prisma.moderationLog.findMany.mockResolvedValue([]);

      const result = await service.getUnifiedProfile('12345');

      expect(result.telegramId).toBe('12345');
      expect(prisma.userIdentity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telegramId: BigInt(12345),
            userId: 'user-1',
          }),
        }),
      );
    });

    it('should create identity without userId if user not found', async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const createdIdentity = {
        telegramId: BigInt(12345),
        reputationScore: 0,
        firstSeenAt: new Date(),
        user: null,
      };
      prisma.userIdentity.create.mockResolvedValue(createdIdentity);
      prisma.groupMember.findMany.mockResolvedValue([]);
      prisma.moderationLog.findMany.mockResolvedValue([]);

      const result = await service.getUnifiedProfile('12345');

      expect(result.telegramId).toBe('12345');
      expect(result.user).toBeUndefined();
      expect(prisma.userIdentity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telegramId: BigInt(12345),
            userId: undefined,
          }),
        }),
      );
    });

    it('should include memberships with active warnings', async () => {
      const identity = {
        telegramId: BigInt(12345),
        reputationScore: 50,
        firstSeenAt: new Date(),
        user: null,
      };
      prisma.userIdentity.findUnique.mockResolvedValue(identity);

      const membership = {
        group: { id: 'group-1', chatId: BigInt(67890), title: 'Test Group' },
        role: 'member',
        joinedAt: new Date(),
        messageCount: 10,
        lastSeenAt: new Date(),
        warnings: [
          {
            id: 'warn-1',
            reason: 'spam',
            issuerId: BigInt(11111),
            isActive: true,
            expiresAt: null,
            createdAt: new Date(),
          },
        ],
      };
      prisma.groupMember.findMany.mockResolvedValue([membership]);
      prisma.moderationLog.findMany.mockResolvedValue([]);

      const result = await service.getUnifiedProfile('12345');

      expect(result.memberships).toHaveLength(1);
      expect(result.memberships[0].chatId).toBe('67890');
      expect(result.memberships[0].activeWarnings).toHaveLength(1);
      expect(result.memberships[0].activeWarnings[0].issuerId).toBe('11111');
    });
  });
});
