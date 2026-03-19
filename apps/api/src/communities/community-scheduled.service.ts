import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunityScheduledService {
  constructor(private prisma: PrismaService) {}

  async findByCommunity(communityId: string, page = 1, limit = 20, sent?: boolean) {
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
    if (sent !== undefined) {
      where.sent = sent;
    }

    const [messages, total] = await Promise.all([
      this.prisma.scheduledMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sendAt: 'asc' },
      }),
      this.prisma.scheduledMessage.count({ where }),
    ]);

    return {
      data: messages.map((msg: any) => ({
        id: msg.id,
        communityId,
        chatId: msg.chatId.toString(),
        text: msg.text,
        createdBy: msg.createdBy.toString(),
        sendAt: msg.sendAt,
        sent: msg.sent,
        sentAt: msg.sentAt ?? undefined,
        createdAt: msg.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
