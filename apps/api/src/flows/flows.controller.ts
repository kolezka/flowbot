import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FlowsService } from './flows.service';
import { CorrelationService } from './correlation.service';
import { CreateFlowDto, UpdateFlowDto } from './dto';
import { FLOW_TEMPLATES, getFlowTemplate } from './flow-templates';
import { Public } from '../auth/public.decorator';
import type { FlowTriggerEvent } from './flow-trigger-event';

@ApiTags('Flows')
@Controller('api/flows')
export class FlowsController {
  private readonly logger = new Logger(FlowsController.name);

  constructor(
    private readonly service: FlowsService,
    private readonly correlationService: CorrelationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all flow definitions' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status (draft, active, inactive)',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of flows' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
      status,
    );
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get global flow analytics' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to look back (default 30)',
  })
  @ApiResponse({ status: 200, description: 'Global flow analytics data' })
  getGlobalAnalytics(@Query('days') days?: string) {
    return this.service.getGlobalAnalytics(days ? parseInt(days) : undefined);
  }

  @Get('user-context/:telegramId')
  @ApiOperation({ summary: 'Get correlated user context across bots' })
  @ApiParam({
    name: 'telegramId',
    type: String,
    description: 'Telegram user ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Unified user data from User and UserIdentity tables',
  })
  getUserContext(@Param('telegramId') telegramId: string) {
    return this.correlationService.getCorrelatedContext(BigInt(telegramId));
  }

  @Get('trigger-registry')
  @ApiOperation({
    summary: 'Get active flow trigger registry for bot matching',
  })
  @ApiResponse({ status: 200, description: 'Trigger registry with version' })
  getTriggerRegistry() {
    return this.service.getTriggerRegistry();
  }

  @Get('trigger-registry/version')
  @ApiOperation({ summary: 'Get trigger registry version number' })
  @ApiResponse({ status: 200, description: 'Registry version' })
  getTriggerRegistryVersion() {
    return this.service.getTriggerRegistryVersion();
  }

  @Get('context-keys')
  @ApiOperation({
    summary: 'Get distinct context keys for variable autocomplete',
  })
  @ApiResponse({
    status: 200,
    description: 'List of context keys with usage counts',
  })
  getContextKeys() {
    return this.service.getContextKeys();
  }

  // --- Flow Folders ---

  @Post('folders')
  @ApiOperation({ summary: 'Create a flow folder' })
  @ApiResponse({ status: 201, description: 'Folder created' })
  createFolder(@Body() body: { name: string; parentId?: string }) {
    return this.service.createFolder(body.name, body.parentId);
  }

  @Get('folders')
  @ApiOperation({ summary: 'Get all flow folders as tree' })
  @ApiResponse({ status: 200, description: 'Folder tree with flows' })
  getFolders() {
    return this.service.getFolders();
  }

  @Patch('folders/:folderId')
  @ApiOperation({ summary: 'Update a flow folder' })
  @ApiParam({ name: 'folderId', type: String })
  updateFolder(
    @Param('folderId') id: string,
    @Body() body: { name?: string; parentId?: string; order?: number },
  ) {
    return this.service.updateFolder(id, body);
  }

  @Delete('folders/:folderId')
  @ApiOperation({ summary: 'Delete a flow folder (moves flows to root)' })
  @ApiParam({ name: 'folderId', type: String })
  deleteFolder(@Param('folderId') id: string) {
    return this.service.deleteFolder(id);
  }

  @Get('executions/:executionId')
  @ApiOperation({ summary: 'Get a single execution by ID' })
  @ApiParam({ name: 'executionId', type: String, description: 'Execution ID' })
  @ApiResponse({ status: 200, description: 'Execution details' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  getExecution(@Param('executionId') executionId: string) {
    return this.service.getExecution(executionId);
  }

  // --- Flow Templates ---

  @Get('templates')
  @ApiOperation({ summary: 'List all available flow templates' })
  @ApiResponse({ status: 200, description: 'List of flow templates' })
  getTemplates() {
    return FLOW_TEMPLATES.map(
      ({ id, name, description, category, platform, nodes }) => ({
        id,
        name,
        description,
        category,
        platform,
        nodeCount: nodes.length,
      }),
    );
  }

  @Get('templates/:templateId')
  @ApiOperation({
    summary: 'Get a flow template by ID (with full node/edge data)',
  })
  @ApiParam({ name: 'templateId', type: String, description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Full template with nodes and edges',
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  getTemplateById(@Param('templateId') templateId: string) {
    const template = getFlowTemplate(templateId);
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  @Post('from-template/:templateId')
  @ApiOperation({ summary: 'Create a new flow pre-populated from a template' })
  @ApiParam({ name: 'templateId', type: String, description: 'Template ID' })
  @ApiResponse({ status: 201, description: 'Flow created from template' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  createFromTemplate(@Param('templateId') templateId: string) {
    const template = getFlowTemplate(templateId);
    if (!template) throw new NotFoundException('Template not found');
    return this.service.createFromTemplate(template);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a flow definition by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID (CUID)' })
  @ApiResponse({ status: 200, description: 'Flow definition' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  findOne(@Param('id') id: string) {
    // Reject reserved sub-route names that shouldn't match :id
    const reserved = [
      'analytics',
      'webhook',
      'user-context',
      'executions',
      'trigger-registry',
      'context-keys',
      'folders',
      'templates',
      'from-template',
      'debug',
    ];
    if (reserved.includes(id)) {
      throw new NotFoundException(`Flow not found`);
    }
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new flow definition' })
  @ApiResponse({ status: 201, description: 'Flow created' })
  create(@Body() dto: CreateFlowDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a flow definition' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow updated' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  update(@Param('id') id: string, @Body() dto: UpdateFlowDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a flow definition' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow deleted' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate a flow definition' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({
    status: 200,
    description: 'Validation result with errors array',
  })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  validate(@Param('id') id: string) {
    return this.service.validate(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a flow (validates first)' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow activated' })
  @ApiResponse({ status: 400, description: 'Flow validation failed' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Flow deactivated' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'List executions for a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of executions' })
  getExecutions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getExecutions(
      id,
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
    );
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

  @Get(':id/versions/:versionId')
  @ApiOperation({ summary: 'Get a specific version of a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiParam({ name: 'versionId', type: String, description: 'Version ID' })
  @ApiResponse({ status: 200, description: 'Flow version detail' })
  @ApiResponse({ status: 404, description: 'Flow or version not found' })
  getVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.service.getVersion(id, versionId);
  }

  @Post(':id/versions/:versionId/restore')
  @ApiOperation({ summary: 'Restore a flow to a specific version' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiParam({
    name: 'versionId',
    type: String,
    description: 'Version ID to restore',
  })
  @ApiResponse({ status: 200, description: 'Flow restored to version' })
  @ApiResponse({ status: 404, description: 'Flow or version not found' })
  restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
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

  @Post(':id/test-execute')
  @ApiOperation({ summary: 'Start a test execution of a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 201, description: 'Execution started' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  testExecute(@Param('id') id: string, @Body() body: { triggerData?: any }) {
    return this.service.testExecute(id, body.triggerData);
  }

  @Put(':id/draft')
  @ApiOperation({ summary: 'Save draft state for a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Draft saved' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  async saveDraft(
    @Param('id') id: string,
    @Body() body: { nodesJson: unknown; edgesJson: unknown },
  ) {
    await this.service.saveDraft(id, body);
    return { success: true };
  }

  @Get(':id/draft')
  @ApiOperation({ summary: 'Get draft state for a flow' })
  @ApiParam({ name: 'id', type: String, description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Draft data or null' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  getDraft(@Param('id') id: string) {
    return this.service.getDraft(id);
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
