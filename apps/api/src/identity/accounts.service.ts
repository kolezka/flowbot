import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAccountDto, PlatformAccountListResponseDto, AccountStatsDto } from './dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    search?: string,
    isBanned?: boolean,
    platform?: string,
  ): Promise<PlatformAccountListResponseDto> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (search) {
      where.username = { contains: search, mode: 'insensitive' };
    }
    if (isBanned !== undefined) {
      where.isBanned = isBanned;
    }
    if (platform) {
      where.platform = platform;
    }

    const [accounts, total] = await Promise.all([
      this.prisma.platformAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.platformAccount.count({ where }),
    ]);

    return {
      data: accounts.map(this.mapToDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<PlatformAccountDto> {
    const account = await this.prisma.platformAccount.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return this.mapToDto(account);
  }

  async setBanStatus(id: string, isBanned: boolean, banReason?: string): Promise<PlatformAccountDto> {
    const account = await this.prisma.platformAccount.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    const updated = await this.prisma.platformAccount.update({
      where: { id },
      data: {
        isBanned,
        bannedAt: isBanned ? new Date() : null,
        banReason: isBanned ? (banReason ?? null) : null,
      },
    });

    this.logger.log(
      `Account ${id} (${account.platform}/${account.platformUserId}) ban status set to ${isBanned}`,
    );
    return this.mapToDto(updated);
  }

  async getStats(): Promise<AccountStatsDto> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalAccounts, activeAccounts, bannedAccounts, newAccountsToday, verifiedAccounts, aggregates, platformGroups] =
      await Promise.all([
        this.prisma.platformAccount.count(),
        this.prisma.platformAccount.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
        this.prisma.platformAccount.count({ where: { isBanned: true } }),
        this.prisma.platformAccount.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.platformAccount.count({ where: { verifiedAt: { not: null } } }),
        this.prisma.platformAccount.aggregate({ _sum: { messageCount: true, commandCount: true } }),
        this.prisma.platformAccount.groupBy({ by: ['platform'], _count: { id: true } }),
      ]);

    const platformBreakdown: Record<string, number> = {};
    for (const group of platformGroups) {
      platformBreakdown[group.platform] = group._count.id;
    }

    return {
      totalAccounts,
      activeAccounts,
      bannedAccounts,
      newAccountsToday,
      verifiedAccounts,
      totalMessages: aggregates._sum.messageCount ?? 0,
      totalCommands: aggregates._sum.commandCount ?? 0,
      platformBreakdown,
    };
  }

  private mapToDto(account: any): PlatformAccountDto {
    return {
      id: account.id,
      platform: account.platform,
      platformUserId: account.platformUserId,
      identityId: account.identityId ?? undefined,
      username: account.username ?? undefined,
      firstName: account.firstName ?? undefined,
      lastName: account.lastName ?? undefined,
      metadata: account.metadata ?? undefined,
      isBanned: account.isBanned,
      bannedAt: account.bannedAt ?? undefined,
      banReason: account.banReason ?? undefined,
      messageCount: account.messageCount,
      commandCount: account.commandCount,
      isVerified: account.isVerified,
      verifiedAt: account.verifiedAt ?? undefined,
      lastSeenAt: account.lastSeenAt ?? undefined,
      lastMessageAt: account.lastMessageAt ?? undefined,
      referralCode: account.referralCode ?? undefined,
      referredByAccountId: account.referredByAccountId ?? undefined,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
