import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
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

describe('ConnectionsService', () => {
  let service: ConnectionsService;
  let prisma: Record<string, ReturnType<typeof createMockModel>>;

  const now = new Date('2026-03-01');

  const mockConnection = {
    id: 'conn-1',
    platform: 'telegram',
    name: 'Test Connection',
    connectionType: 'mtproto',
    status: 'inactive',
    metadata: null,
    errorCount: 0,
    lastErrorMessage: null,
    lastActiveAt: null,
    botInstanceId: null,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    prisma = {
      platformConnection: createMockModel(),
      platformConnectionLog: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ConnectionsService>(ConnectionsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated connections', async () => {
      prisma.platformConnection.findMany.mockResolvedValue([mockConnection]);
      prisma.platformConnection.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by platform', async () => {
      prisma.platformConnection.findMany.mockResolvedValue([mockConnection]);
      prisma.platformConnection.count.mockResolvedValue(1);

      await service.findAll(1, 20, 'telegram');

      expect(prisma.platformConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { platform: 'telegram' } }),
      );
      expect(prisma.platformConnection.count).toHaveBeenCalledWith({
        where: { platform: 'telegram' },
      });
    });

    it('should filter by status', async () => {
      prisma.platformConnection.findMany.mockResolvedValue([]);
      prisma.platformConnection.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, 'active');

      expect(prisma.platformConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'active' } }),
      );
    });

    it('should calculate pagination correctly', async () => {
      prisma.platformConnection.findMany.mockResolvedValue([]);
      prisma.platformConnection.count.mockResolvedValue(50);

      const result = await service.findAll(3, 10);

      expect(result.totalPages).toBe(5);
      expect(prisma.platformConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a connection without credentials', async () => {
      const connectionWithCreds = {
        ...mockConnection,
        credentials: { sessionString: 'secret-data' },
      };
      prisma.platformConnection.findUnique.mockResolvedValue(connectionWithCreds);

      const result = await service.findOne('conn-1');

      expect(result.id).toBe('conn-1');
      expect(result.platform).toBe('telegram');
      expect((result as unknown as Record<string, unknown>)['credentials']).toBeUndefined();
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a connection', async () => {
      const created = { ...mockConnection, status: 'inactive' };
      prisma.platformConnection.create.mockResolvedValue(created);

      const result = await service.create({
        platform: 'telegram',
        name: 'Test Connection',
        connectionType: 'mtproto',
      });

      expect(result.platform).toBe('telegram');
      expect(result.status).toBe('inactive');
      expect(prisma.platformConnection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: 'telegram',
          name: 'Test Connection',
          connectionType: 'mtproto',
          status: 'inactive',
        }),
      });
    });
  });

  describe('updateStatus', () => {
    it('should update connection status', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(mockConnection);
      const updated = { ...mockConnection, status: 'active' };
      prisma.platformConnection.update.mockResolvedValue(updated);

      const result = await service.updateStatus('conn-1', 'active');

      expect(result.status).toBe('active');
      expect(prisma.platformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: expect.objectContaining({ status: 'active' }),
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('missing', 'active')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('startAuth', () => {
    it('should set status to authenticating and store auth params in metadata', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(mockConnection);
      const updated = {
        ...mockConnection,
        status: 'authenticating',
        metadata: { authState: { params: { phoneNumber: '+1234567890' } } },
      };
      prisma.platformConnection.update.mockResolvedValue(updated);

      const result = await service.startAuth('conn-1', { phoneNumber: '+1234567890' });

      expect(result.status).toBe('authenticating');
      expect(prisma.platformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: expect.objectContaining({ status: 'authenticating' }),
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(null);

      await expect(service.startAuth('missing', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitAuthStep', () => {
    it('should update metadata with step data', async () => {
      const authenticatingConn = {
        ...mockConnection,
        status: 'authenticating',
        metadata: { authState: { params: {}, startedAt: '2026-03-01' } },
      };
      prisma.platformConnection.findUnique.mockResolvedValue(authenticatingConn);
      const updated = {
        ...authenticatingConn,
        status: 'authenticating',
        metadata: {
          authState: {
            params: {},
            startedAt: '2026-03-01',
            code: '12345',
            lastStep: 'code',
          },
        },
      };
      prisma.platformConnection.update.mockResolvedValue(updated);

      const result = await service.submitAuthStep('conn-1', 'code', '12345');

      expect(result.status).toBe('authenticating');
    });

    it('should set status to active when step is "complete"', async () => {
      const authenticatingConn = {
        ...mockConnection,
        status: 'authenticating',
        metadata: { authState: {} },
      };
      prisma.platformConnection.findUnique.mockResolvedValue(authenticatingConn);
      const updated = {
        ...authenticatingConn,
        status: 'active',
        lastActiveAt: new Date(),
      };
      prisma.platformConnection.update.mockResolvedValue(updated);

      const result = await service.submitAuthStep('conn-1', 'complete', {});

      expect(result.status).toBe('active');
      expect(prisma.platformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: expect.objectContaining({ status: 'active' }),
      });
    });
  });

  describe('getLogs', () => {
    it('should return paginated logs for a connection', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(mockConnection);
      const mockLog = {
        id: 'log-1',
        connectionId: 'conn-1',
        level: 'info',
        message: 'Test log',
        details: null,
        createdAt: now,
      };
      prisma.platformConnectionLog.findMany.mockResolvedValue([mockLog]);
      prisma.platformConnectionLog.count.mockResolvedValue(1);

      const result = await service.getLogs('conn-1', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].connectionId).toBe('conn-1');
      expect(result.total).toBe(1);
    });

    it('should throw NotFoundException if connection not found', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(null);

      await expect(service.getLogs('missing', 1, 20)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHealth', () => {
    it('should return platform breakdown', async () => {
      prisma.platformConnection.findMany.mockResolvedValue([
        { platform: 'telegram', status: 'active' },
        { platform: 'telegram', status: 'error' },
        { platform: 'discord', status: 'active' },
        { platform: 'telegram', status: 'inactive' },
      ]);

      const result = await service.getHealth();

      expect(result.totalConnections).toBe(4);
      expect(result.activeConnections).toBe(2);
      expect(result.errorConnections).toBe(1);
      expect(result.platforms['telegram']).toEqual({ total: 3, active: 1, error: 1 });
      expect(result.platforms['discord']).toEqual({ total: 1, active: 1, error: 0 });
    });

    it('should return empty platforms when no connections', async () => {
      prisma.platformConnection.findMany.mockResolvedValue([]);

      const result = await service.getHealth();

      expect(result.totalConnections).toBe(0);
      expect(result.activeConnections).toBe(0);
      expect(result.errorConnections).toBe(0);
      expect(result.platforms).toEqual({});
    });
  });

  describe('deactivate', () => {
    it('should set status to inactive', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(mockConnection);
      const updated = { ...mockConnection, status: 'inactive' };
      prisma.platformConnection.update.mockResolvedValue(updated);

      const result = await service.deactivate('conn-1');

      expect(result.status).toBe('inactive');
      expect(prisma.platformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: { status: 'inactive' },
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.platformConnection.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
