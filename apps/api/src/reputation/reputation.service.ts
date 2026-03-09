import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReputationResponseDto, LeaderboardResponseDto } from './dto';

@Injectable()
export class ReputationService {
  constructor(private prisma: PrismaService) {}

  async getByTelegramId(telegramId: string): Promise<ReputationResponseDto> {
    const tid = BigInt(telegramId);

    const score = await this.prisma.reputationScore.findUnique({
      where: { telegramId: tid },
    });

    if (!score) {
      // Try to calculate on the fly if user exists in any group
      const members = await this.prisma.groupMember.findMany({
        where: { telegramId: tid },
      });

      if (members.length === 0) {
        throw new NotFoundException(
          `No reputation data found for Telegram ID ${telegramId}`,
        );
      }

      // Calculate and store
      return this.calculateAndStore(tid, members);
    }

    return {
      telegramId: score.telegramId.toString(),
      totalScore: score.totalScore,
      messageFactor: score.messageFactor,
      tenureFactor: score.tenureFactor,
      warningPenalty: score.warningPenalty,
      moderationBonus: score.moderationBonus,
      lastCalculated: score.lastCalculated.toISOString(),
    };
  }

  async getLeaderboard(
    limit: number,
    groupId?: string,
  ): Promise<LeaderboardResponseDto> {
    // If groupId is provided, filter by members of that group
    let telegramIdFilter: bigint[] | undefined;
    if (groupId) {
      const members = await this.prisma.groupMember.findMany({
        where: { groupId },
        select: { telegramId: true },
      });
      telegramIdFilter = members.map((m) => m.telegramId);

      if (telegramIdFilter.length === 0) {
        return {
          entries: [],
          total: 0,
          stats: { averageScore: 0, medianScore: 0 },
        };
      }
    }

    const where = telegramIdFilter
      ? { telegramId: { in: telegramIdFilter } }
      : {};

    const [scores, totalCount] = await Promise.all([
      this.prisma.reputationScore.findMany({
        where,
        orderBy: { totalScore: 'desc' },
        take: limit,
      }),
      this.prisma.reputationScore.count({ where }),
    ]);

    // Collect all telegramIds to look up display names
    const telegramIds = scores.map((s) => s.telegramId);

    // Try GroupMember first for username/firstName
    const members = await this.prisma.groupMember.findMany({
      where: { telegramId: { in: telegramIds } },
      select: { telegramId: true },
    });

    // Also try User table for display names
    const users = await this.prisma.user.findMany({
      where: { telegramId: { in: telegramIds } },
      select: { telegramId: true, username: true, firstName: true },
    });

    const userMap = new Map(
      users.map((u) => [u.telegramId.toString(), u]),
    );

    const entries = scores.map((score, index) => {
      const user = userMap.get(score.telegramId.toString());
      return {
        rank: index + 1,
        telegramId: score.telegramId.toString(),
        username: user?.username ?? undefined,
        firstName: user?.firstName ?? undefined,
        totalScore: score.totalScore,
        messageFactor: score.messageFactor,
        tenureFactor: score.tenureFactor,
        warningPenalty: score.warningPenalty,
        moderationBonus: score.moderationBonus,
      };
    });

    // Calculate stats from all matching scores (not just the page)
    const allScores = await this.prisma.reputationScore.findMany({
      where,
      select: { totalScore: true },
      orderBy: { totalScore: 'asc' },
    });

    let averageScore = 0;
    let medianScore = 0;

    if (allScores.length > 0) {
      const sum = allScores.reduce((acc, s) => acc + s.totalScore, 0);
      averageScore = Math.round((sum / allScores.length) * 10) / 10;

      const mid = Math.floor(allScores.length / 2);
      medianScore =
        allScores.length % 2 === 0
          ? Math.round(((allScores[mid - 1]!.totalScore + allScores[mid]!.totalScore) / 2) * 10) / 10
          : allScores[mid]!.totalScore;
    }

    return {
      entries,
      total: totalCount,
      stats: { averageScore, medianScore },
    };
  }

  private async calculateAndStore(
    telegramId: bigint,
    members: { messageCount: number; joinedAt: Date; role: string }[],
  ): Promise<ReputationResponseDto> {
    const totalMessages = members.reduce((sum, m) => sum + m.messageCount, 0);
    const messageFactor = Math.min(totalMessages, 500);

    let tenureFactor = 0;
    if (members.length > 0) {
      const earliest = members.reduce(
        (min, m) => (m.joinedAt < min ? m.joinedAt : min),
        members[0]!.joinedAt,
      );
      const daysSinceJoin = Math.floor(
        (Date.now() - earliest.getTime()) / 86_400_000,
      );
      tenureFactor = Math.min(daysSinceJoin, 365);
    }

    const activeWarnings = await this.prisma.warning.count({
      where: {
        member: { telegramId },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    const warningPenalty = activeWarnings * 50;

    const modRoles = members.filter(
      (m) => m.role === 'moderator' || m.role === 'admin',
    );
    const moderationBonus = modRoles.length > 0 ? 100 : 0;

    const totalScore = Math.max(
      0,
      messageFactor + tenureFactor - warningPenalty + moderationBonus,
    );

    const now = new Date();
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
    });

    return {
      telegramId: telegramId.toString(),
      totalScore,
      messageFactor,
      tenureFactor,
      warningPenalty,
      moderationBonus,
      lastCalculated: now.toISOString(),
    };
  }
}
