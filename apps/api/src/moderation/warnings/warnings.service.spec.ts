import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WarningsService } from './warnings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

const mockEventBus = {
  emitModeration: jest.fn(),
  emitSystem: jest.fn(),
};

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

describe('WarningsService', () => {
  let service: WarningsService;
  let prisma: Record<string, any>;

  const mockWarning = {
    id: 'warn-1',
    groupId: 'group-1',
    memberId: 'member-1',
    issuerId: BigInt(11111),
    reason: 'Spamming',
    isActive: true,
    expiresAt: new Date('2026-04-01'),
    createdAt: new Date('2026-03-01'),
    group: { title: 'Test Group' },
  };

  beforeEach(async () => {
    prisma = {
      warning: createMockModel(),
      managedGroup: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarningsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<WarningsService>(WarningsService);
  });

  describe('findAll', () => {
    it('should return paginated warnings', async () => {
      prisma.warning.findMany.mockResolvedValue([mockWarning]);
      prisma.warning.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].issuerId).toBe('11111');
      expect(result.data[0].groupTitle).toBe('Test Group');
    });

    it('should filter by groupId', async () => {
      prisma.warning.findMany.mockResolvedValue([]);
      prisma.warning.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'group-1');

      expect(prisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: 'group-1' }),
        }),
      );
    });

    it('should filter by memberId', async () => {
      prisma.warning.findMany.mockResolvedValue([]);
      prisma.warning.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, 'member-1');

      expect(prisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ memberId: 'member-1' }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      prisma.warning.findMany.mockResolvedValue([]);
      prisma.warning.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, undefined, true);

      expect(prisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should handle pagination', async () => {
      prisma.warning.findMany.mockResolvedValue([]);
      prisma.warning.count.mockResolvedValue(45);

      const result = await service.findAll(2, 20);

      expect(result.totalPages).toBe(3);
      expect(prisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate a warning', async () => {
      prisma.warning.findUnique.mockResolvedValue(mockWarning);
      const deactivated = { ...mockWarning, isActive: false };
      prisma.warning.update.mockResolvedValue(deactivated);

      const result = await service.deactivate('warn-1');

      expect(result.isActive).toBe(false);
      expect(prisma.warning.update).toHaveBeenCalledWith({
        where: { id: 'warn-1' },
        data: { isActive: false },
        include: { group: { select: { title: true } } },
      });
    });

    it('should throw NotFoundException for non-existent warning', async () => {
      prisma.warning.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return correct warning statistics', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 86400000); // tomorrow
      const pastDate = new Date(now.getTime() - 86400000); // yesterday

      prisma.warning.findMany.mockResolvedValue([
        // Active warning (not expired)
        { isActive: true, expiresAt: futureDate, groupId: 'group-1' },
        // Active warning (no expiry)
        { isActive: true, expiresAt: null, groupId: 'group-1' },
        // Deactivated warning
        { isActive: false, expiresAt: null, groupId: 'group-1' },
        // Expired warning (isActive true but expired)
        { isActive: true, expiresAt: pastDate, groupId: 'group-2' },
      ]);

      prisma.managedGroup.findMany.mockResolvedValue([
        { id: 'group-1', title: 'Group One' },
        { id: 'group-2', title: 'Group Two' },
      ]);

      const result = await service.getStats();

      expect(result.totalActive).toBe(2);
      expect(result.totalDeactivated).toBe(1);
      expect(result.totalExpired).toBe(1);
      expect(result.countsByGroup).toHaveLength(2);

      const group1Stats = result.countsByGroup.find(
        (g) => g.groupId === 'group-1',
      );
      expect(group1Stats.activeCount).toBe(2);
      expect(group1Stats.totalCount).toBe(3);
      expect(group1Stats.groupTitle).toBe('Group One');

      const group2Stats = result.countsByGroup.find(
        (g) => g.groupId === 'group-2',
      );
      expect(group2Stats.activeCount).toBe(0);
      expect(group2Stats.totalCount).toBe(1);
    });
  });
});
