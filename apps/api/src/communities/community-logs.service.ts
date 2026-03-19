import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunityLogsService {
  constructor(private prisma: PrismaService) {}

  async findByCommunity(communityId: string, page = 1, limit = 20) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException(`Community ${communityId} not found`);
    }

    const group = await this.prisma.managedGroup.findUnique({
      where: { chatId: BigInt(community.platformCommunityId) },
    });

    if (!group) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const skip = (page - 1) * limit;
    const where = { groupId: group.id };

    const [logs, total] = await Promise.all([
      this.prisma.moderationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.moderationLog.count({ where }),
    ]);

    return {
      data: logs.map((log: any) => ({
        id: log.id,
        communityId,
        action: log.action,
        actorId: log.actorId.toString(),
        targetId: log.targetId?.toString() ?? undefined,
        reason: log.reason ?? undefined,
        details: log.details ?? undefined,
        automated: log.automated,
        createdAt: log.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
