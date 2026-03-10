import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MembersService } from './members.service';
import { PrismaService } from '../../prisma/prisma.service';

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

  const mockGroup = {
    id: 'group-1',
    chatId: BigInt(123456789),
    title: 'Test Group',
    isActive: true,
  };

  const mockMember = {
    id: 'member-1',
    groupId: 'group-1',
    telegramId: BigInt(22222),
    role: 'member',
    joinedAt: new Date('2026-01-15'),
    messageCount: 42,
    lastSeenAt: new Date('2026-03-01'),
    isQuarantined: false,
    quarantineExpiresAt: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockWarning = {
    id: 'warn-1',
    issuerId: BigInt(11111),
    reason: 'Spamming',
    isActive: true,
    expiresAt: null,
    createdAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      managedGroup: createMockModel(),
      groupMember: createMockModel(),
      moderationLog: createMockModel(),
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
    it('should return paginated members for a group', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.groupMember.findMany.mockResolvedValue([mockMember]);
      prisma.groupMember.count.mockResolvedValue(1);

      const result = await service.findAll('group-1', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].telegramId).toBe('22222');
    });

    it('should throw NotFoundException for non-existent group', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(null);

      await expect(service.findAll('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should filter by role', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.groupMember.findMany.mockResolvedValue([]);
      prisma.groupMember.count.mockResolvedValue(0);

      await service.findAll('group-1', 1, 20, 'admin');

      expect(prisma.groupMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'admin' }),
        }),
      );
    });

    it('should filter by isQuarantined', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.groupMember.findMany.mockResolvedValue([]);
      prisma.groupMember.count.mockResolvedValue(0);

      await service.findAll('group-1', 1, 20, undefined, true);

      expect(prisma.groupMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isQuarantined: true }),
        }),
      );
    });

    it('should handle pagination', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.groupMember.findMany.mockResolvedValue([]);
      prisma.groupMember.count.mockResolvedValue(50);

      const result = await service.findAll('group-1', 3, 10);

      expect(result.totalPages).toBe(5);
      expect(prisma.groupMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return member detail with warnings', async () => {
      const memberWithWarnings = {
        ...mockMember,
        warnings: [mockWarning],
      };
      prisma.groupMember.findFirst.mockResolvedValue(memberWithWarnings);

      const result = await service.findOne('group-1', 'member-1');

      expect(result.id).toBe('member-1');
      expect(result.telegramId).toBe('22222');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].issuerId).toBe('11111');
      expect(result.warnings[0].reason).toBe('Spamming');
    });

    it('should throw NotFoundException for non-existent member', async () => {
      prisma.groupMember.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('group-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('releaseMember', () => {
    it('should release a quarantined member', async () => {
      const quarantinedMember = {
        ...mockMember,
        isQuarantined: true,
        quarantineExpiresAt: new Date('2026-04-01'),
      };
      prisma.groupMember.findFirst.mockResolvedValue(quarantinedMember);
      prisma.groupMember.update.mockResolvedValue({
        ...mockMember,
        isQuarantined: false,
        quarantineExpiresAt: null,
      });
      prisma.moderationLog.create.mockResolvedValue({});

      const result = await service.releaseMember('group-1', 'member-1');

      expect(result.isQuarantined).toBe(false);
      expect(prisma.groupMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { isQuarantined: false, quarantineExpiresAt: null },
      });
      expect(prisma.moderationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          groupId: 'group-1',
          action: 'quarantine_release',
          targetId: BigInt(22222),
        }),
      });
    });

    it('should throw NotFoundException for non-existent member', async () => {
      prisma.groupMember.findFirst.mockResolvedValue(null);

      await expect(
        service.releaseMember('group-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if member is not quarantined', async () => {
      prisma.groupMember.findFirst.mockResolvedValue(mockMember); // isQuarantined = false

      await expect(
        service.releaseMember('group-1', 'member-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
