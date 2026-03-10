import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BotConfigService } from './bot-config.service';
import {
  CreateBotInstanceDto, UpdateBotInstanceDto,
  CreateBotCommandDto, UpdateBotCommandDto,
  CreateBotResponseDto, UpdateBotResponseDto,
  CreateBotMenuDto,
  CreateBotMenuButtonDto, UpdateBotMenuButtonDto,
  CreateI18nStringDto, UpdateI18nStringDto, BatchUpdateI18nStringDto,
} from './dto';

@ApiTags('Bot Config')
@Controller('api/bot-config')
export class BotConfigController {
  constructor(private readonly service: BotConfigService) {}

  // Bot Instances
  @Get()
  @ApiOperation({ summary: 'List all bot instances' })
  @ApiResponse({ status: 200, description: 'List of bot instances' })
  findAllBots() { return this.service.findAllBots(); }

  @Get(':botId')
  @ApiOperation({ summary: 'Get a bot instance by ID' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'Bot instance details' })
  @ApiResponse({ status: 404, description: 'Bot instance not found' })
  findBot(@Param('botId') botId: string) { return this.service.findBot(botId); }

  @Post()
  @ApiOperation({ summary: 'Create a new bot instance' })
  @ApiResponse({ status: 201, description: 'Bot instance created' })
  createBot(@Body() dto: CreateBotInstanceDto) { return this.service.createBot(dto); }

  @Patch(':botId')
  @ApiOperation({ summary: 'Update a bot instance' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'Bot instance updated' })
  @ApiResponse({ status: 404, description: 'Bot instance not found' })
  updateBot(@Param('botId') botId: string, @Body() dto: UpdateBotInstanceDto) { return this.service.updateBot(botId, dto); }

  @Delete(':botId')
  @ApiOperation({ summary: 'Delete a bot instance' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'Bot instance deleted' })
  @ApiResponse({ status: 404, description: 'Bot instance not found' })
  deleteBot(@Param('botId') botId: string) { return this.service.deleteBot(botId); }

  // Commands
  @Get(':botId/commands')
  @ApiOperation({ summary: 'List commands for a bot' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'List of bot commands' })
  findCommands(@Param('botId') botId: string) { return this.service.findCommands(botId); }

  @Post(':botId/commands')
  @ApiOperation({ summary: 'Create a command for a bot' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 201, description: 'Command created' })
  createCommand(@Param('botId') botId: string, @Body() dto: CreateBotCommandDto) { return this.service.createCommand(botId, dto); }

  @Patch(':botId/commands/:commandId')
  @ApiOperation({ summary: 'Update a bot command' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'commandId', type: String, description: 'Command ID' })
  @ApiResponse({ status: 200, description: 'Command updated' })
  updateCommand(@Param('botId') botId: string, @Param('commandId') commandId: string, @Body() dto: UpdateBotCommandDto) { return this.service.updateCommand(botId, commandId, dto); }

  @Delete(':botId/commands/:commandId')
  @ApiOperation({ summary: 'Delete a bot command' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'commandId', type: String, description: 'Command ID' })
  @ApiResponse({ status: 200, description: 'Command deleted' })
  deleteCommand(@Param('botId') botId: string, @Param('commandId') commandId: string) { return this.service.deleteCommand(botId, commandId); }

