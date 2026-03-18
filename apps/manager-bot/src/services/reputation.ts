import type { PrismaClient } from '@flowbot/db'

/**
 * Reputation scoring weights
 */
const WEIGHTS = {
  /** Points per message (capped at 500 messages = 500 points) */
  MESSAGE_POINT: 1,
  MESSAGE_CAP: 500,

  /** Points per day of membership (capped at 365 days = 365 points) */
  TENURE_POINT: 1,
  TENURE_CAP: 365,

  /** Penalty per active warning */
  WARNING_PENALTY: 50,

  /** Bonus for moderator/admin role */
  MODERATOR_BONUS: 100,
}

export interface ReputationBreakdown {
  totalScore: number
  messageFactor: number
  tenureFactor: number
  warningPenalty: number
  moderationBonus: number
  lastCalculated: Date
}

export class ReputationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate and store reputation score for a user across all groups.
   */
  async calculate(telegramId: bigint): Promise<ReputationBreakdown> {
    // Aggregate message count across all groups
    const members = await this.prisma.groupMember.findMany({
      where: { telegramId },
    })

    const totalMessages = members.reduce((sum, m) => sum + m.messageCount, 0)
    const messageFactor = Math.min(totalMessages * WEIGHTS.MESSAGE_POINT, WEIGHTS.MESSAGE_CAP)

    // Tenure: days since earliest group join
    let tenureFactor = 0
    if (members.length > 0) {
      const earliest = members.reduce((min, m) => m.joinedAt < min ? m.joinedAt : min, members[0]!.joinedAt)
      const daysSinceJoin = Math.floor((Date.now() - earliest.getTime()) / 86_400_000)
      tenureFactor = Math.min(daysSinceJoin * WEIGHTS.TENURE_POINT, WEIGHTS.TENURE_CAP)
    }

    // Active warnings across all groups
    const activeWarnings = await this.prisma.warning.count({
      where: {
        member: { telegramId },
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    })
    const warningPenalty = activeWarnings * WEIGHTS.WARNING_PENALTY

    // Moderation role bonus: if user is moderator/admin in any group
    const modRoles = members.filter(m => m.role === 'moderator' || m.role === 'admin')
    const moderationBonus = modRoles.length > 0 ? WEIGHTS.MODERATOR_BONUS : 0

    const totalScore = Math.max(0, messageFactor + tenureFactor - warningPenalty + moderationBonus)

    const now = new Date()
    await this.prisma.reputationScore.upsert({
      where: { telegramId },
      create: {
        telegramId,
        totalScore,
        messageFactor,
        tenureFactor,
        warningPenalty,
        moderationBonus,
        lastCalculated: now,
      },
      update: {
        totalScore,
        messageFactor,
        tenureFactor,
        warningPenalty,
        moderationBonus,
        lastCalculated: now,
      },
    })

    // Also update the UserIdentity reputationScore if exists
    await this.prisma.userIdentity.updateMany({
      where: { telegramId },
      data: { reputationScore: totalScore },
    })

    return {
      totalScore,
      messageFactor,
      tenureFactor,
      warningPenalty,
      moderationBonus,
      lastCalculated: now,
    }
  }

  /**
   * Get the cached reputation score, or calculate if stale/missing.
   */
  async getOrCalculate(telegramId: bigint): Promise<ReputationBreakdown> {
    const existing = await this.prisma.reputationScore.findUnique({
      where: { telegramId },
    })

    // Recalculate if missing or older than 1 hour
    if (!existing || (Date.now() - existing.lastCalculated.getTime()) > 3_600_000) {
      return this.calculate(telegramId)
    }

    return {
      totalScore: existing.totalScore,
      messageFactor: existing.messageFactor,
      tenureFactor: existing.tenureFactor,
      warningPenalty: existing.warningPenalty,
      moderationBonus: existing.moderationBonus,
      lastCalculated: existing.lastCalculated,
    }
  }

  /**
   * Get cached score without recalculation. Returns null if not found.
   */
  async getCached(telegramId: bigint): Promise<ReputationBreakdown | null> {
    const existing = await this.prisma.reputationScore.findUnique({
      where: { telegramId },
    })

    if (!existing)
      return null

    return {
      totalScore: existing.totalScore,
      messageFactor: existing.messageFactor,
      tenureFactor: existing.tenureFactor,
      warningPenalty: existing.warningPenalty,
      moderationBonus: existing.moderationBonus,
      lastCalculated: existing.lastCalculated,
    }
  }
}
