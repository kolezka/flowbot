import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import {
  AutomationJobDto,
  AutomationJobListResponseDto,
  AutomationStatsDto,
  ClientLogListResponseDto,
  CreateOrderEventDto,
  OrderEventDto,
  OrderEventListResponseDto,
} from './dto';

@ApiTags('automation')
@Controller('api/automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('health')
  @ApiOperation({ summary: 'Get TG client health and metrics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns aggregated health status',
  })
  async getHealth() {
    return this.automationService.getHealth();
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get paginated list of automation jobs' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of automation jobs',
    type: AutomationJobListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getJobs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ): Promise<AutomationJobListResponseDto> {
    return this.automationService.getJobs(page, limit, status);
  }

  @Get('jobs/stats')
  @ApiOperation({ summary: 'Get automation job statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns job statistics (total, pending, completed, failed)',
    type: AutomationStatsDto,
  })
  async getStats(): Promise<AutomationStatsDto> {
    return this.automationService.getStats();
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get automation job by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns a single automation job',
    type: AutomationJobDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async getJob(@Param('id') id: string): Promise<AutomationJobDto> {
    return this.automationService.getJob(id);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get paginated client logs' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of client logs',
    type: ClientLogListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'level', required: false, type: String })
  async getLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('level') level?: string,
  ): Promise<ClientLogListResponseDto> {
    return this.automationService.getLogs(page, limit, level);
  }

  @Post('order-events')
  @ApiOperation({ summary: 'Create an order event and trigger notification' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order event created and notification triggered',
    type: OrderEventDto,
  })
  async createOrderEvent(
    @Body() dto: CreateOrderEventDto,
  ): Promise<OrderEventDto> {
    return this.automationService.createOrderEvent(dto);
  }

  @Get('order-events')
  @ApiOperation({ summary: 'Get paginated order events' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of order events',
    type: OrderEventListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'processed', required: false, type: Boolean })
  async getOrderEvents(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('processed') processed?: string,
  ): Promise<OrderEventListResponseDto> {
    const processedBool = processed !== undefined ? processed === 'true' : undefined;
    return this.automationService.getOrderEvents(page, limit, processedBool);
  }
}
