import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WarningDto,
  WarningListResponseDto,
  WarningStatsDto,
} from './dto';

@Injectable()
export class WarningsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    groupId?: string,
    memberId?: string,
    isActive?: boolean,
  ): Promise<WarningListResponseDto> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (groupId) {
      where.groupId = groupId;
    }

    if (memberId) {
      where.memberId = memberId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [warnings, total] = await Promise.all([
      this.prisma.warning.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          group: { select: { title: true } },
        },
      }),
      this.prisma.warning.count({ where }),
    ]);

    return {
      data: warnings.map((w) => this.mapToDto(w)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deactivate(id: string): Promise<WarningDto> {
    const warning = await this.prisma.warning.findUnique({
      where: { id },
      include: { group: { select: { title: true } } },
    });

    if (!warning) {
      throw new NotFoundException(`Warning with ID ${id} not found`);
    }

    const updated = await this.prisma.warning.update({
      where: { id },
      data: { isActive: false },
      include: { group: { select: { title: true } } },
    });

    return this.mapToDto(updated);
  }

  async getStats(): Promise<WarningStatsDto> {
    const now = new Date();

    const [allWarnings, groups] = await Promise.all([
      this.prisma.warning.findMany({
        select: {
          isActive: true,
          expiresAt: true,
          groupId: true,
        },
      }),
      this.prisma.managedGroup.findMany({
        select: { id: true, title: true },
      }),
    ]);

    const groupMap = new Map<string, string | undefined>();
    for (const g of groups) {
      groupMap.set(g.id, g.title ?? undefined);
    }

    // Count by group
    const groupCounts = new Map<string, { active: number; total: number }>();
    let totalActive = 0;
    let totalExpired = 0;
    let totalDeactivated = 0;

    for (const w of allWarnings) {
      const stats = groupCounts.get(w.groupId) || { active: 0, total: 0 };
      stats.total++;

      if (w.isActive && (!w.expiresAt || w.expiresAt > now)) {
        stats.active++;
        totalActive++;
      } else if (!w.isActive) {
        totalDeactivated++;
      } else {
        totalExpired++;
      }

      groupCounts.set(w.groupId, stats);
    }

    const countsByGroup = Array.from(groupCounts.entries()).map(
      ([groupId, counts]) => ({
        groupId,
        groupTitle: groupMap.get(groupId),
        activeCount: counts.active,
        totalCount: counts.total,
      }),
    );

    return {
      countsByGroup,
      totalActive,
      totalExpired,
      totalDeactivated,
    };
  }

  private mapToDto(warning: any): WarningDto {
    return {
      id: warning.id,
      groupId: warning.groupId,
      groupTitle: warning.group?.title ?? undefined,
      memberId: warning.memberId,
      issuerId: warning.issuerId.toString(),
      reason: warning.reason ?? undefined,
      isActive: warning.isActive,
      expiresAt: warning.expiresAt ?? undefined,
      createdAt: warning.createdAt,
    };
  }
}
