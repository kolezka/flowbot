import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserDto, UserListResponseDto, UserStatsDto } from './dto';

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
