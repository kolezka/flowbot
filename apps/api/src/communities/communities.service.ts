import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CommunityDto,
  CommunityListResponseDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  CommunityConfigDto,
  UpdateCommunityConfigDto,
  CommunityTelegramConfigDto,
  UpdateTelegramConfigDto,
  CommunityDiscordConfigDto,
  UpdateDiscordConfigDto,
} from './dto';

@Injectable()
export class CommunitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    platform?: string,
    search?: string,
    isActive?: boolean,
  ): Promise<CommunityListResponseDto> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (platform) {
      where.platform = platform;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [communities, total] = await Promise.all([
      this.prisma.community.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.community.count({ where }),
    ]);

    return {
      data: communities.map((c) => this.mapToDto(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<
    CommunityDto & {
      config?: CommunityConfigDto;
      telegramConfig?: CommunityTelegramConfigDto;
      discordConfig?: CommunityDiscordConfigDto;
    }
  > {
    const community = await this.prisma.community.findUnique({
      where: { id },
      include: {
        config: true,
        telegramConfig: true,
        discordConfig: true,
      },
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }

    return {
      ...this.mapToDto(community),
      config: community.config
        ? this.mapConfigToDto(community.config)
        : undefined,
      telegramConfig: community.telegramConfig
        ? this.mapTelegramConfigToDto(community.telegramConfig)
        : undefined,
      discordConfig: community.discordConfig
        ? this.mapDiscordConfigToDto(community.discordConfig)
        : undefined,
    };
  }

  async create(dto: CreateCommunityDto): Promise<CommunityDto> {
    if (dto.botInstanceId) {
      const botInstance = await this.prisma.botInstance.findUnique({
        where: { id: dto.botInstanceId },
      });
      if (!botInstance) {
        throw new NotFoundException('Bot instance not found');
      }
      if (botInstance.platform !== dto.platform) {
        throw new BadRequestException(
          'Bot instance platform does not match community platform',
        );
      }
    }

    const community = await this.prisma.community.create({
      data: {
        platform: dto.platform,
        platformCommunityId: dto.platformCommunityId,
        name: dto.name,
        type: dto.type,
        botInstanceId: dto.botInstanceId,
      },
    });

    return this.mapToDto(community);
  }

  async update(id: string, dto: UpdateCommunityDto): Promise<CommunityDto> {
    const existing = await this.prisma.community.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }

    if (dto.botInstanceId) {
      const botInstance = await this.prisma.botInstance.findUnique({
        where: { id: dto.botInstanceId },
      });
      if (!botInstance) {
        throw new NotFoundException('Bot instance not found');
      }
      if (botInstance.platform !== existing.platform) {
        throw new BadRequestException(
          'Bot instance platform does not match community platform',
        );
      }
    }

    const updated = await this.prisma.community.update({
      where: { id },
      data: { ...dto },
    });

    return this.mapToDto(updated);
  }

  async getConfig(communityId: string): Promise<CommunityConfigDto> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${communityId} not found`);
    }

    const config = await this.prisma.communityConfig.findUnique({
      where: { communityId },
    });

    if (!config) {
      throw new NotFoundException(
        `Config for community ${communityId} not found`,
      );
    }

    return this.mapConfigToDto(config);
  }

  async updateConfig(
    communityId: string,
    dto: UpdateCommunityConfigDto,
  ): Promise<CommunityConfigDto> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${communityId} not found`);
    }

    const config = await this.prisma.communityConfig.upsert({
      where: { communityId },
      update: { ...dto },
      create: { communityId, ...dto },
    });

    return this.mapConfigToDto(config);
  }

  async getTelegramConfig(
    communityId: string,
  ): Promise<CommunityTelegramConfigDto> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${communityId} not found`);
    }

    const config = await this.prisma.communityTelegramConfig.findUnique({
      where: { communityId },
    });

    if (!config) {
      throw new NotFoundException(
        `Telegram config for community ${communityId} not found`,
      );
    }

    return this.mapTelegramConfigToDto(config);
  }

  async updateTelegramConfig(
    communityId: string,
    dto: UpdateTelegramConfigDto,
  ): Promise<CommunityTelegramConfigDto> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${communityId} not found`);
    }

    const config = await this.prisma.communityTelegramConfig.upsert({
      where: { communityId },
      update: { ...dto },
      create: { communityId, ...dto },
    });

    return this.mapTelegramConfigToDto(config);
  }

  async getDiscordConfig(
    communityId: string,
  ): Promise<CommunityDiscordConfigDto> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${communityId} not found`);
    }

    const config = await this.prisma.communityDiscordConfig.findUnique({
      where: { communityId },
    });

    if (!config) {
      throw new NotFoundException(
        `Discord config for community ${communityId} not found`,
      );
    }

    return this.mapDiscordConfigToDto(config);
  }

  async updateDiscordConfig(
    communityId: string,
    dto: UpdateDiscordConfigDto,
  ): Promise<CommunityDiscordConfigDto> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${communityId} not found`);
    }

    const config = await this.prisma.communityDiscordConfig.upsert({
      where: { communityId },
      update: { ...dto },
      create: { communityId, ...dto },
    });

    return this.mapDiscordConfigToDto(config);
  }

  async deactivate(id: string): Promise<CommunityDto> {
    const existing = await this.prisma.community.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }

    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    return this.mapToDto(updated);
  }

  private mapToDto(community: any): CommunityDto {
    return {
      id: community.id,
      platform: community.platform,
      platformCommunityId: community.platformCommunityId,
      name: community.name ?? undefined,
      type: community.type ?? undefined,
      memberCount: community.memberCount,
      isActive: community.isActive,
      metadata: community.metadata ?? undefined,
      botInstanceId: community.botInstanceId ?? undefined,
      joinedAt: community.joinedAt,
      leftAt: community.leftAt ?? undefined,
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
    };
  }

  private mapConfigToDto(config: any): CommunityConfigDto {
    return {
      id: config.id,
      communityId: config.communityId,
      welcomeEnabled: config.welcomeEnabled,
      welcomeMessage: config.welcomeMessage ?? undefined,
      rulesText: config.rulesText ?? undefined,
      antiSpamEnabled: config.antiSpamEnabled,
      antiSpamAction: config.antiSpamAction,
      antiSpamMaxMessages: config.antiSpamMaxMessages,
      antiSpamWindowSeconds: config.antiSpamWindowSeconds,
      antiLinkEnabled: config.antiLinkEnabled,
      antiLinkAction: config.antiLinkAction,
      antiLinkWhitelist: config.antiLinkWhitelist,
      warnThresholdMute: config.warnThresholdMute,
      warnThresholdBan: config.warnThresholdBan,
      warnDecayDays: config.warnDecayDays,
      defaultMuteDurationS: config.defaultMuteDurationS,
      logChannelId: config.logChannelId ?? undefined,
      autoDeleteCommandsS: config.autoDeleteCommandsS,
      silentMode: config.silentMode,
      keywordFiltersEnabled: config.keywordFiltersEnabled,
      keywordFilters: config.keywordFilters,
      aiModerationEnabled: config.aiModerationEnabled,
      aiModerationAction: config.aiModerationAction,
      aiModThreshold: config.aiModThreshold,
      notificationEvents: config.notificationEvents,
      pipelineEnabled: config.pipelineEnabled,
      pipelineDmTemplate: config.pipelineDmTemplate ?? undefined,
      pipelineDeeplink: config.pipelineDeeplink ?? undefined,
      metadata: config.metadata ?? undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private mapTelegramConfigToDto(config: any): CommunityTelegramConfigDto {
    return {
      id: config.id,
      communityId: config.communityId,
      captchaEnabled: config.captchaEnabled,
      captchaMode: config.captchaMode,
      captchaTimeoutS: config.captchaTimeoutS,
      quarantineEnabled: config.quarantineEnabled,
      quarantineDurationS: config.quarantineDurationS,
      slowModeDelay: config.slowModeDelay,
      forumTopicMgmt: config.forumTopicMgmt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private mapDiscordConfigToDto(config: any): CommunityDiscordConfigDto {
    return {
      id: config.id,
      communityId: config.communityId,
      autoModRules: config.autoModRules ?? undefined,
      verificationLevel: config.verificationLevel ?? undefined,
      defaultChannelId: config.defaultChannelId ?? undefined,
      modLogChannelId: config.modLogChannelId ?? undefined,
      welcomeChannelId: config.welcomeChannelId ?? undefined,
      roleOnJoin: config.roleOnJoin ?? undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
