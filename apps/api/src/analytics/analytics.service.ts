import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyticsTimeSeriesDto,
  AnalyticsSummaryDto,
  AnalyticsOverviewDto,
  AggregatedPeriodDto,
  Granularity,
} from './dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getTimeSeries(
    groupId: string,
    from?: string,
    to?: string,
    granularity?: Granularity,
  ): Promise<AnalyticsTimeSeriesDto> {
    const group = await this.prisma.managedGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    const where: any = { groupId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const snapshots = await this.prisma.groupAnalyticsSnapshot.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // Aggregate by granularity if needed
    const data = this.aggregateByGranularity(snapshots, granularity || Granularity.DAY);

    return {
      groupId,
      data: data.map((s) => ({
        date: s.date instanceof Date ? s.date.toISOString() : s.date,
        memberCount: s.memberCount,
        newMembers: s.newMembers,
        leftMembers: s.leftMembers,
        messageCount: s.messageCount,
        spamDetected: s.spamDetected,
        linksBlocked: s.linksBlocked,
        warningsIssued: s.warningsIssued,
        mutesIssued: s.mutesIssued,
        bansIssued: s.bansIssued,
        deletedMessages: s.deletedMessages,
      })),
    };
  }

  async getSummary(groupId: string): Promise<AnalyticsSummaryDto> {
    const group = await this.prisma.managedGroup.findUnique({
      where: { id: groupId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [last7d, last30d, allTime] = await Promise.all([
      this.aggregatePeriod(groupId, sevenDaysAgo),
      this.aggregatePeriod(groupId, thirtyDaysAgo),
      this.aggregatePeriod(groupId),
    ]);

    return {
      groupId,
      groupTitle: group.title || `Chat ${group.chatId.toString()}`,
      currentMemberCount: group._count.members,
      last7d,
      last30d,
      allTime,
    };
  }

  async getOverview(): Promise<AnalyticsOverviewDto> {
    const groups = await this.prisma.managedGroup.findMany({
      where: { isActive: true },
      include: { _count: { select: { members: true } } },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySnapshots = await this.prisma.groupAnalyticsSnapshot.findMany({
      where: { date: { gte: today } },
    });

    const snapshotMap = new Map<string, typeof todaySnapshots[number]>();
    for (const s of todaySnapshots) {
      snapshotMap.set(s.groupId, s);
    }

    let totalMembers = 0;
    let totalMessagesToday = 0;
    let totalSpamToday = 0;
    let totalModerationToday = 0;

    const groupItems = groups.map((g) => {
      const snap = snapshotMap.get(g.id);
      const memberCount = g._count.members;
      const messagesToday = snap?.messageCount ?? 0;
      const spamToday = snap?.spamDetected ?? 0;
      const moderationToday =
        (snap?.warningsIssued ?? 0) +
        (snap?.mutesIssued ?? 0) +
        (snap?.bansIssued ?? 0);

      totalMembers += memberCount;
      totalMessagesToday += messagesToday;
      totalSpamToday += spamToday;
      totalModerationToday += moderationToday;

      return {
        groupId: g.id,
        title: g.title || `Chat ${g.chatId.toString()}`,
        memberCount,
        messagesToday,
        spamToday,
        moderationToday,
      };
    });

    return {
      totalGroups: groups.length,
      totalMembers,
      totalMessagesToday,
      totalSpamToday,
      totalModerationToday,
      groups: groupItems,
    };
  }

  private async aggregatePeriod(
    groupId: string,
    since?: Date,
  ): Promise<AggregatedPeriodDto> {
    const where: any = { groupId };
    if (since) {
      where.date = { gte: since };
    }

    const result = await this.prisma.groupAnalyticsSnapshot.aggregate({
      where,
      _sum: {
        messageCount: true,
        spamDetected: true,
        linksBlocked: true,
        warningsIssued: true,
        mutesIssued: true,
        bansIssued: true,
        deletedMessages: true,
        newMembers: true,
        leftMembers: true,
      },
    });

    const s = result._sum;
    return {
      totalMessages: s.messageCount ?? 0,
      totalSpam: s.spamDetected ?? 0,
      totalLinksBlocked: s.linksBlocked ?? 0,
      totalWarnings: s.warningsIssued ?? 0,
      totalMutes: s.mutesIssued ?? 0,
      totalBans: s.bansIssued ?? 0,
      totalDeleted: s.deletedMessages ?? 0,
      memberGrowth: (s.newMembers ?? 0) - (s.leftMembers ?? 0),
    };
  }

  async getTimeSeriesForExport(
    groupId: string,
    from?: string,
    to?: string,
  ): Promise<any[]> {
    const group = await this.prisma.managedGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    const where: any = { groupId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    return this.prisma.groupAnalyticsSnapshot.findMany({
      where,
      take: 10_000,
      orderBy: { date: 'asc' },
      include: { group: { select: { title: true } } },
    });
  }

  private aggregateByGranularity(snapshots: any[], granularity: Granularity) {
    if (granularity === Granularity.DAY) {
      return snapshots;
    }

    const buckets = new Map<string, any>();

    for (const snap of snapshots) {
      const d = new Date(snap.date);
      let key: string;

      if (granularity === Granularity.WEEK) {
        // Group by ISO week start (Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(d);
        weekStart.setDate(diff);
        key = weekStart.toISOString().slice(0, 10);
      } else {
        // Month
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (!buckets.has(key)) {
        buckets.set(key, {
          date: key,
          memberCount: 0,
          newMembers: 0,
          leftMembers: 0,
          messageCount: 0,
          spamDetected: 0,
          linksBlocked: 0,
          warningsIssued: 0,
          mutesIssued: 0,
          bansIssued: 0,
          deletedMessages: 0,
        });
      }

      const b = buckets.get(key)!;
      // Use latest member count
      b.memberCount = snap.memberCount;
      b.newMembers += snap.newMembers;
      b.leftMembers += snap.leftMembers;
      b.messageCount += snap.messageCount;
      b.spamDetected += snap.spamDetected;
      b.linksBlocked += snap.linksBlocked;
      b.warningsIssued += snap.warningsIssued;
      b.mutesIssued += snap.mutesIssued;
      b.bansIssued += snap.bansIssued;
      b.deletedMessages += snap.deletedMessages;
    }

    return Array.from(buckets.values());
  }
}
