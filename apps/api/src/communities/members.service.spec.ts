import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MembersService } from './members.service';
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

describe('MembersService', () => {
  let service: MembersService;
  let prisma: Record<string, any>;

  const mockPlatformAccount = {
    id: 'account-1',
    platform: 'telegram',
    platformUserId: '12345',
    username: 'testuser',
    displayName: 'Test User',
  };

  const mockMember = {
    id: 'member-1',
    communityId: 'community-1',
    platformAccountId: 'account-1',
    platformAccount: mockPlatformAccount,
    role: 'member',
    messageCount: 50,
    joinedAt: new Date('2026-01-01'),
    warningCount: 0,
    isMuted: false,
    muteExpiresAt: null,
    isQuarantined: false,
    quarantineExpiresAt: null,
    lastSeenAt: new Date('2026-03-01'),
    metadata: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      community: createMockModel(),
      communityMember: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  describe('findAll', () => {
    it('should return paginated members with account info', async () => {
      prisma.communityMember.findMany.mockResolvedValue([mockMember]);
      prisma.communityMember.count.mockResolvedValue(1);

      const result = await service.findAll('community-1', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.data[0].id).toBe('member-1');
      expect(result.data[0].platform).toBe('telegram');
      expect(result.data[0].username).toBe('testuser');
    });

    it('should filter by role', async () => {
      prisma.communityMember.findMany.mockResolvedValue([]);
      prisma.communityMember.count.mockResolvedValue(0);

      await service.findAll('community-1', 1, 20, undefined, 'admin');

      expect(prisma.communityMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'admin' }),
        }),
      );
    });

    it('should include platformAccount in query', async () => {
      prisma.communityMember.findMany.mockResolvedValue([]);
      prisma.communityMember.count.mockResolvedValue(0);

      await service.findAll('community-1', 1, 20);

      expect(prisma.communityMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            platformAccount: true,
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.communityMember.findMany.mockResolvedValue([]);
      prisma.communityMember.count.mockResolvedValue(50);

      const result = await service.findAll('community-1', 3, 10);

      expect(result.totalPages).toBe(5);
      expect(prisma.communityMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return member with account info', async () => {
      prisma.communityMember.findFirst.mockResolvedValue(mockMember);

      const result = await service.findOne('community-1', 'member-1');

      expect(result.id).toBe('member-1');
      expect(result.communityId).toBe('community-1');
      expect(result.platform).toBe('telegram');
      expect(result.username).toBe('testuser');
    });

    it('should throw NotFoundException for non-existent member', async () => {
      prisma.communityMember.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('community-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('should update the member role', async () => {
      prisma.communityMember.findFirst.mockResolvedValue(mockMember);
      prisma.communityMember.update.mockResolvedValue({
        ...mockMember,
        role: 'admin',
      });

      const result = await service.updateRole('community-1', 'member-1', 'admin');

      expect(result.role).toBe('admin');
      expect(prisma.communityMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { role: 'admin' },
        include: { platformAccount: true },
      });
    });

    it('should throw NotFoundException for non-existent member', async () => {
      prisma.communityMember.findFirst.mockResolvedValue(null);

      await expect(
        service.updateRole('community-1', 'nonexistent', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
