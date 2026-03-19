import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserIdentityDto, UserIdentityListResponseDto } from './dto';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 20, search?: string): Promise<UserIdentityListResponseDto> {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { platformAccounts: { some: { username: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [identities, total] = await Promise.all([
      this.prisma.userIdentity.findMany({
        where,
        skip,
        take: limit,
        include: { platformAccounts: true },
        orderBy: { firstSeenAt: 'desc' },
      }),
      this.prisma.userIdentity.count({ where }),
    ]);

    return {
      data: identities.map((i) => this.mapToDto(i)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<UserIdentityDto> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id },
      include: { platformAccounts: true },
    });

    if (!identity) {
      throw new NotFoundException(`Identity with ID ${id} not found`);
    }

    return this.mapToDto(identity);
  }

  async linkAccount(identityId: string, accountId: string): Promise<UserIdentityDto> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: identityId },
      include: { platformAccounts: true },
    });

    if (!identity) {
      throw new NotFoundException(`Identity with ID ${identityId} not found`);
    }

    const account = await this.prisma.platformAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    if (account.identityId !== null && account.identityId !== identityId) {
      throw new BadRequestException(
        `Account ${accountId} is already linked to another identity (${account.identityId})`,
      );
    }

    // Already linked to this identity — no-op
    if (account.identityId === identityId) {
      this.logger.log(`Account ${accountId} is already linked to identity ${identityId} — no-op`);
      return this.mapToDto(identity);
    }

    await this.prisma.platformAccount.update({
      where: { id: accountId },
      data: { identityId },
    });

    this.logger.log(`Linked account ${accountId} to identity ${identityId}`);

    const updated = await this.prisma.userIdentity.findUnique({
      where: { id: identityId },
      include: { platformAccounts: true },
    });

    return this.mapToDto(updated!);
  }

  async unlinkAccount(identityId: string, accountId: string): Promise<UserIdentityDto> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: identityId },
      include: { platformAccounts: true },
    });

    if (!identity) {
      throw new NotFoundException(`Identity with ID ${identityId} not found`);
    }

    const account = await this.prisma.platformAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    if (account.identityId !== identityId) {
      throw new BadRequestException(
        `Account ${accountId} is not linked to identity ${identityId}`,
      );
    }

    await this.prisma.platformAccount.update({
      where: { id: accountId },
      data: { identityId: null },
    });

    this.logger.log(`Unlinked account ${accountId} from identity ${identityId}`);

    const updated = await this.prisma.userIdentity.findUnique({
      where: { id: identityId },
      include: { platformAccounts: true },
    });

    return this.mapToDto(updated!);
  }

  async createIdentity(displayName?: string, email?: string): Promise<UserIdentityDto> {
    // telegramId is required (BigInt, unique) in current schema.
    // Using BigInt(0) as placeholder for non-telegram identities.
    // This will be cleaned up when User/UserIdentity models are refactored in Slice 7.
    const identity = await this.prisma.userIdentity.create({
      data: {
        telegramId: BigInt(0),
        displayName: displayName ?? null,
        email: email ?? null,
      },
      include: { platformAccounts: true },
    });

    this.logger.log(`Created identity ${identity.id}${displayName ? ` (${displayName})` : ''}`);

    return this.mapToDto(identity);
  }

  private mapToDto(identity: any): UserIdentityDto {
    return {
      id: identity.id,
      displayName: identity.displayName ?? undefined,
      email: identity.email ?? undefined,
      platformAccounts: (identity.platformAccounts ?? []).map((a: any) => ({
        id: a.id,
        platform: a.platform,
        platformUserId: a.platformUserId,
        username: a.username ?? undefined,
        firstName: a.firstName ?? undefined,
        lastName: a.lastName ?? undefined,
        isBanned: a.isBanned,
        messageCount: a.messageCount,
        isVerified: a.isVerified,
        commandCount: a.commandCount ?? 0,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        metadata: a.metadata ?? undefined,
      })),
      createdAt: identity.firstSeenAt,
    };
  }
}
