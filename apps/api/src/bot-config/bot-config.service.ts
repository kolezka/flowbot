import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBotInstanceDto,
  UpdateBotInstanceDto,
  CreateBotCommandDto,
  UpdateBotCommandDto,
  CreateBotResponseDto,
  UpdateBotResponseDto,
  CreateBotMenuDto,
  CreateBotMenuButtonDto,
  UpdateBotMenuButtonDto,
  CreateI18nStringDto,
  UpdateI18nStringDto,
  BatchUpdateI18nStringDto,
} from './dto';

@Injectable()
export class BotConfigService {
  private readonly logger = new Logger(BotConfigService.name);

  constructor(private prisma: PrismaService) {}

  // Bot Instances
  async findAllBots() {
    return this.prisma.botInstance.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { commands: true, responses: true, menus: true } } },
    });
  }

  async findBot(id: string) {
    const bot = await this.prisma.botInstance.findUnique({
      where: { id },
      include: { commands: { orderBy: { sortOrder: 'asc' } }, responses: true, menus: { include: { buttons: true } } },
    });
    if (!bot) throw new NotFoundException(`Bot instance ${id} not found`);
    return bot;
  }

  async createBot(dto: CreateBotInstanceDto) {
    return this.prisma.botInstance.create({ data: dto });
  }

  async updateBot(id: string, dto: UpdateBotInstanceDto) {
    await this.findBot(id);
    return this.prisma.botInstance.update({ where: { id }, data: dto });
  }

  async deleteBot(id: string) {
    await this.findBot(id);
    await this.prisma.botInstance.delete({ where: { id } });
    return { deleted: true };
  }

  // Commands
  async findCommands(botId: string) {
    await this.findBot(botId);
    return this.prisma.botCommand.findMany({ where: { botId }, orderBy: { sortOrder: 'asc' } });
  }

  async createCommand(botId: string, dto: CreateBotCommandDto) {
    await this.findBot(botId);
    return this.prisma.botCommand.create({ data: { ...dto, botId } });
  }

  async updateCommand(botId: string, commandId: string, dto: UpdateBotCommandDto) {
    const cmd = await this.prisma.botCommand.findFirst({ where: { id: commandId, botId } });
    if (!cmd) throw new NotFoundException(`Command ${commandId} not found`);
    return this.prisma.botCommand.update({ where: { id: commandId }, data: dto });
  }

  async deleteCommand(botId: string, commandId: string) {
    const cmd = await this.prisma.botCommand.findFirst({ where: { id: commandId, botId } });
    if (!cmd) throw new NotFoundException(`Command ${commandId} not found`);
    await this.prisma.botCommand.delete({ where: { id: commandId } });
    return { deleted: true };
  }

  // Responses
  async findResponses(botId: string, locale?: string) {
    await this.findBot(botId);
    const where: any = { botId };
    if (locale) where.locale = locale;
    return this.prisma.botResponse.findMany({ where, orderBy: { key: 'asc' } });
  }

  async createResponse(botId: string, dto: CreateBotResponseDto) {
    await this.findBot(botId);
    return this.prisma.botResponse.create({ data: { ...dto, botId } });
  }

  async updateResponse(botId: string, responseId: string, dto: UpdateBotResponseDto) {
    const resp = await this.prisma.botResponse.findFirst({ where: { id: responseId, botId } });
    if (!resp) throw new NotFoundException(`Response ${responseId} not found`);
    return this.prisma.botResponse.update({ where: { id: responseId }, data: dto });
  }

  async deleteResponse(botId: string, responseId: string) {
    const resp = await this.prisma.botResponse.findFirst({ where: { id: responseId, botId } });
    if (!resp) throw new NotFoundException(`Response ${responseId} not found`);
    await this.prisma.botResponse.delete({ where: { id: responseId } });
    return { deleted: true };
  }

  // Menus
  async findMenus(botId: string) {
    await this.findBot(botId);
    return this.prisma.botMenu.findMany({ where: { botId }, include: { buttons: { orderBy: [{ row: 'asc' }, { col: 'asc' }] } } });
  }

  async createMenu(botId: string, dto: CreateBotMenuDto) {
    await this.findBot(botId);
    return this.prisma.botMenu.create({ data: { ...dto, botId } });
  }

  async deleteMenu(botId: string, menuId: string) {
    const menu = await this.prisma.botMenu.findFirst({ where: { id: menuId, botId } });
    if (!menu) throw new NotFoundException(`Menu ${menuId} not found`);
    await this.prisma.botMenu.delete({ where: { id: menuId } });
    return { deleted: true };
  }

  async addMenuButton(botId: string, menuId: string, dto: CreateBotMenuButtonDto) {
    const menu = await this.prisma.botMenu.findFirst({ where: { id: menuId, botId } });
    if (!menu) throw new NotFoundException(`Menu ${menuId} not found`);
    return this.prisma.botMenuButton.create({ data: { ...dto, menuId } });
  }

  async updateMenuButton(botId: string, menuId: string, buttonId: string, dto: UpdateBotMenuButtonDto) {
    const btn = await this.prisma.botMenuButton.findFirst({ where: { id: buttonId, menuId } });
    if (!btn) throw new NotFoundException(`Button ${buttonId} not found`);
    return this.prisma.botMenuButton.update({ where: { id: buttonId }, data: dto });
  }

  async deleteMenuButton(botId: string, menuId: string, buttonId: string) {
    const btn = await this.prisma.botMenuButton.findFirst({ where: { id: buttonId, menuId } });
    if (!btn) throw new NotFoundException(`Button ${buttonId} not found`);
    await this.prisma.botMenuButton.delete({ where: { id: buttonId } });
    return { deleted: true };
  }

  // Config versioning
  async publishConfig(botId: string) {
    const bot = await this.findBot(botId);
    const newVersion = bot.configVersion + 1;

    // Snapshot the current config state
    const [commands, responses, menus] = await Promise.all([
      this.prisma.botCommand.findMany({ where: { botId }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.botResponse.findMany({ where: { botId }, orderBy: { key: 'asc' } }),
      this.prisma.botMenu.findMany({ where: { botId }, include: { buttons: true } }),
    ]);

    const snapshot = { commands: commands.length, responses: responses.length, menus: menus.length };

    // Read existing version history from metadata
    const existingHistory = (bot as any).configHistory ?? [];
    const versionEntry = {
      version: newVersion,
      publishedAt: new Date().toISOString(),
      snapshot,
    };
    const updatedHistory = [...(Array.isArray(existingHistory) ? existingHistory : []), versionEntry];

    const updated = await this.prisma.botInstance.update({
      where: { id: botId },
      data: {
        configVersion: newVersion,
        configHistory: updatedHistory as any,
      },
    });

    this.logger.log(`Config published for bot ${botId}, version ${updated.configVersion}`);
    return { version: updated.configVersion };
  }

  async getConfigVersion(botId: string) {
    const bot = await this.findBot(botId);
    return { version: bot.configVersion };
  }

  async getConfigVersionHistory(botId: string) {
    const bot = await this.findBot(botId);
    const history = (bot as any).configHistory;
    if (Array.isArray(history) && history.length > 0) {
      return history.sort((a: any, b: any) => b.version - a.version);
    }
    // Return synthetic history if no stored history exists
    const versions = [];
    for (let v = bot.configVersion; v >= 1; v--) {
      versions.push({
        version: v,
        publishedAt: v === bot.configVersion ? (bot as any).updatedAt?.toISOString?.() ?? new Date().toISOString() : null,
      });
    }
    return versions;
  }

  // I18n Strings (backed by BotResponse model)
  private mapToI18nDto(record: any) {
    return {
      id: record.id,
      botId: record.botId,
      key: record.key,
      locale: record.locale,
      value: record.text,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findI18nStrings(botId: string, locale?: string) {
    await this.findBot(botId);
    const where: any = { botId };
    if (locale) where.locale = locale;
    const records = await this.prisma.botResponse.findMany({ where, orderBy: { key: 'asc' } });
    return records.map((r) => this.mapToI18nDto(r));
  }

  async createI18nString(botId: string, dto: CreateI18nStringDto) {
    await this.findBot(botId);
    const record = await this.prisma.botResponse.create({
      data: { key: dto.key, locale: dto.locale ?? 'en', text: dto.value, botId },
    });
    return this.mapToI18nDto(record);
  }

  async updateI18nString(botId: string, stringId: string, dto: UpdateI18nStringDto) {
    const record = await this.prisma.botResponse.findFirst({ where: { id: stringId, botId } });
    if (!record) throw new NotFoundException(`I18n string ${stringId} not found`);
    const updated = await this.prisma.botResponse.update({
      where: { id: stringId },
      data: { text: dto.value },
    });
    return this.mapToI18nDto(updated);
  }

  async deleteI18nString(botId: string, stringId: string) {
    const record = await this.prisma.botResponse.findFirst({ where: { id: stringId, botId } });
    if (!record) throw new NotFoundException(`I18n string ${stringId} not found`);
    await this.prisma.botResponse.delete({ where: { id: stringId } });
    return { deleted: true };
  }

  async batchUpdateI18nStrings(botId: string, items: BatchUpdateI18nStringDto[]) {
    await this.findBot(botId);
    const results = [];
    for (const item of items) {
      const existing = await this.prisma.botResponse.findFirst({
        where: { botId, key: item.key, locale: item.locale },
      });
      if (existing) {
        const updated = await this.prisma.botResponse.update({
          where: { id: existing.id },
          data: { text: item.value },
        });
        results.push(this.mapToI18nDto(updated));
      } else {
        const created = await this.prisma.botResponse.create({
          data: { key: item.key, locale: item.locale, text: item.value, botId },
        });
        results.push(this.mapToI18nDto(created));
      }
    }
    return results;
  }
}
