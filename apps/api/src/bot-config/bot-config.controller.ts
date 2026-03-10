import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BotConfigService } from './bot-config.service';
import {
  CreateBotInstanceDto, UpdateBotInstanceDto,
  CreateBotCommandDto, UpdateBotCommandDto,
  CreateBotResponseDto, UpdateBotResponseDto,
  CreateBotMenuDto,
  CreateBotMenuButtonDto, UpdateBotMenuButtonDto,
} from './dto';

@ApiTags('Bot Config')
@Controller('api/bot-config')
export class BotConfigController {
  constructor(private readonly service: BotConfigService) {}

  // Bot Instances
  @Get() findAllBots() { return this.service.findAllBots(); }
  @Get(':botId') findBot(@Param('botId') botId: string) { return this.service.findBot(botId); }
  @Post() createBot(@Body() dto: CreateBotInstanceDto) { return this.service.createBot(dto); }
  @Patch(':botId') updateBot(@Param('botId') botId: string, @Body() dto: UpdateBotInstanceDto) { return this.service.updateBot(botId, dto); }
  @Delete(':botId') deleteBot(@Param('botId') botId: string) { return this.service.deleteBot(botId); }

  // Commands
  @Get(':botId/commands') findCommands(@Param('botId') botId: string) { return this.service.findCommands(botId); }
  @Post(':botId/commands') createCommand(@Param('botId') botId: string, @Body() dto: CreateBotCommandDto) { return this.service.createCommand(botId, dto); }
  @Patch(':botId/commands/:commandId') updateCommand(@Param('botId') botId: string, @Param('commandId') commandId: string, @Body() dto: UpdateBotCommandDto) { return this.service.updateCommand(botId, commandId, dto); }
  @Delete(':botId/commands/:commandId') deleteCommand(@Param('botId') botId: string, @Param('commandId') commandId: string) { return this.service.deleteCommand(botId, commandId); }

  // Responses
  @Get(':botId/responses') findResponses(@Param('botId') botId: string, @Query('locale') locale?: string) { return this.service.findResponses(botId, locale); }
  @Post(':botId/responses') createResponse(@Param('botId') botId: string, @Body() dto: CreateBotResponseDto) { return this.service.createResponse(botId, dto); }
  @Patch(':botId/responses/:responseId') updateResponse(@Param('botId') botId: string, @Param('responseId') responseId: string, @Body() dto: UpdateBotResponseDto) { return this.service.updateResponse(botId, responseId, dto); }
  @Delete(':botId/responses/:responseId') deleteResponse(@Param('botId') botId: string, @Param('responseId') responseId: string) { return this.service.deleteResponse(botId, responseId); }

  // Menus
  @Get(':botId/menus') findMenus(@Param('botId') botId: string) { return this.service.findMenus(botId); }
  @Post(':botId/menus') createMenu(@Param('botId') botId: string, @Body() dto: CreateBotMenuDto) { return this.service.createMenu(botId, dto); }
  @Delete(':botId/menus/:menuId') deleteMenu(@Param('botId') botId: string, @Param('menuId') menuId: string) { return this.service.deleteMenu(botId, menuId); }

  // Menu Buttons
  @Post(':botId/menus/:menuId/buttons') addButton(@Param('botId') botId: string, @Param('menuId') menuId: string, @Body() dto: CreateBotMenuButtonDto) { return this.service.addMenuButton(botId, menuId, dto); }
  @Patch(':botId/menus/:menuId/buttons/:buttonId') updateButton(@Param('botId') botId: string, @Param('menuId') menuId: string, @Param('buttonId') buttonId: string, @Body() dto: UpdateBotMenuButtonDto) { return this.service.updateMenuButton(botId, menuId, buttonId, dto); }
  @Delete(':botId/menus/:menuId/buttons/:buttonId') deleteButton(@Param('botId') botId: string, @Param('menuId') menuId: string, @Param('buttonId') buttonId: string) { return this.service.deleteMenuButton(botId, menuId, buttonId); }

  // Config versioning
  @Post(':botId/publish') publishConfig(@Param('botId') botId: string) { return this.service.publishConfig(botId); }
  @Get(':botId/version') getVersion(@Param('botId') botId: string) { return this.service.getConfigVersion(botId); }
}
