import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(groupId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (groupId) {
      where.groupId = groupId;
    }

    const [logs, total] = await Promise.all([
      this.prisma.moderationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.moderationLog.count({ where }),
    ]);

    return {
      data: logs.map(log => ({
        ...log,
        actorId: String(log.actorId),
        targetId: String(log.targetId),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
