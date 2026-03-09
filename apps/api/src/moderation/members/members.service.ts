import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MemberDto,
  MemberDetailDto,
  MemberListResponseDto,
  MemberWarningDto,
} from './dto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    groupId: string,
    page: number = 1,
    limit: number = 20,
    role?: string,
  ): Promise<MemberListResponseDto> {
    const group = await this.prisma.managedGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    const skip = (page - 1) * limit;
    const where: any = { groupId };

    if (role) {
      where.role = role;
    }

    const [members, total] = await Promise.all([
      this.prisma.groupMember.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastSeenAt: 'desc' },
      }),
      this.prisma.groupMember.count({ where }),
    ]);

    return {
      data: members.map((m) => this.mapToDto(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(groupId: string, memberId: string): Promise<MemberDetailDto> {
    const member = await this.prisma.groupMember.findFirst({
      where: { id: memberId, groupId },
      include: {
        warnings: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(
        `Member with ID ${memberId} not found in group ${groupId}`,
      );
    }

    return {
      ...this.mapToDto(member),
      warnings: member.warnings.map((w) => this.mapWarningToDto(w)),
    };
  }

  private mapToDto(member: any): MemberDto {
    return {
      id: member.id,
      groupId: member.groupId,
      telegramId: member.telegramId.toString(),
      role: member.role,
      joinedAt: member.joinedAt,
      messageCount: member.messageCount,
      lastSeenAt: member.lastSeenAt,
      isQuarantined: member.isQuarantined,
      quarantineExpiresAt: member.quarantineExpiresAt ?? undefined,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }

  private mapWarningToDto(warning: any): MemberWarningDto {
    return {
      id: warning.id,
      issuerId: warning.issuerId.toString(),
      reason: warning.reason ?? undefined,
      isActive: warning.isActive,
      expiresAt: warning.expiresAt ?? undefined,
      createdAt: warning.createdAt,
    };
  }
}
