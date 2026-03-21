import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TelegramConnectionStrategy } from './telegram-connection.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStrategyRegistry } from '../../platform/strategy-registry.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('TelegramConnectionStrategy', () => {
  let strategy: TelegramConnectionStrategy;
  let prisma: {
    botInstance: { findFirst: jest.Mock; create: jest.Mock };
    platformConnection: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let registry: { register: jest.Mock };

  const validToken = '123456:ABCdefGHIjklMNO';
  const connectionId = 'conn-1';

  const mockBotInfo = {
    id: 123,
    first_name: 'TestBot',
    username: 'test_bot',
    can_join_groups: true,
  };

  const mockBotInstance = { id: 'bot-instance-1' };

  beforeEach(async () => {
    mockFetch.mockReset();

    prisma = {
      botInstance: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockBotInstance),
      },
      platformConnection: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    registry = { register: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TelegramConnectionStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformStrategyRegistry, useValue: registry },
      ],
    }).compile();

    strategy = module.get(TelegramConnectionStrategy);
  });

  describe('onModuleInit', () => {
    it('should register itself in the strategy registry', () => {
      strategy.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith('connections', strategy);
    });

    it('should have platform set to telegram', () => {
      expect(strategy.platform).toBe('telegram');
    });
  });

  describe('format validation', () => {
    it('should reject token with no colon', async () => {
      await expect(strategy.handleBotTokenAuth(connectionId, 'invalidtoken')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject token with non-numeric id', async () => {
      await expect(strategy.handleBotTokenAuth(connectionId, 'abc:ABCdef')).rejects.toThrow(
        'Bot token format is invalid',
      );
    });

    it('should reject empty string token', async () => {
      await expect(strategy.handleBotTokenAuth(connectionId, '')).rejects.toThrow(
        'Bot token format is invalid',
      );
    });

    it('should accept valid token format and proceed', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, result: mockBotInfo }),
      });

      await expect(strategy.handleBotTokenAuth(connectionId, validToken)).resolves.toBeDefined();
    });
  });

  describe('duplicate detection', () => {
    it('should reject token already connected', async () => {
      prisma.botInstance.findFirst.mockResolvedValue({ id: 'existing-bot' });

      await expect(strategy.handleBotTokenAuth(connectionId, validToken)).rejects.toThrow(
        'already connected',
      );
    });

    it('should proceed when no duplicate found', async () => {
      prisma.botInstance.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, result: mockBotInfo }),
      });

      await expect(strategy.handleBotTokenAuth(connectionId, validToken)).resolves.toBeDefined();
    });
  });

  describe('getMe validation', () => {
    it('should return botUsername and botName on valid token', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, result: mockBotInfo }),
      });

      const result = await strategy.handleBotTokenAuth(connectionId, validToken);

      expect(result.botUsername).toBe('test_bot');
      expect(result.botName).toBe('TestBot');
    });

    it('should throw when Telegram rejects the token', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: false }),
      });

      await expect(strategy.handleBotTokenAuth(connectionId, validToken)).rejects.toThrow(
        'Telegram rejected',
      );
    });

    it('should throw on AbortError (timeout)', async () => {
      mockFetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

      await expect(strategy.handleBotTokenAuth(connectionId, validToken)).rejects.toThrow(
        'Could not reach Telegram',
      );
    });

    it('should throw on generic network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(strategy.handleBotTokenAuth(connectionId, validToken)).rejects.toThrow(
        'Could not reach Telegram',
      );
    });
  });

  describe('transaction — BotInstance + PlatformConnection', () => {
    it('should create BotInstance with correct data', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, result: mockBotInfo }),
      });

      await strategy.handleBotTokenAuth(connectionId, validToken);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.botInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'TestBot',
            botToken: validToken,
            botUsername: 'test_bot',
            platform: 'telegram',
            isActive: true,
          }),
        }),
      );
    });

    it('should update PlatformConnection with active status and credentials', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, result: mockBotInfo }),
      });

      await strategy.handleBotTokenAuth(connectionId, validToken);

      expect(prisma.platformConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: connectionId },
          data: expect.objectContaining({
            status: 'active',
            botInstanceId: mockBotInstance.id,
            credentials: expect.objectContaining({ botToken: validToken }),
          }),
        }),
      );
    });

    it('should store botUsername, botName, canJoinGroups in metadata', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, result: mockBotInfo }),
      });

      await strategy.handleBotTokenAuth(connectionId, validToken);

      expect(prisma.platformConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              botUsername: 'test_bot',
              botName: 'TestBot',
              canJoinGroups: true,
            }),
          }),
        }),
      );
    });
  });
});
