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

  async getByAccountId(accountId: string): Promise<ReputationResponseDto> {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (account.platform === 'telegram') {
      return this.getByTelegramId(account.platformUserId);
    }

    const memberships = await this.prisma.communityMember.findMany({
      where: { platformAccountId: accountId },
    });

    if (memberships.length === 0) {
      throw new NotFoundException(
        `No reputation data found for account ${accountId}`,
      );
    }

    const totalMessages = memberships.reduce(
      (sum, m) => sum + m.messageCount,
      0,
    );
    const messageFactor = Math.min(totalMessages, 500);

    const earliest = memberships.reduce(
      (min, m) => (m.joinedAt < min ? m.joinedAt : min),
      memberships[0]!.joinedAt,
    );
    const daysSinceJoin = Math.floor(
      (Date.now() - earliest.getTime()) / 86_400_000,
    );
    const tenureFactor = Math.min(daysSinceJoin, 365);

    const totalScore = Math.max(0, messageFactor + tenureFactor);

    return {
      telegramId: account.platformUserId,
      totalScore,
      messageFactor,
      tenureFactor,
      warningPenalty: 0,
      moderationBonus: 0,
      lastCalculated: new Date().toISOString(),
    };
  }

  async getByIdentityId(identityId: string): Promise<{
    identityId: string;
    aggregateScore: number;
    platformScores: Array<{
      platform: string;
      platformUserId: string;
      totalScore: number;
    }>;
  }> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: identityId },
      include: { platformAccounts: true },
    });
    if (!identity) {
      throw new NotFoundException(`Identity ${identityId} not found`);
    }

    const platformScores: Array<{
      platform: string;
      platformUserId: string;
      totalScore: number;
    }> = [];

    for (const account of identity.platformAccounts) {
      try {
        const score = await this.getByAccountId(account.id);
        platformScores.push({
          platform: account.platform,
          platformUserId: account.platformUserId,
          totalScore: score.totalScore,
        });
      } catch {
        // No reputation data for this account — skip
      }
    }

    const aggregateScore = platformScores.reduce(
      (sum, s) => sum + s.totalScore,
      0,
    );

    return { identityId, aggregateScore, platformScores };
  }

  async getCommunityLeaderboard(
    communityId: string,
    limit: number = 20,
  ): Promise<LeaderboardResponseDto> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });
    if (!community) {
      throw new NotFoundException(`Community ${communityId} not found`);
    }

    const members = await this.prisma.communityMember.findMany({
      where: { communityId },
      include: {
        platformAccount: {
          select: {
            platform: true,
            platformUserId: true,
            username: true,
            firstName: true,
          },
        },
      },
      orderBy: { messageCount: 'desc' },
      take: limit,
    });

    const entries = members.map((m, i) => ({
      rank: i + 1,
      telegramId: m.platformAccount.platformUserId,
      username: m.platformAccount.username ?? undefined,
      firstName: m.platformAccount.firstName ?? undefined,
      totalScore:
        Math.min(m.messageCount, 500) +
        Math.min(
          Math.floor((Date.now() - m.joinedAt.getTime()) / 86_400_000),
          365,
        ),
      messageFactor: Math.min(m.messageCount, 500),
      tenureFactor: Math.min(
        Math.floor((Date.now() - m.joinedAt.getTime()) / 86_400_000),
        365,
      ),
      warningPenalty: 0,
      moderationBonus:
        m.role === 'admin' || m.role === 'moderator' ? 100 : 0,
    }));

    const scores = entries.map((e) => e.totalScore);
    const avg =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 0
          ? (sorted[mid - 1]! + sorted[mid]!) / 2
          : sorted[mid]!;

    return {
      entries,
      total: members.length,
      stats: {
        averageScore: Math.round(avg * 10) / 10,
        medianScore: Math.round(median * 10) / 10,
      },
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
