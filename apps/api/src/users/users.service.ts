import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserDto, UserListResponseDto, UserStatsDto, UnifiedProfileDto } from './dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 20, search?: string, isBanned?: boolean): Promise<UserListResponseDto> {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.username = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (isBanned !== undefined) {
      where.isBanned = isBanned;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(this.mapToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.mapToDto(user);
  }

  async getStats(): Promise<UserStatsDto> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalUsers, activeUsers, bannedUsers, newUsersToday, verifiedUsers, aggregates] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({
          where: {
            lastSeenAt: { gte: sevenDaysAgo },
          },
        }),
        this.prisma.user.count({
          where: { isBanned: true },
        }),
        this.prisma.user.count({
          where: {
            createdAt: { gte: todayStart },
          },
        }),
        this.prisma.user.count({
          where: {
            verifiedAt: { not: null },
          },
        }),
        this.prisma.user.aggregate({
          _sum: {
            messageCount: true,
            commandCount: true,
          },
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      bannedUsers,
      newUsersToday,
      verifiedUsers,
      totalMessages: aggregates._sum.messageCount || 0,
      totalCommands: aggregates._sum.commandCount || 0,
    };
  }

  async setBanStatus(id: string, isBanned: boolean, banReason?: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isBanned,
        bannedAt: isBanned ? new Date() : null,
        banReason: isBanned ? banReason : null,
      },
    });

    this.logger.log(`User ${id} ban status set to ${isBanned}${banReason ? ` (reason: ${banReason})` : ''}`);

    return this.mapToDto(updatedUser);
  }

  async getUnifiedProfile(telegramId: string): Promise<UnifiedProfileDto> {
    const tgId = BigInt(telegramId);

    // Resolve or create identity
    let identity = await this.prisma.userIdentity.findUnique({
      where: { telegramId: tgId },
      include: { user: true },
    });

    if (!identity) {
      // Auto-link if user exists
      const user = await this.prisma.user.findUnique({
        where: { telegramId: tgId },
        select: { id: true },
      });

      identity = await this.prisma.userIdentity.create({
        data: {
          telegramId: tgId,
          userId: user?.id ?? undefined,
        },
        include: { user: true },
      });
    }

    // Get group memberships with active warnings
    const memberships = await this.prisma.groupMember.findMany({
      where: { telegramId: tgId },
      include: {
        group: { select: { id: true, chatId: true, title: true } },
        warnings: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Get moderation logs
    const moderationLogs = await this.prisma.moderationLog.findMany({
      where: { targetId: tgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        group: { select: { id: true, chatId: true, title: true } },
      },
    });

    return {
      telegramId: identity.telegramId.toString(),
      reputationScore: identity.reputationScore,
      firstSeenAt: identity.firstSeenAt,
      user: identity.user
        ? {
            id: identity.user.id,
            username: identity.user.username ?? undefined,
            firstName: identity.user.firstName ?? undefined,
            lastName: identity.user.lastName ?? undefined,
            languageCode: identity.user.languageCode ?? undefined,
            isBanned: identity.user.isBanned,
            banReason: identity.user.banReason ?? undefined,
            messageCount: identity.user.messageCount,
            commandCount: identity.user.commandCount,
            verifiedAt: identity.user.verifiedAt ?? undefined,
            createdAt: identity.user.createdAt,
          }
        : undefined,
      memberships: memberships.map((m) => ({
        groupId: m.group.id,
        chatId: m.group.chatId.toString(),
        title: m.group.title ?? undefined,
        role: m.role,
        joinedAt: m.joinedAt,
        messageCount: m.messageCount,
        lastSeenAt: m.lastSeenAt,
        activeWarnings: m.warnings.map((w) => ({
          id: w.id,
          reason: w.reason ?? undefined,
          issuerId: w.issuerId.toString(),
          isActive: w.isActive,
          expiresAt: w.expiresAt ?? undefined,
          createdAt: w.createdAt,
        })),
      })),
      moderationLogs: moderationLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actorId: log.actorId.toString(),
        reason: log.reason ?? undefined,
        details: log.details ?? undefined,
        automated: log.automated,
        createdAt: log.createdAt,
        groupTitle: log.group.title ?? undefined,
      })),
    };
  }

  private mapToDto(user: any): UserDto {
    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      languageCode: user.languageCode,
      lastChatId: user.lastChatId?.toString(),
      lastSeenAt: user.lastSeenAt,
      lastMessageAt: user.lastMessageAt,
      verifiedAt: user.verifiedAt,
      isBanned: user.isBanned,
      bannedAt: user.bannedAt,
      banReason: user.banReason,
      messageCount: user.messageCount,
      commandCount: user.commandCount,
      referralCode: user.referralCode,
      referredByUserId: user.referredByUserId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
