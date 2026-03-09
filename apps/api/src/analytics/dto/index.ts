import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsEnum } from 'class-validator';

export class AnalyticsSnapshotDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  memberCount: number;

  @ApiProperty()
  newMembers: number;

  @ApiProperty()
  leftMembers: number;

  @ApiProperty()
  messageCount: number;

  @ApiProperty()
  spamDetected: number;

  @ApiProperty()
  linksBlocked: number;

  @ApiProperty()
  warningsIssued: number;

  @ApiProperty()
  mutesIssued: number;

  @ApiProperty()
  bansIssued: number;

  @ApiProperty()
  deletedMessages: number;
}

export class AnalyticsTimeSeriesDto {
  @ApiProperty()
  groupId: string;

  @ApiProperty({ type: [AnalyticsSnapshotDto] })
  data: AnalyticsSnapshotDto[];
}

export class AggregatedPeriodDto {
  @ApiProperty()
  totalMessages: number;

  @ApiProperty()
  totalSpam: number;

  @ApiProperty()
  totalLinksBlocked: number;

  @ApiProperty()
  totalWarnings: number;

  @ApiProperty()
  totalMutes: number;

  @ApiProperty()
  totalBans: number;

  @ApiProperty()
  totalDeleted: number;

  @ApiProperty()
  memberGrowth: number;
}

export class AnalyticsSummaryDto {
  @ApiProperty()
  groupId: string;

  @ApiProperty()
  groupTitle: string;

  @ApiProperty()
  currentMemberCount: number;

  @ApiProperty()
  last7d: AggregatedPeriodDto;

  @ApiProperty()
  last30d: AggregatedPeriodDto;

  @ApiProperty()
  allTime: AggregatedPeriodDto;
}

export class GroupOverviewItemDto {
  @ApiProperty()
  groupId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  memberCount: number;

  @ApiProperty()
  messagesToday: number;

  @ApiProperty()
  spamToday: number;

  @ApiProperty()
  moderationToday: number;
}

export class AnalyticsOverviewDto {
  @ApiProperty()
  totalGroups: number;

  @ApiProperty()
  totalMembers: number;

  @ApiProperty()
  totalMessagesToday: number;

  @ApiProperty()
  totalSpamToday: number;

  @ApiProperty()
  totalModerationToday: number;

  @ApiProperty({ type: [GroupOverviewItemDto] })
  groups: GroupOverviewItemDto[];
}

export enum Granularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class TimeSeriesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: Granularity })
  @IsOptional()
  @IsEnum(Granularity)
  granularity?: Granularity;
}
