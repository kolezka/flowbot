import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AutomationService } from './automation.service';
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

describe('AutomationService', () => {
  let service: AutomationService;
  let prisma: Record<string, any>;

  const mockJob = {
    id: 'job-1',
    status: 'completed',
    text: 'Hello everyone!',
    targetChatIds: [BigInt(111), BigInt(222)],
    results: { sent: 2, failed: 0 },
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockLog = {
    id: 'log-1',
    level: 'info',
    message: 'Task completed',
    details: { taskId: 'abc' },
    createdAt: new Date('2026-03-01'),
  };

  beforeEach(async () => {
    prisma = {
      broadcastMessage: createMockModel(),
      clientLog: createMockModel(),
      clientSession: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AutomationService>(AutomationService);
    jest.clearAllMocks();
  });

  describe('getJobs', () => {
    it('should return paginated jobs', async () => {
      prisma.broadcastMessage.findMany.mockResolvedValue([mockJob]);
      prisma.broadcastMessage.count.mockResolvedValue(1);

      const result = await service.getJobs(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].targetChatIds).toEqual(['111', '222']);
    });

    it('should filter by status', async () => {
      prisma.broadcastMessage.findMany.mockResolvedValue([]);
      prisma.broadcastMessage.count.mockResolvedValue(0);

      await service.getJobs(1, 20, 'pending');

      expect(prisma.broadcastMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        }),
      );
    });

    it('should handle pagination', async () => {
      prisma.broadcastMessage.findMany.mockResolvedValue([]);
      prisma.broadcastMessage.count.mockResolvedValue(30);

      const result = await service.getJobs(2, 10);

      expect(result.totalPages).toBe(3);
      expect(prisma.broadcastMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('getJob', () => {
    it('should return a job by ID', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(mockJob);

      const result = await service.getJob('job-1');

      expect(result.id).toBe('job-1');
      expect(result.status).toBe('completed');
      expect(result.targetChatIds).toEqual(['111', '222']);
    });

    it('should throw NotFoundException for non-existent job', async () => {
      prisma.broadcastMessage.findUnique.mockResolvedValue(null);

      await expect(service.getJob('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return correct job statistics', async () => {
      prisma.broadcastMessage.count
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(10)   // pending
        .mockResolvedValueOnce(80)   // completed
        .mockResolvedValueOnce(10);  // failed

      const result = await service.getStats();

      expect(result.total).toBe(100);
      expect(result.pending).toBe(10);
      expect(result.completed).toBe(80);
      expect(result.failed).toBe(10);
    });
  });

  describe('getLogs', () => {
    it('should return paginated logs', async () => {
      prisma.clientLog.findMany.mockResolvedValue([mockLog]);
      prisma.clientLog.count.mockResolvedValue(1);

      const result = await service.getLogs(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].level).toBe('info');
      expect(result.data[0].message).toBe('Task completed');
    });

    it('should filter by level', async () => {
      prisma.clientLog.findMany.mockResolvedValue([]);
      prisma.clientLog.count.mockResolvedValue(0);

      await service.getLogs(1, 20, 'error');

      expect(prisma.clientLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { level: 'error' },
        }),
      );
    });
  });

  describe('getHealth', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should return healthy status when tg client is reachable', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok' }),
      }) as any;

      // job metrics: 1h and 24h
      prisma.broadcastMessage.count
        .mockResolvedValueOnce(5)   // 1h completed
        .mockResolvedValueOnce(0)   // 1h failed
        .mockResolvedValueOnce(5)   // 1h total
        .mockResolvedValueOnce(20)  // 24h completed
        .mockResolvedValueOnce(2)   // 24h failed
        .mockResolvedValueOnce(22); // 24h total

      prisma.clientSession.findFirst.mockResolvedValue({
        updatedAt: new Date(),
        isActive: true,
        lastUsedAt: new Date(),
      });

      const result = await service.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.tgClient.reachable).toBe(true);
      expect(result.session.exists).toBe(true);
    });

    it('should return unreachable when fetch fails', async () => {
      globalThis.fetch = jest.fn().mockRejectedValue(new Error('Connection refused')) as any;

      prisma.broadcastMessage.count.mockResolvedValue(0);
      prisma.clientSession.findFirst.mockResolvedValue(null);

      const result = await service.getHealth();

      expect(result.status).toBe('unreachable');
      expect(result.tgClient.reachable).toBe(false);
      expect(result.session.exists).toBe(false);
    });

    it('should return degraded when tg client status is not ok', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'degraded' }),
      }) as any;

      prisma.broadcastMessage.count.mockResolvedValue(0);
      prisma.clientSession.findFirst.mockResolvedValue(null);

      const result = await service.getHealth();

      expect(result.status).toBe('degraded');
    });
  });
});
