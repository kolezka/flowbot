import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
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

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let prisma: Record<string, any>;

  const mockCommunity = {
    id: 'community-1',
    platform: 'telegram',
    platformCommunityId: '-100123456789',
    name: 'Test Community',
    type: 'supergroup',
    memberCount: 100,
    isActive: true,
    metadata: null,
    botInstanceId: null,
    joinedAt: new Date('2026-01-01'),
    leftAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockConfig = {
    id: 'config-1',
    communityId: 'community-1',
    welcomeEnabled: true,
    welcomeMessage: 'Welcome!',
    rulesText: 'Be nice',
    antiSpamEnabled: true,
    antiSpamAction: 'delete',
    antiSpamMaxMessages: 10,
    antiSpamWindowSeconds: 10,
    antiLinkEnabled: false,
    antiLinkAction: 'delete',
    antiLinkWhitelist: [],
    warnThresholdMute: 3,
    warnThresholdBan: 5,
    warnDecayDays: 30,
    defaultMuteDurationS: 3600,
    logChannelId: null,
    autoDeleteCommandsS: 10,
    silentMode: false,
    keywordFiltersEnabled: false,
    keywordFilters: [],
    aiModerationEnabled: false,
    aiModerationAction: 'delete',
    aiModThreshold: 0.8,
    notificationEvents: [],
    pipelineEnabled: false,
    pipelineDmTemplate: null,
    pipelineDeeplink: null,
    metadata: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockTelegramConfig = {
    id: 'tg-config-1',
    communityId: 'community-1',
    captchaEnabled: false,
    captchaMode: 'button',
    captchaTimeoutS: 60,
    quarantineEnabled: false,
    quarantineDurationS: 86400,
    slowModeDelay: 0,
    forumTopicMgmt: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      community: createMockModel(),
      communityConfig: createMockModel(),
      communityTelegramConfig: createMockModel(),
      communityDiscordConfig: createMockModel(),
      communityMember: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CommunitiesService>(CommunitiesService);
  });

  describe('findAll', () => {
    it('should return paginated communities', async () => {
      prisma.community.findMany.mockResolvedValue([mockCommunity]);
      prisma.community.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.data[0].id).toBe('community-1');
    });

    it('should filter by platform', async () => {
      prisma.community.findMany.mockResolvedValue([]);
      prisma.community.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'telegram');

      expect(prisma.community.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ platform: 'telegram' }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      prisma.community.findMany.mockResolvedValue([]);
      prisma.community.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, undefined, true);

      expect(prisma.community.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should filter by search (name contains)', async () => {
      prisma.community.findMany.mockResolvedValue([]);
      prisma.community.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, 'test');

      expect(prisma.community.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({ contains: 'test' }),
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.community.findMany.mockResolvedValue([]);
      prisma.community.count.mockResolvedValue(50);

      const result = await service.findAll(3, 10);

      expect(result.totalPages).toBe(5);
      expect(prisma.community.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return community with config', async () => {
      const communityWithRelations = {
        ...mockCommunity,
        config: mockConfig,
        telegramConfig: mockTelegramConfig,
        discordConfig: null,
      };
      prisma.community.findUnique.mockResolvedValue(communityWithRelations);

      const result = await service.findOne('community-1');

      expect(result.id).toBe('community-1');
      expect(result.platform).toBe('telegram');
      expect(result.config).toBeDefined();
      expect(result.config.welcomeEnabled).toBe(true);
      expect(result.telegramConfig).toBeDefined();
    });

    it('should return community without config', async () => {
      const communityNoConfig = {
        ...mockCommunity,
        config: null,
        telegramConfig: null,
        discordConfig: null,
      };
      prisma.community.findUnique.mockResolvedValue(communityNoConfig);

      const result = await service.findOne('community-1');

      expect(result.config).toBeUndefined();
      expect(result.telegramConfig).toBeUndefined();
    });

    it('should throw NotFoundException for non-existent community', async () => {
      prisma.community.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a community', async () => {
      prisma.community.create.mockResolvedValue(mockCommunity);

      const result = await service.create({
        platform: 'telegram',
        platformCommunityId: '-100123456789',
        name: 'Test Community',
      });

      expect(result.id).toBe('community-1');
      expect(result.platform).toBe('telegram');
      expect(prisma.community.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: 'telegram',
          platformCommunityId: '-100123456789',
        }),
      });
    });
  });

  describe('update', () => {
    it('should update a community', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity);
      prisma.community.update.mockResolvedValue({
        ...mockCommunity,
        name: 'Updated Name',
      });

      const result = await service.update('community-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException for non-existent community', async () => {
      prisma.community.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateConfig', () => {
    it('should upsert community config', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity);
      prisma.communityConfig.upsert.mockResolvedValue({
        ...mockConfig,
        antiSpamEnabled: false,
      });

      const result = await service.updateConfig('community-1', {
        antiSpamEnabled: false,
      });

      expect(result.antiSpamEnabled).toBe(false);
      expect(prisma.communityConfig.upsert).toHaveBeenCalledWith({
        where: { communityId: 'community-1' },
        update: expect.objectContaining({ antiSpamEnabled: false }),
        create: expect.objectContaining({
          communityId: 'community-1',
          antiSpamEnabled: false,
        }),
      });
    });

    it('should throw NotFoundException for non-existent community', async () => {
      prisma.community.findUnique.mockResolvedValue(null);

      await expect(
        service.updateConfig('nonexistent', { antiSpamEnabled: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should set isActive=false and leftAt', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity);
      const deactivated = {
        ...mockCommunity,
        isActive: false,
        leftAt: new Date(),
      };
      prisma.community.update.mockResolvedValue(deactivated);

      const result = await service.deactivate('community-1');

      expect(result.isActive).toBe(false);
      expect(result.leftAt).toBeDefined();
      expect(prisma.community.update).toHaveBeenCalledWith({
        where: { id: 'community-1' },
        data: expect.objectContaining({
          isActive: false,
          leftAt: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundException for non-existent community', async () => {
      prisma.community.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
