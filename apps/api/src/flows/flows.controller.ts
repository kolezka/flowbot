import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FlowsService } from './flows.service';
import { CorrelationService } from './correlation.service';
import { CreateFlowDto, UpdateFlowDto } from './dto';

@ApiTags('Flows')
@Controller('api/flows')
export class FlowsController {
  constructor(
    private readonly service: FlowsService,
    private readonly correlationService: CorrelationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all flow definitions' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status (draft, active, inactive)' })
  @ApiResponse({ status: 200, description: 'Paginated list of flows' })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('status') status?: string) {
    return this.service.findAll(page ? parseInt(page) : undefined, limit ? parseInt(limit) : undefined, status);
  }

  @Get('user-context/:telegramId')
  @ApiOperation({ summary: 'Get correlated user context across bots' })
  @ApiParam({ name: 'telegramId', type: String, description: 'Telegram user ID' })
  @ApiResponse({ status: 200, description: 'Unified user data from User and UserIdentity tables' })
  getUserContext(@Param('telegramId') telegramId: string) {
    return this.correlationService.getCorrelatedContext(BigInt(telegramId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a flow definition by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow definition' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Create a new flow definition' })
  @ApiResponse({ status: 201, description: 'Flow created' })
  create(@Body() dto: CreateFlowDto) { return this.service.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a flow definition' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow updated' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  update(@Param('id') id: string, @Body() dto: UpdateFlowDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a flow definition' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow deleted' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  delete(@Param('id') id: string) { return this.service.delete(id); }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate a flow definition' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Validation result with errors array' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  validate(@Param('id') id: string) { return this.service.validate(id); }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a flow (validates first)' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow activated' })
  @ApiResponse({ status: 400, description: 'Flow validation failed' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  activate(@Param('id') id: string) { return this.service.activate(id); }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow deactivated' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  deactivate(@Param('id') id: string) { return this.service.deactivate(id); }

  @Get(':id/executions')
  @ApiOperation({ summary: 'List executions for a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Paginated list of executions' })
  getExecutions(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.getExecutions(id, page ? parseInt(page) : undefined, limit ? parseInt(limit) : undefined);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List versions for a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'List of flow versions' })
  getVersions(@Param('id') id: string) {
    return this.service.getVersions(id);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Create a new version snapshot of a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 201, description: 'Version created' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  createVersion(@Param('id') id: string, @Body() body: { createdBy?: string }) {
    return this.service.createVersion(id, body.createdBy);
  }

  @Post(':id/versions/:versionId/restore')
  @ApiOperation({ summary: 'Restore a flow to a specific version' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiParam({ name: 'versionId', type: String, description: 'Version ID to restore' })
  @ApiResponse({ status: 200, description: 'Flow restored to version' })
  @ApiResponse({ status: 404, description: 'Flow or version not found' })
  restoreVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.service.restoreVersion(id, versionId);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get analytics for a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow analytics data' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  getAnalytics(@Param('id') id: string) {
    return this.service.getAnalytics(id);
  }

  @Post('webhook/:flowId')
  @ApiOperation({ summary: 'Trigger a flow execution via webhook' })
  @ApiParam({ name: 'flowId', type: String, description: 'Flow ID to trigger' })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  @ApiResponse({ status: 400, description: 'Flow is not active' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  async webhookIngress(@Param('flowId') flowId: string, @Body() body: any) {
    // Validate flow exists and is active
    const flow = await this.service.findOne(flowId);
    if (flow.status !== 'active') {
      throw new BadRequestException('Flow is not active');
    }

    // Trigger flow execution (would use Trigger.dev in production)
    return { received: true, flowId, timestamp: new Date() };
  }
}
