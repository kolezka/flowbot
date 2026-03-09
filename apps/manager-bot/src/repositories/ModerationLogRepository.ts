import type { ModerationLog, Prisma, PrismaClient } from '@tg-allegro/db'
import { logChannelService } from '../services/log-channel.js'

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
    const log = await this.prisma.moderationLog.create({ data })

    // Forward to log channel if configured
    const config = await this.prisma.groupConfig.findUnique({
      where: { groupId: data.groupId },
      select: { logChannelId: true },
    })
    if (config?.logChannelId) {
      const group = await this.prisma.managedGroup.findUnique({ where: { id: data.groupId } })
      logChannelService.sendLogEvent(config.logChannelId, {
        action: data.action,
        actorId: data.actorId,
        targetId: data.targetId,
        reason: data.reason,
        automated: data.automated,
        groupTitle: group?.title ?? undefined,
      }).catch(() => {}) // fire-and-forget
    }

    return log
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

  async findByGroupAutomated(groupId: string, limit = 10): Promise<ModerationLog[]> {
    return this.prisma.moderationLog.findMany({
      where: {
        groupId,
        OR: [
          { automated: true },
          { action: 'ai_spam_detected' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
