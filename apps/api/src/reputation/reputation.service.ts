import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReputationResponseDto } from './dto';

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
