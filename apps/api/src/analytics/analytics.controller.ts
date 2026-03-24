import { Controller, Get, Param, Query, Res, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsTimeSeriesDto,
  AnalyticsSummaryDto,
  AnalyticsOverviewDto,
  Granularity,
} from './dto';
import { toCsv } from '../common/csv.util';

@ApiTags('analytics')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get cross-group analytics overview' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns dashboard overview data',
    type: AnalyticsOverviewDto,
  })
  async getOverview(): Promise<AnalyticsOverviewDto> {
    return this.analyticsService.getOverview();
  }

  @Get('groups/:id')
  @ApiOperation({ summary: 'Get time series analytics for a group' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns time series data',
    type: AnalyticsTimeSeriesDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'granularity', required: false, enum: Granularity })
  async getTimeSeries(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: Granularity,
  ): Promise<AnalyticsTimeSeriesDto> {
    return this.analyticsService.getTimeSeries(id, from, to, granularity);
  }

  @Get('groups/:id/export')
  @ApiOperation({ summary: 'Export analytics time series as CSV or JSON' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'] })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async exportTimeSeries(
    @Param('id') id: string,
    @Query('format') format: string = 'csv',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const snapshots = await this.analyticsService.getTimeSeriesForExport(
      id,
      from,
      to,
    );

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      res.header('Content-Type', 'application/json');
      res.header(
        'Content-Disposition',
        `attachment; filename="analytics-${id}-${dateStr}.json"`,
      );
      return snapshots.map((s: any) => ({
        date: s.date instanceof Date ? s.date.toISOString() : s.date,
        groupTitle: s.group?.title ?? '',
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
      }));
    }

    const headers = [
      'Date',
      'Group',
      'Member Count',
      'New Members',
      'Left Members',
      'Messages',
      'Spam Detected',
      'Links Blocked',
      'Warnings',
      'Mutes',
      'Bans',
      'Deleted Messages',
    ];
    const rows = snapshots.map((s: any) => [
      s.date instanceof Date ? s.date.toISOString().slice(0, 10) : s.date,
      s.group?.title ?? '',
      s.memberCount,
      s.newMembers,
      s.leftMembers,
      s.messageCount,
      s.spamDetected,
      s.linksBlocked,
      s.warningsIssued,
      s.mutesIssued,
      s.bansIssued,
      s.deletedMessages,
    ]);

    const csv = toCsv(headers, rows);
    res.header('Content-Type', 'text/csv');
    res.header(
      'Content-Disposition',
      `attachment; filename="analytics-${id}-${dateStr}.csv"`,
    );
    return csv;
  }

  @Get('groups/:id/summary')
  @ApiOperation({ summary: 'Get 7d/30d/all-time summary for a group' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns aggregated summary',
    type: AnalyticsSummaryDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  async getSummary(@Param('id') id: string): Promise<AnalyticsSummaryDto> {
    return this.analyticsService.getSummary(id);
  }
}
