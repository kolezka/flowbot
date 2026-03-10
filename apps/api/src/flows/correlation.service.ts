import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CorrelatedUserContext {
  telegramId: bigint;
  identity: {
    id: string;
    reputationScore: number;
    firstSeenAt: Date;
  } | null;
  shopUser: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    isBanned: boolean;
    messageCount: number;
    commandCount: number;
    lastSeenAt: Date | null;
    createdAt: Date;
  } | null;
  groupMemberships: {
    groupId: string;
    groupTitle: string | null;
    role: string;
    messageCount: number;
    lastSeenAt: Date;
    warningCount: number;
  }[];
}

@Injectable()
export class CorrelationService {
  private readonly logger = new Logger(CorrelationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Given a telegram user ID, merge context from multiple bots
   * by looking up UserIdentity and related User/GroupMember records.
   */
  async getCorrelatedContext(telegramId: bigint): Promise<CorrelatedUserContext> {
    // Fetch identity, user, and group memberships in parallel
    const [identity, user, memberships] = await Promise.all([
      this.prisma.userIdentity.findUnique({
        where: { telegramId },
      }),
      this.prisma.user.findUnique({
        where: { telegramId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          isBanned: true,
          messageCount: true,
          commandCount: true,
          lastSeenAt: true,
          createdAt: true,
        },
      }),
      this.prisma.groupMember.findMany({
        where: { telegramId },
        include: {
          group: { select: { title: true } },
          warnings: { where: { isActive: true } },
        },
      }),
    ]);

    return {
      telegramId,
      identity: identity
        ? {
            id: identity.id,
            reputationScore: identity.reputationScore,
            firstSeenAt: identity.firstSeenAt,
          }
        : null,
      shopUser: user
        ? {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            isBanned: user.isBanned,
            messageCount: user.messageCount,
            commandCount: user.commandCount,
            lastSeenAt: user.lastSeenAt,
            createdAt: user.createdAt,
          }
        : null,
      groupMemberships: memberships.map((m) => ({
        groupId: m.groupId,
        groupTitle: m.group.title,
        role: m.role,
        messageCount: m.messageCount,
        lastSeenAt: m.lastSeenAt,
        warningCount: m.warnings.length,
      })),
    };
  }
}
