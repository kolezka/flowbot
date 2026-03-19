import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CommunityMemberDto,
  CommunityMemberListResponseDto,
} from './dto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    communityId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    role?: string,
  ): Promise<CommunityMemberListResponseDto> {
    const skip = (page - 1) * limit;
    const where: any = { communityId };

    if (role) {
      where.role = role;
    }

    if (search) {
      where.platformAccount = {
        username: { contains: search, mode: 'insensitive' },
      };
    }

    const [members, total] = await Promise.all([
      this.prisma.communityMember.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastSeenAt: 'desc' },
        include: { platformAccount: true },
      }),
      this.prisma.communityMember.count({ where }),
    ]);

    return {
      data: members.map((m) => this.mapToDto(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(communityId: string, memberId: string): Promise<CommunityMemberDto> {
    const member = await this.prisma.communityMember.findFirst({
      where: { id: memberId, communityId },
      include: { platformAccount: true },
    });

    if (!member) {
      throw new NotFoundException(
        `Member with ID ${memberId} not found in community ${communityId}`,
      );
    }

    return this.mapToDto(member);
  }

  async updateRole(
    communityId: string,
    memberId: string,
    role: string,
  ): Promise<CommunityMemberDto> {
    const existing = await this.prisma.communityMember.findFirst({
      where: { id: memberId, communityId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Member with ID ${memberId} not found in community ${communityId}`,
      );
    }

    const updated = await this.prisma.communityMember.update({
      where: { id: memberId },
      data: { role },
      include: { platformAccount: true },
    });

    return this.mapToDto(updated);
  }

  private mapToDto(member: any): CommunityMemberDto {
    return {
      id: member.id,
      communityId: member.communityId,
      platformAccountId: member.platformAccountId,
      platform: member.platformAccount?.platform ?? undefined,
      username: member.platformAccount?.username ?? undefined,
      role: member.role,
      messageCount: member.messageCount,
      joinedAt: member.joinedAt,
      warningCount: member.warningCount,
      isMuted: member.isMuted,
      muteExpiresAt: member.muteExpiresAt ?? undefined,
      isQuarantined: member.isQuarantined,
      quarantineExpiresAt: member.quarantineExpiresAt ?? undefined,
      lastSeenAt: member.lastSeenAt,
      createdAt: member.createdAt,
    };
  }
}