  // Responses
  @Get(':botId/responses')
  @ApiOperation({ summary: 'List responses for a bot' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiQuery({ name: 'locale', required: false, type: String, description: 'Filter by locale' })
  @ApiResponse({ status: 200, description: 'List of bot responses' })
  findResponses(@Param('botId') botId: string, @Query('locale') locale?: string) { return this.service.findResponses(botId, locale); }

  @Post(':botId/responses')
  @ApiOperation({ summary: 'Create a response for a bot' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 201, description: 'Response created' })
  createResponse(@Param('botId') botId: string, @Body() dto: CreateBotResponseDto) { return this.service.createResponse(botId, dto); }

  @Patch(':botId/responses/:responseId')
  @ApiOperation({ summary: 'Update a bot response' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'responseId', type: String, description: 'Response ID' })
  @ApiResponse({ status: 200, description: 'Response updated' })
  updateResponse(@Param('botId') botId: string, @Param('responseId') responseId: string, @Body() dto: UpdateBotResponseDto) { return this.service.updateResponse(botId, responseId, dto); }

  @Delete(':botId/responses/:responseId')
  @ApiOperation({ summary: 'Delete a bot response' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'responseId', type: String, description: 'Response ID' })
  @ApiResponse({ status: 200, description: 'Response deleted' })
  deleteResponse(@Param('botId') botId: string, @Param('responseId') responseId: string) { return this.service.deleteResponse(botId, responseId); }

  // Menus
  @Get(':botId/menus')
  @ApiOperation({ summary: 'List menus for a bot' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'List of bot menus' })
  findMenus(@Param('botId') botId: string) { return this.service.findMenus(botId); }

  @Post(':botId/menus')
  @ApiOperation({ summary: 'Create a menu for a bot' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 201, description: 'Menu created' })
  createMenu(@Param('botId') botId: string, @Body() dto: CreateBotMenuDto) { return this.service.createMenu(botId, dto); }

  @Delete(':botId/menus/:menuId')
  @ApiOperation({ summary: 'Delete a bot menu' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'menuId', type: String, description: 'Menu ID' })
  @ApiResponse({ status: 200, description: 'Menu deleted' })
  deleteMenu(@Param('botId') botId: string, @Param('menuId') menuId: string) { return this.service.deleteMenu(botId, menuId); }

  // Menu Buttons
  @Post(':botId/menus/:menuId/buttons')
  @ApiOperation({ summary: 'Add a button to a menu' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'menuId', type: String, description: 'Menu ID' })
  @ApiResponse({ status: 201, description: 'Button added' })
  addButton(@Param('botId') botId: string, @Param('menuId') menuId: string, @Body() dto: CreateBotMenuButtonDto) { return this.service.addMenuButton(botId, menuId, dto); }

  @Patch(':botId/menus/:menuId/buttons/:buttonId')
  @ApiOperation({ summary: 'Update a menu button' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'menuId', type: String, description: 'Menu ID' })
  @ApiParam({ name: 'buttonId', type: String, description: 'Button ID' })
  @ApiResponse({ status: 200, description: 'Button updated' })
  updateButton(@Param('botId') botId: string, @Param('menuId') menuId: string, @Param('buttonId') buttonId: string, @Body() dto: UpdateBotMenuButtonDto) { return this.service.updateMenuButton(botId, menuId, buttonId, dto); }

  @Delete(':botId/menus/:menuId/buttons/:buttonId')
  @ApiOperation({ summary: 'Delete a menu button' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'menuId', type: String, description: 'Menu ID' })
  @ApiParam({ name: 'buttonId', type: String, description: 'Button ID' })
  @ApiResponse({ status: 200, description: 'Button deleted' })
  deleteButton(@Param('botId') botId: string, @Param('menuId') menuId: string, @Param('buttonId') buttonId: string) { return this.service.deleteMenuButton(botId, menuId, buttonId); }

  // I18n Strings
  @Get(':botId/i18n')
  @ApiOperation({ summary: 'List i18n strings for a bot' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiQuery({ name: 'locale', required: false, type: String, description: 'Filter by locale' })
  @ApiResponse({ status: 200, description: 'List of i18n strings' })
  findI18nStrings(@Param('botId') botId: string, @Query('locale') locale?: string) { return this.service.findI18nStrings(botId, locale); }

  @Post(':botId/i18n')
  @ApiOperation({ summary: 'Create an i18n string for a bot' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 201, description: 'I18n string created' })
  createI18nString(@Param('botId') botId: string, @Body() dto: CreateI18nStringDto) { return this.service.createI18nString(botId, dto); }

  @Post(':botId/i18n/batch')
  @ApiOperation({ summary: 'Batch update i18n strings (upsert by key+locale)' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'Batch update result' })
  batchUpdateI18nStrings(@Param('botId') botId: string, @Body() items: BatchUpdateI18nStringDto[]) { return this.service.batchUpdateI18nStrings(botId, items); }

  @Patch(':botId/i18n/:stringId')
  @ApiOperation({ summary: 'Update an i18n string' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'stringId', type: String, description: 'I18n string ID' })
  @ApiResponse({ status: 200, description: 'I18n string updated' })
  updateI18nString(@Param('botId') botId: string, @Param('stringId') stringId: string, @Body() dto: UpdateI18nStringDto) { return this.service.updateI18nString(botId, stringId, dto); }

  @Delete(':botId/i18n/:stringId')
  @ApiOperation({ summary: 'Delete an i18n string' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiParam({ name: 'stringId', type: String, description: 'I18n string ID' })
  @ApiResponse({ status: 200, description: 'I18n string deleted' })
  deleteI18nString(@Param('botId') botId: string, @Param('stringId') stringId: string) { return this.service.deleteI18nString(botId, stringId); }

  // Config versioning
  @Post(':botId/publish')
  @ApiOperation({ summary: 'Publish bot configuration (increment version)' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'Config published' })
  @ApiResponse({ status: 404, description: 'Bot instance not found' })
  publishConfig(@Param('botId') botId: string) { return this.service.publishConfig(botId); }

  @Get(':botId/version')
  @ApiOperation({ summary: 'Get current config version' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'Current config version number' })
  @ApiResponse({ status: 404, description: 'Bot instance not found' })
  getVersion(@Param('botId') botId: string) { return this.service.getConfigVersion(botId); }

  @Get(':botId/versions')
  @ApiOperation({ summary: 'Get config version history' })
  @ApiParam({ name: 'botId', type: String, description: 'Bot instance ID' })
  @ApiResponse({ status: 200, description: 'List of config versions' })
  @ApiResponse({ status: 404, description: 'Bot instance not found' })
  getVersionHistory(@Param('botId') botId: string) { return this.service.getConfigVersionHistory(botId); }
}
