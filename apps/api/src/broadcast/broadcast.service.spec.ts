import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: { trigger: jest.fn() },
}));

import { tasks } from '@trigger.dev/sdk/v3';

const mockEventBus = {
  emitModeration: jest.fn(),
  emitAutomation: jest.fn(),
  emitSystem: jest.fn(),
};

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

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: Record<string, any>;

  const mockBroadcast = {
    id: 'broadcast-1',
    status: 'pending',
    text: 'Hello everyone!',
    targetChatIds: [BigInt(111), BigInt(222)],
    results: null,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockCompletedBroadcast = {
    ...mockBroadcast,
    id: 'broadcast-2',
    status: 'completed',
    results: { sent: 2, failed: 0 },
  };

  const mockFailedBroadcast = {
    ...mockBroadcast,
    id: 'broadcast-3',
    status: 'failed',
    results: { sent: 0, failed: 2, error: 'Rate limited' },
  };

  beforeEach(async () => {
    prisma = {
      broadcastMessage: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<BroadcastService>(BroadcastService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated broadcasts', async () => {
      prisma.broadcastMessage.findMany.mockResolvedValue([mockBroadcast]);
      prisma.broadcastMessage.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.data[0].targetChatIds).toEqual(['111', '222']);
    });

    it('should handle pagination', async () => {
      prisma.broadcastMessage.findMany.mockResolvedValue([]);
      prisma.broadcastMessage.count.mockResolvedValue(50);

      const result = await service.findAll(3, 10);

      expect(result.totalPages).toBe(5);
      expect(prisma.broadcastMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a broadcast by ID', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockBroadcast);

      const result = await service.findOne('broadcast-1');

      expect(result.id).toBe('broadcast-1');
      expect(result.status).toBe('pending');
      expect(result.text).toBe('Hello everyone!');
    });

    it('should throw NotFoundException for non-existent broadcast', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a broadcast and trigger task', async () => {
      prisma.broadcastMessage.create.mockResolvedValue(mockBroadcast);
      (tasks.trigger as jest.Mock).mockResolvedValue({});

      const result = await service.create({
        text: 'Hello everyone!',
        targetChatIds: ['111', '222'],
      });

      expect(result.id).toBe('broadcast-1');
      expect(result.status).toBe('pending');
      expect(prisma.broadcastMessage.create).toHaveBeenCalledWith({
        data: {
          text: 'Hello everyone!',
          targetChatIds: [BigInt(111), BigInt(222)],
          status: 'pending',
        },
      });
      expect(tasks.trigger).toHaveBeenCalledWith('broadcast', {
        broadcastId: 'broadcast-1',
      });
    });

    it('should not throw if trigger task fails', async () => {
      prisma.broadcastMessage.create.mockResolvedValue(mockBroadcast);
      (tasks.trigger as jest.Mock).mockRejectedValue(new Error('Trigger failed'));

      const result = await service.create({
        text: 'Hello everyone!',
        targetChatIds: ['111', '222'],
      });

      expect(result.id).toBe('broadcast-1');
    });
  });

  describe('update', () => {
    it('should update a pending broadcast', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockBroadcast);
      const updated = { ...mockBroadcast, text: 'Updated message' };
      prisma.broadcastMessage.update.mockResolvedValue(updated);

      const result = await service.update('broadcast-1', {
        text: 'Updated message',
      });

      expect(result.text).toBe('Updated message');
    });

    it('should update targetChatIds with BigInt conversion', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockBroadcast);
      const updated = {
        ...mockBroadcast,
        targetChatIds: [BigInt(555), BigInt(666)],
      };
      prisma.broadcastMessage.update.mockResolvedValue(updated);

      await service.update('broadcast-1', {
        targetChatIds: ['555', '666'],
      });

      expect(prisma.broadcastMessage.update).toHaveBeenCalledWith({
        where: { id: 'broadcast-1' },
        data: { targetChatIds: [BigInt(555), BigInt(666)] },
      });
    });

    it('should throw NotFoundException for non-existent broadcast', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { text: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-pending broadcast', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockCompletedBroadcast);

      await expect(
        service.update('broadcast-2', { text: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a broadcast', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockBroadcast);
      prisma.broadcastMessage.delete.mockResolvedValue(mockBroadcast);

      const result = await service.remove('broadcast-1');

      expect(result).toEqual({ deleted: true });
      expect(prisma.broadcastMessage.delete).toHaveBeenCalledWith({
        where: { id: 'broadcast-1' },
      });
    });

    it('should throw NotFoundException for non-existent broadcast', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('retry', () => {
    it('should retry a failed broadcast by creating a new one', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockFailedBroadcast);
      const newBroadcast = {
        ...mockBroadcast,
        id: 'broadcast-4',
        status: 'pending',
        targetChatIds: mockFailedBroadcast.targetChatIds,
      };
      prisma.broadcastMessage.create.mockResolvedValue(newBroadcast);
      (tasks.trigger as jest.Mock).mockResolvedValue({});

      const result = await service.retry('broadcast-3');

      expect(result.id).toBe('broadcast-4');
      expect(result.status).toBe('pending');
      expect(prisma.broadcastMessage.create).toHaveBeenCalledWith({
        data: {
          text: mockFailedBroadcast.text,
          targetChatIds: mockFailedBroadcast.targetChatIds,
          status: 'pending',
        },
      });
      expect(tasks.trigger).toHaveBeenCalledWith('broadcast', {
        broadcastId: 'broadcast-4',
      });
    });

    it('should throw NotFoundException for non-existent broadcast', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(null);

      await expect(service.retry('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for non-failed broadcast', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockBroadcast); // status: pending

      await expect(service.retry('broadcast-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not throw if trigger task fails on retry', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockFailedBroadcast);
      prisma.broadcastMessage.create.mockResolvedValue({
        ...mockBroadcast,
        id: 'broadcast-5',
      });
      (tasks.trigger as jest.Mock).mockRejectedValue(new Error('Trigger failed'));

      const result = await service.retry('broadcast-3');

      expect(result.id).toBe('broadcast-5');
    });
  });
});
