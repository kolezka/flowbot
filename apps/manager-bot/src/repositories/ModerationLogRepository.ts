import type { ModerationLog, Prisma, PrismaClient } from '@tg-allegro/db'

export class ModerationLogRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    groupId: string
    action: string
    actorId: bigint
    targetId?: bigint
    reason?: string
    details?: Prisma.InputJsonValue
    automated?: boolean
  }): Promise<ModerationLog> {
    return this.prisma.moderationLog.create({ data })
  }

  async findByGroup(groupId: string, limit = 20): Promise<ModerationLog[]> {
    return this.prisma.moderationLog.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async findByTarget(groupId: string, targetId: bigint, limit = 20): Promise<ModerationLog[]> {
    return this.prisma.moderationLog.findMany({
      where: { groupId, targetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
