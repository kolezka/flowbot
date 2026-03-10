import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BotConfigService } from './bot-config.service';
import { PrismaService } from '../prisma/prisma.service';

function createMockModel() {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };
}

describe('BotConfigService', () => {
  let service: BotConfigService;
  let prisma: Record<string, any>;

  const mockBot = {
    id: 'bot-1',
    name: 'Test Bot',
    token: 'test-token',
    isActive: true,
    configVersion: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
    commands: [],
    responses: [],
    menus: [],
  };

  const mockCommand = {
    id: 'cmd-1',
    botId: 'bot-1',
    command: '/start',
    description: 'Start the bot',
    sortOrder: 0,
  };

  const mockResponse = {
    id: 'resp-1',
    botId: 'bot-1',
    key: 'welcome',
    text: 'Hello!',
    locale: 'en',
  };

  const mockMenu = {
    id: 'menu-1',
    botId: 'bot-1',
    name: 'Main Menu',
    buttons: [],
  };

  const mockButton = {
    id: 'btn-1',
    menuId: 'menu-1',
    label: 'Click me',
    action: 'callback',
    row: 0,
    col: 0,
  };

  beforeEach(async () => {
    prisma = {
      botInstance: createMockModel(),
      botCommand: createMockModel(),
      botResponse: createMockModel(),
      botMenu: createMockModel(),
      botMenuButton: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BotConfigService>(BotConfigService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Bot Instances
  describe('findAllBots', () => {
    it('should return all bot instances with counts', async () => {
      prisma.botInstance.findMany.mockResolvedValue([mockBot]);
      const result = await service.findAllBots();
      expect(result).toEqual([mockBot]);
      expect(prisma.botInstance.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { commands: true, responses: true, menus: true } } },
      });
    });
  });

  describe('findBot', () => {
    it('should return a bot by id', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      const result = await service.findBot('bot-1');
      expect(result).toEqual(mockBot);
    });

    it('should throw NotFoundException when bot not found', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);
      await expect(service.findBot('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBot', () => {
    it('should create a bot instance', async () => {
      const dto = { name: 'New Bot', token: 'new-token' };
      prisma.botInstance.create.mockResolvedValue({ id: 'bot-2', ...dto });
      const result = await service.createBot(dto as any);
      expect(result).toEqual({ id: 'bot-2', ...dto });
      expect(prisma.botInstance.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('updateBot', () => {
    it('should update a bot instance', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      const dto = { name: 'Updated Bot' };
      prisma.botInstance.update.mockResolvedValue({ ...mockBot, ...dto });
      const result = await service.updateBot('bot-1', dto as any);
      expect(result.name).toBe('Updated Bot');
    });

    it('should throw NotFoundException if bot does not exist', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);
      await expect(service.updateBot('nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBot', () => {
    it('should delete a bot instance', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botInstance.delete.mockResolvedValue(mockBot);
      const result = await service.deleteBot('bot-1');
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if bot does not exist', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);
      await expect(service.deleteBot('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // Commands
  describe('findCommands', () => {
    it('should return commands for a bot', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botCommand.findMany.mockResolvedValue([mockCommand]);
      const result = await service.findCommands('bot-1');
      expect(result).toEqual([mockCommand]);
      expect(prisma.botCommand.findMany).toHaveBeenCalledWith({
        where: { botId: 'bot-1' },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('should throw if bot does not exist', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);
      await expect(service.findCommands('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCommand', () => {
    it('should create a command for a bot', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      const dto = { command: '/help', description: 'Get help' };
      prisma.botCommand.create.mockResolvedValue({ id: 'cmd-2', botId: 'bot-1', ...dto });
      const result = await service.createCommand('bot-1', dto as any);
      expect(result.command).toBe('/help');
      expect(prisma.botCommand.create).toHaveBeenCalledWith({
        data: { ...dto, botId: 'bot-1' },
      });
    });
  });

  describe('updateCommand', () => {
    it('should update a command', async () => {
      prisma.botCommand.findFirst.mockResolvedValue(mockCommand);
      const dto = { description: 'Updated desc' };
      prisma.botCommand.update.mockResolvedValue({ ...mockCommand, ...dto });
      const result = await service.updateCommand('bot-1', 'cmd-1', dto as any);
      expect(result.description).toBe('Updated desc');
    });

    it('should throw NotFoundException if command not found', async () => {
      prisma.botCommand.findFirst.mockResolvedValue(null);
      await expect(service.updateCommand('bot-1', 'cmd-x', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCommand', () => {
    it('should delete a command', async () => {
      prisma.botCommand.findFirst.mockResolvedValue(mockCommand);
      prisma.botCommand.delete.mockResolvedValue(mockCommand);
      const result = await service.deleteCommand('bot-1', 'cmd-1');
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if command not found', async () => {
      prisma.botCommand.findFirst.mockResolvedValue(null);
      await expect(service.deleteCommand('bot-1', 'cmd-x')).rejects.toThrow(NotFoundException);
    });
  });

  // Responses
  describe('findResponses', () => {
    it('should return responses for a bot', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botResponse.findMany.mockResolvedValue([mockResponse]);
      const result = await service.findResponses('bot-1');
      expect(result).toEqual([mockResponse]);
    });

    it('should filter responses by locale', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botResponse.findMany.mockResolvedValue([mockResponse]);
      await service.findResponses('bot-1', 'en');
      expect(prisma.botResponse.findMany).toHaveBeenCalledWith({
        where: { botId: 'bot-1', locale: 'en' },
        orderBy: { key: 'asc' },
      });
    });

    it('should not include locale filter when not specified', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botResponse.findMany.mockResolvedValue([]);
      await service.findResponses('bot-1');
      expect(prisma.botResponse.findMany).toHaveBeenCalledWith({
        where: { botId: 'bot-1' },
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('createResponse', () => {
    it('should create a response for a bot', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      const dto = { key: 'goodbye', text: 'Bye!', locale: 'en' };
      prisma.botResponse.create.mockResolvedValue({ id: 'resp-2', botId: 'bot-1', ...dto });
      const result = await service.createResponse('bot-1', dto as any);
      expect(result.key).toBe('goodbye');
    });
  });

  describe('updateResponse', () => {
    it('should update a response', async () => {
      prisma.botResponse.findFirst.mockResolvedValue(mockResponse);
      const dto = { text: 'Updated!' };
      prisma.botResponse.update.mockResolvedValue({ ...mockResponse, ...dto });
      const result = await service.updateResponse('bot-1', 'resp-1', dto as any);
      expect(result.text).toBe('Updated!');
    });

    it('should throw NotFoundException if response not found', async () => {
      prisma.botResponse.findFirst.mockResolvedValue(null);
      await expect(service.updateResponse('bot-1', 'resp-x', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteResponse', () => {
    it('should delete a response', async () => {
      prisma.botResponse.findFirst.mockResolvedValue(mockResponse);
      prisma.botResponse.delete.mockResolvedValue(mockResponse);
      const result = await service.deleteResponse('bot-1', 'resp-1');
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if response not found', async () => {
      prisma.botResponse.findFirst.mockResolvedValue(null);
      await expect(service.deleteResponse('bot-1', 'resp-x')).rejects.toThrow(NotFoundException);
    });
  });

  // Menus
  describe('findMenus', () => {
    it('should return menus for a bot', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botMenu.findMany.mockResolvedValue([mockMenu]);
      const result = await service.findMenus('bot-1');
      expect(result).toEqual([mockMenu]);
    });
  });

  describe('createMenu', () => {
    it('should create a menu for a bot', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      const dto = { name: 'Settings Menu' };
      prisma.botMenu.create.mockResolvedValue({ id: 'menu-2', botId: 'bot-1', ...dto });
      const result = await service.createMenu('bot-1', dto as any);
      expect(result.name).toBe('Settings Menu');
    });
  });

  describe('deleteMenu', () => {
    it('should delete a menu', async () => {
      prisma.botMenu.findFirst.mockResolvedValue(mockMenu);
      prisma.botMenu.delete.mockResolvedValue(mockMenu);
      const result = await service.deleteMenu('bot-1', 'menu-1');
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if menu not found', async () => {
      prisma.botMenu.findFirst.mockResolvedValue(null);
      await expect(service.deleteMenu('bot-1', 'menu-x')).rejects.toThrow(NotFoundException);
    });
  });

  // Menu Buttons
  describe('addMenuButton', () => {
    it('should add a button to a menu', async () => {
      prisma.botMenu.findFirst.mockResolvedValue(mockMenu);
      const dto = { label: 'New Button', action: 'url', row: 1, col: 0 };
      prisma.botMenuButton.create.mockResolvedValue({ id: 'btn-2', menuId: 'menu-1', ...dto });
      const result = await service.addMenuButton('bot-1', 'menu-1', dto as any);
      expect(result.label).toBe('New Button');
      expect(prisma.botMenuButton.create).toHaveBeenCalledWith({
        data: { ...dto, menuId: 'menu-1' },
      });
    });

    it('should throw NotFoundException if menu not found', async () => {
      prisma.botMenu.findFirst.mockResolvedValue(null);
      await expect(service.addMenuButton('bot-1', 'menu-x', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMenuButton', () => {
    it('should update a menu button', async () => {
      prisma.botMenuButton.findFirst.mockResolvedValue(mockButton);
      const dto = { label: 'Updated Button' };
      prisma.botMenuButton.update.mockResolvedValue({ ...mockButton, ...dto });
      const result = await service.updateMenuButton('bot-1', 'menu-1', 'btn-1', dto as any);
      expect(result.label).toBe('Updated Button');
    });

    it('should throw NotFoundException if button not found', async () => {
      prisma.botMenuButton.findFirst.mockResolvedValue(null);
      await expect(service.updateMenuButton('bot-1', 'menu-1', 'btn-x', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMenuButton', () => {
    it('should delete a menu button', async () => {
      prisma.botMenuButton.findFirst.mockResolvedValue(mockButton);
      prisma.botMenuButton.delete.mockResolvedValue(mockButton);
      const result = await service.deleteMenuButton('bot-1', 'menu-1', 'btn-1');
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if button not found', async () => {
      prisma.botMenuButton.findFirst.mockResolvedValue(null);
      await expect(service.deleteMenuButton('bot-1', 'menu-1', 'btn-x')).rejects.toThrow(NotFoundException);
    });
  });

  // Config versioning
  describe('publishConfig', () => {
    it('should increment the config version', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botCommand.findMany.mockResolvedValue([mockCommand]);
      prisma.botResponse.findMany.mockResolvedValue([mockResponse]);
      prisma.botMenu.findMany.mockResolvedValue([mockMenu]);
      prisma.botInstance.update.mockResolvedValue({ ...mockBot, configVersion: 2 });
      const result = await service.publishConfig('bot-1');
      expect(result).toEqual({ version: 2 });
      expect(prisma.botInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bot-1' },
          data: expect.objectContaining({ configVersion: 2 }),
        }),
      );
    });

    it('should throw NotFoundException if bot not found', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);
      await expect(service.publishConfig('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConfigVersion', () => {
    it('should return the current config version', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      const result = await service.getConfigVersion('bot-1');
      expect(result).toEqual({ version: 1 });
    });

    it('should throw NotFoundException if bot not found', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);
      await expect(service.getConfigVersion('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
