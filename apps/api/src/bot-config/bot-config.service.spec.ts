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
    name: 'TestBot',
    botToken: 'token123',
    botUsername: 'testbot',
    type: 'ecommerce',
    isActive: true,
    configVersion: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    commands: [],
    responses: [],
    menus: [],
  };

  const mockCommand = {
    id: 'cmd-1',
    botId: 'bot-1',
    command: '/start',
    description: 'Start the bot',
    isEnabled: true,
    sortOrder: 0,
  };

  const mockResponse = {
    id: 'resp-1',
    botId: 'bot-1',
    key: 'welcome',
    locale: 'en',
    text: 'Welcome!',
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
    label: 'Products',
    action: '/products',
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

  // --- Bot Instances ---
  describe('findAllBots', () => {
    it('should return all bot instances', async () => {
      prisma.botInstance.findMany.mockResolvedValue([mockBot]);

      const result = await service.findAllBots();

      expect(result).toEqual([mockBot]);
      expect(prisma.botInstance.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { commands: true, responses: true, menus: true } },
        },
      });
    });
  });

  describe('findBot', () => {
    it('should return a bot by ID', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);

      const result = await service.findBot('bot-1');

      expect(result).toEqual(mockBot);
    });

    it('should throw NotFoundException if bot not found', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);

      await expect(service.findBot('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createBot', () => {
    it('should create a bot instance', async () => {
      prisma.botInstance.create.mockResolvedValue(mockBot);

      const result = await service.createBot({
        name: 'TestBot',
        botToken: 'token123',
      });

      expect(result).toEqual(mockBot);
      expect(prisma.botInstance.create).toHaveBeenCalledWith({
        data: { name: 'TestBot', botToken: 'token123' },
      });
    });
  });

  describe('updateBot', () => {
    it('should update a bot instance', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      const updated = { ...mockBot, name: 'UpdatedBot' };
      prisma.botInstance.update.mockResolvedValue(updated);

      const result = await service.updateBot('bot-1', { name: 'UpdatedBot' });

      expect(result.name).toBe('UpdatedBot');
    });

    it('should throw NotFoundException if bot not found', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);

      await expect(
        service.updateBot('missing', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBot', () => {
    it('should delete a bot instance', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botInstance.delete.mockResolvedValue(mockBot);

      const result = await service.deleteBot('bot-1');

      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if bot not found', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);

      await expect(service.deleteBot('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- Commands ---
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

    it('should throw NotFoundException if bot not found', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);

      await expect(service.findCommands('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createCommand', () => {
    it('should create a command for a bot', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botCommand.create.mockResolvedValue(mockCommand);

      const result = await service.createCommand('bot-1', {
        command: '/start',
        description: 'Start the bot',
      });

      expect(result).toEqual(mockCommand);
      expect(prisma.botCommand.create).toHaveBeenCalledWith({
        data: {
          command: '/start',
          description: 'Start the bot',
          botId: 'bot-1',
        },
      });
    });
  });

  describe('updateCommand', () => {
    it('should update a command', async () => {
      prisma.botCommand.findFirst.mockResolvedValue(mockCommand);
      const updated = { ...mockCommand, description: 'Updated' };
      prisma.botCommand.update.mockResolvedValue(updated);

      const result = await service.updateCommand('bot-1', 'cmd-1', {
        description: 'Updated',
      });

      expect(result.description).toBe('Updated');
    });

    it('should throw NotFoundException if command not found', async () => {
      prisma.botCommand.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCommand('bot-1', 'missing', { description: 'x' }),
      ).rejects.toThrow(NotFoundException);
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

      await expect(
        service.deleteCommand('bot-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- Responses ---
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
  });

  describe('createResponse', () => {
    it('should create a response for a bot', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botResponse.create.mockResolvedValue(mockResponse);

      const result = await service.createResponse('bot-1', {
        key: 'welcome',
        text: 'Welcome!',
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateResponse', () => {
    it('should update a response', async () => {
      prisma.botResponse.findFirst.mockResolvedValue(mockResponse);
      const updated = { ...mockResponse, text: 'Hello!' };
      prisma.botResponse.update.mockResolvedValue(updated);

      const result = await service.updateResponse('bot-1', 'resp-1', {
        text: 'Hello!',
      });

      expect(result.text).toBe('Hello!');
    });

    it('should throw NotFoundException if response not found', async () => {
      prisma.botResponse.findFirst.mockResolvedValue(null);

      await expect(
        service.updateResponse('bot-1', 'missing', { text: 'x' }),
      ).rejects.toThrow(NotFoundException);
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

      await expect(
        service.deleteResponse('bot-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- Menus ---
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
      prisma.botMenu.create.mockResolvedValue(mockMenu);

      const result = await service.createMenu('bot-1', { name: 'Main Menu' });

      expect(result).toEqual(mockMenu);
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

      await expect(service.deleteMenu('bot-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addMenuButton', () => {
    it('should add a button to a menu', async () => {
      prisma.botMenu.findFirst.mockResolvedValue(mockMenu);
      prisma.botMenuButton.create.mockResolvedValue(mockButton);

      const result = await service.addMenuButton('bot-1', 'menu-1', {
        label: 'Products',
        action: '/products',
      });

      expect(result).toEqual(mockButton);
      expect(prisma.botMenuButton.create).toHaveBeenCalledWith({
        data: { label: 'Products', action: '/products', menuId: 'menu-1' },
      });
    });

    it('should throw NotFoundException if menu not found', async () => {
      prisma.botMenu.findFirst.mockResolvedValue(null);

      await expect(
        service.addMenuButton('bot-1', 'missing', {
          label: 'x',
          action: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMenuButton', () => {
    it('should update a menu button', async () => {
      prisma.botMenuButton.findFirst.mockResolvedValue(mockButton);
      const updated = { ...mockButton, label: 'Updated' };
      prisma.botMenuButton.update.mockResolvedValue(updated);

      const result = await service.updateMenuButton('bot-1', 'menu-1', 'btn-1', {
        label: 'Updated',
      });

      expect(result.label).toBe('Updated');
    });

    it('should throw NotFoundException if button not found', async () => {
      prisma.botMenuButton.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMenuButton('bot-1', 'menu-1', 'missing', { label: 'x' }),
      ).rejects.toThrow(NotFoundException);
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

      await expect(
        service.deleteMenuButton('bot-1', 'menu-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- Config Versioning ---
  describe('publishConfig', () => {
    it('should increment config version', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(mockBot);
      prisma.botInstance.update.mockResolvedValue({
        ...mockBot,
        configVersion: 2,
      });

      const result = await service.publishConfig('bot-1');

      expect(result).toEqual({ version: 2 });
      expect(prisma.botInstance.update).toHaveBeenCalledWith({
        where: { id: 'bot-1' },
        data: { configVersion: 2 },
      });
    });

    it('should throw NotFoundException if bot not found', async () => {
      prisma.botInstance.findUnique.mockResolvedValue(null);

      await expect(service.publishConfig('missing')).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(service.getConfigVersion('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
