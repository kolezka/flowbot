import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsTimeSeriesDto,
  AnalyticsSummaryDto,
  AnalyticsOverviewDto,
  Granularity,
} from './dto';

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

  @Get('groups/:id/summary')
  @ApiOperation({ summary: 'Get 7d/30d/all-time summary for a group' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns aggregated summary',
    type: AnalyticsSummaryDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  async getSummary(
    @Param('id') id: string,
  ): Promise<AnalyticsSummaryDto> {
    return this.analyticsService.getSummary(id);
  }
}
