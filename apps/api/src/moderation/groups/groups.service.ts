import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GroupDto,
  GroupDetailDto,
  GroupListResponseDto,
  GroupConfigDto,
} from './dto';
import { UpdateGroupConfigDto } from './dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    isActive?: boolean,
  ): Promise<GroupListResponseDto> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [groups, total] = await Promise.all([
      this.prisma.managedGroup.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.managedGroup.count({ where }),
    ]);

    return {
      data: groups.map((g) => this.mapToDto(g)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<GroupDetailDto> {
    const group = await this.prisma.managedGroup.findUnique({
      where: { id },
      include: {
        config: true,
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }

    return {
      ...this.mapToDto(group),
      config: group.config ? this.mapConfigToDto(group.config) : undefined,
      memberCount: group._count.members,
    };
  }

  async updateConfig(
    id: string,
    dto: UpdateGroupConfigDto,
  ): Promise<GroupConfigDto> {
    const group = await this.prisma.managedGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }

    const data: any = { ...dto };
    if (dto.logChannelId !== undefined) {
      data.logChannelId = dto.logChannelId ? BigInt(dto.logChannelId) : null;
    }

    const config = await this.prisma.groupConfig.upsert({
      where: { groupId: id },
      update: data,
      create: { groupId: id, ...data },
    });

    return this.mapConfigToDto(config);
  }

  private mapToDto(group: any): GroupDto {
    return {
      id: group.id,
      chatId: group.chatId.toString(),
      title: group.title ?? undefined,
      isActive: group.isActive,
      joinedAt: group.joinedAt,
      leftAt: group.leftAt ?? undefined,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  private mapConfigToDto(config: any): GroupConfigDto {
    return {
      id: config.id,
      welcomeEnabled: config.welcomeEnabled,
      welcomeMessage: config.welcomeMessage ?? undefined,
      rulesText: config.rulesText ?? undefined,
      warnThresholdMute: config.warnThresholdMute,
      warnThresholdBan: config.warnThresholdBan,
      warnDecayDays: config.warnDecayDays,
      defaultMuteDurationS: config.defaultMuteDurationS,
      antiSpamEnabled: config.antiSpamEnabled,
      antiSpamMaxMessages: config.antiSpamMaxMessages,
      antiSpamWindowSeconds: config.antiSpamWindowSeconds,
      antiLinkEnabled: config.antiLinkEnabled,
      antiLinkWhitelist: config.antiLinkWhitelist,
      slowModeDelay: config.slowModeDelay,
      logChannelId: config.logChannelId?.toString() ?? undefined,
      autoDeleteCommandsS: config.autoDeleteCommandsS,
      captchaEnabled: config.captchaEnabled,
      captchaMode: config.captchaMode,
      captchaTimeoutS: config.captchaTimeoutS,
      quarantineEnabled: config.quarantineEnabled,
      quarantineDurationS: config.quarantineDurationS,
      silentMode: config.silentMode,
      keywordFiltersEnabled: config.keywordFiltersEnabled,
      keywordFilters: config.keywordFilters,
      aiModEnabled: config.aiModEnabled,
      aiModThreshold: config.aiModThreshold,
      notificationEvents: config.notificationEvents,
      pipelineEnabled: config.pipelineEnabled,
      pipelineDmTemplate: config.pipelineDmTemplate ?? undefined,
      pipelineDeeplink: config.pipelineDeeplink ?? undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
