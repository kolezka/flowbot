import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GroupsService } from './groups.service';
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

describe('GroupsService', () => {
  let service: GroupsService;
  let prisma: Record<string, any>;

  const mockGroup = {
    id: 'group-1',
    chatId: BigInt(123456789),
    title: 'Test Group',
    isActive: true,
    joinedAt: new Date('2026-01-01'),
    leftAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockConfig = {
    id: 'config-1',
    groupId: 'group-1',
    welcomeEnabled: true,
    welcomeMessage: 'Welcome!',
    rulesText: 'Be nice',
    warnThresholdMute: 3,
    warnThresholdBan: 5,
    warnDecayDays: 30,
    defaultMuteDurationS: 3600,
    antiSpamEnabled: true,
    antiSpamMaxMessages: 10,
    antiSpamWindowSeconds: 60,
    antiLinkEnabled: false,
    antiLinkWhitelist: [],
    slowModeDelay: 0,
    logChannelId: BigInt(999999),
    autoDeleteCommandsS: 0,
    captchaEnabled: false,
    captchaMode: 'math',
    captchaTimeoutS: 120,
    quarantineEnabled: false,
    quarantineDurationS: 300,
    silentMode: false,
    keywordFiltersEnabled: false,
    keywordFilters: [],
    aiModEnabled: false,
    aiModThreshold: 0.8,
    notificationEvents: [],
    pipelineEnabled: false,
    pipelineDmTemplate: null,
    pipelineDeeplink: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      managedGroup: createMockModel(),
      groupConfig: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  describe('findAll', () => {
    it('should return paginated groups', async () => {
      prisma.managedGroup.findMany.mockResolvedValue([mockGroup]);
      prisma.managedGroup.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.data[0].chatId).toBe('123456789');
    });

    it('should filter by isActive', async () => {
      prisma.managedGroup.findMany.mockResolvedValue([]);
      prisma.managedGroup.count.mockResolvedValue(0);

      await service.findAll(1, 20, true);

      expect(prisma.managedGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.managedGroup.findMany.mockResolvedValue([]);
      prisma.managedGroup.count.mockResolvedValue(50);

      const result = await service.findAll(3, 10);

      expect(result.totalPages).toBe(5);
      expect(prisma.managedGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return group with config and member count', async () => {
      const groupWithRelations = {
        ...mockGroup,
        config: mockConfig,
        _count: { members: 42 },
      };
      prisma.managedGroup.findUnique.mockResolvedValue(groupWithRelations);

      const result = await service.findOne('group-1');

      expect(result.id).toBe('group-1');
      expect(result.chatId).toBe('123456789');
      expect(result.memberCount).toBe(42);
      expect(result.config).toBeDefined();
      expect(result.config.welcomeEnabled).toBe(true);
      expect(result.config.logChannelId).toBe('999999');
    });

    it('should return group without config', async () => {
      const groupNoConfig = {
        ...mockGroup,
        config: null,
        _count: { members: 0 },
      };
      prisma.managedGroup.findUnique.mockResolvedValue(groupNoConfig);

      const result = await service.findOne('group-1');

      expect(result.config).toBeUndefined();
      expect(result.memberCount).toBe(0);
    });

    it('should throw NotFoundException for non-existent group', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateConfig', () => {
    it('should upsert group config', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.groupConfig.upsert.mockResolvedValue({
        ...mockConfig,
        antiSpamEnabled: false,
      });

      const result = await service.updateConfig('group-1', {
        antiSpamEnabled: false,
      });

      expect(result.antiSpamEnabled).toBe(false);
      expect(prisma.groupConfig.upsert).toHaveBeenCalledWith({
        where: { groupId: 'group-1' },
        update: expect.objectContaining({ antiSpamEnabled: false }),
        create: expect.objectContaining({
          groupId: 'group-1',
          antiSpamEnabled: false,
        }),
      });
    });

    it('should convert logChannelId string to BigInt', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.groupConfig.upsert.mockResolvedValue({
        ...mockConfig,
        logChannelId: BigInt(777777),
      });

      await service.updateConfig('group-1', {
        logChannelId: '777777',
      });

      expect(prisma.groupConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ logChannelId: BigInt(777777) }),
        }),
      );
    });

    it('should set logChannelId to null when empty string', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(mockGroup);
      prisma.groupConfig.upsert.mockResolvedValue({
        ...mockConfig,
        logChannelId: null,
      });

      await service.updateConfig('group-1', {
        logChannelId: '',
      });

      expect(prisma.groupConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ logChannelId: null }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent group', async () => {
      prisma.managedGroup.findUnique.mockResolvedValue(null);

      await expect(
        service.updateConfig('nonexistent', { antiSpamEnabled: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
