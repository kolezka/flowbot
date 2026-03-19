import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunityWarningsService {
  constructor(private prisma: PrismaService) {}

  async findByCommunity(
    communityId: string,
    page = 1,
    limit = 20,
    isActive?: boolean,
  ) {
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
    const where: Record<string, unknown> = { groupId: group.id };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [warnings, total] = await Promise.all([
      this.prisma.warning.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { group: { select: { title: true } } },
      }),
      this.prisma.warning.count({ where }),
    ]);

    return {
      data: warnings.map((w: any) => ({
        id: w.id,
        communityId,
        communityName: community.name ?? undefined,
        memberId: w.memberId,
        issuerId: w.issuerId.toString(),
        reason: w.reason ?? undefined,
        isActive: w.isActive,
        expiresAt: w.expiresAt ?? undefined,
        createdAt: w.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
