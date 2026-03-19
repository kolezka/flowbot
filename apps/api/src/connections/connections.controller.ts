import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import {
  CreateConnectionDto,
  UpdateStatusDto,
  StartAuthDto,
  SubmitAuthStepDto,
} from './dto';

@ApiTags('Connections')
@Controller('api/connections')
export class ConnectionsController {
  constructor(private readonly service: ConnectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all connections' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of connections' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      platform,
      status,
    );
  }

  @Get('health')
  @ApiOperation({ summary: 'Get connections health overview' })
  @ApiResponse({ status: 200, description: 'Health summary by platform' })
  getHealth() {
    return this.service.getHealth();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a connection by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Connection details' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new connection' })
  @ApiResponse({ status: 201, description: 'Connection created' })
  create(@Body() dto: CreateConnectionDto) {
    return this.service.create(dto);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update connection status' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto.status, dto.errorMessage);
  }

  @Post(':id/auth/start')
  @ApiOperation({ summary: 'Start authentication flow for a connection' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Auth flow started' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  startAuth(@Param('id') id: string, @Body() dto: StartAuthDto) {
    return this.service.startAuth(id, dto.params);
  }

  @Post(':id/auth/step')
  @ApiOperation({ summary: 'Submit an auth step' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Auth step submitted' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  submitAuthStep(@Param('id') id: string, @Body() dto: SubmitAuthStepDto) {
    return this.service.submitAuthStep(id, dto.step, dto.data);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get logs for a connection' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated connection logs' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  getLogs(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getLogs(
      id,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a connection' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Connection deactivated' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
