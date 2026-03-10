import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TgClientService } from './tg-client.service';
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

describe('TgClientService', () => {
  let service: TgClientService;
  let prisma: Record<string, any>;

  const mockSession = {
    id: 'session-1',
    isActive: true,
    lastUsedAt: new Date('2026-03-01'),
    phoneNumber: '+1234567890',
    displayName: 'Test Session',
    dcId: 2,
    sessionType: 'user',
    errorCount: 0,
    lastError: null,
    lastErrorAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
  };

  const mockSessionFull = {
    ...mockSession,
    sessionString: 'encrypted-session-data',
  };

  beforeEach(async () => {
    prisma = {
      clientSession: createMockModel(),
      clientLog: createMockModel(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TgClientService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TgClientService>(TgClientService);
    jest.clearAllMocks();
  });

  describe('findAllSessions', () => {
    it('should return paginated sessions', async () => {
      prisma.clientSession.findMany.mockResolvedValue([mockSession]);
      prisma.clientSession.count.mockResolvedValue(1);

      const result = await service.findAllSessions(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate pagination correctly', async () => {
      prisma.clientSession.findMany.mockResolvedValue([]);
      prisma.clientSession.count.mockResolvedValue(50);

      const result = await service.findAllSessions(3, 10);

      expect(result.totalPages).toBe(5);
      expect(prisma.clientSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should use default pagination values', async () => {
      prisma.clientSession.findMany.mockResolvedValue([]);
      prisma.clientSession.count.mockResolvedValue(0);

      const result = await service.findAllSessions();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(prisma.clientSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('findSession', () => {
    it('should return a session by ID', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.findSession('session-1');

      expect(result.id).toBe('session-1');
      expect(result.phoneNumber).toBe('+1234567890');
    });

    it('should throw NotFoundException if session not found', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(null);

      await expect(service.findSession('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSession', () => {
    it('should update a session', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(mockSession);
      const updated = { ...mockSession, displayName: 'Updated Name' };
      prisma.clientSession.update.mockResolvedValue(updated);

      const result = await service.updateSession('session-1', {
        displayName: 'Updated Name',
      });

      expect(result.displayName).toBe('Updated Name');
    });

    it('should throw NotFoundException if session not found', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSession('missing', { displayName: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateSession', () => {
    it('should deactivate a session', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(mockSession);
      prisma.clientSession.update.mockResolvedValue({
        ...mockSession,
        isActive: false,
      });

      const result = await service.deactivateSession('session-1');

      expect(result.isActive).toBe(false);
      expect(prisma.clientSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException if session not found', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(null);

      await expect(service.deactivateSession('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rotateSession', () => {
    it('should deactivate old session and create a new one', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(mockSessionFull);
      prisma.clientSession.update.mockResolvedValue({
        ...mockSessionFull,
        isActive: false,
      });
      const newSession = {
        id: 'session-2',
        sessionString: '',
        isActive: false,
        phoneNumber: '+1234567890',
        displayName: 'Test Session',
        sessionType: 'user',
      };
      prisma.clientSession.create.mockResolvedValue(newSession);

      const result = await service.rotateSession('session-1');

      expect(result.id).toBe('session-2');
      expect(result.isActive).toBe(false);
      expect(result.sessionString).toBe('');
      expect(prisma.clientSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { isActive: false },
      });
      expect(prisma.clientSession.create).toHaveBeenCalledWith({
        data: {
          sessionString: '',
          isActive: false,
          phoneNumber: '+1234567890',
          displayName: 'Test Session',
          sessionType: 'user',
        },
      });
    });

    it('should throw NotFoundException if session not found', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(null);

      await expect(service.rotateSession('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTransportHealth', () => {
    it('should return transport health information', async () => {
      prisma.clientSession.count
        .mockResolvedValueOnce(5) // active sessions
        .mockResolvedValueOnce(1); // error sessions
      prisma.clientLog.findMany.mockResolvedValue([
        { id: 'log-1', message: 'test', createdAt: new Date() },
      ]);

      const result = await service.getTransportHealth();

      expect(result.activeSessions).toBe(5);
      expect(result.errorSessions).toBe(1);
      expect(result.healthySessions).toBe(4);
      expect(result.recentLogs).toHaveLength(1);
      expect(result.lastChecked).toBeInstanceOf(Date);
    });

    it('should handle zero sessions', async () => {
      prisma.clientSession.count.mockResolvedValue(0);
      prisma.clientLog.findMany.mockResolvedValue([]);

      const result = await service.getTransportHealth();

      expect(result.activeSessions).toBe(0);
      expect(result.errorSessions).toBe(0);
      expect(result.healthySessions).toBe(0);
      expect(result.recentLogs).toHaveLength(0);
    });
  });

  describe('startAuth', () => {
    it('should create a new session and return code_required status', async () => {
      prisma.clientSession.create.mockResolvedValue({
        id: 'session-new',
        sessionString: '',
        isActive: false,
        phoneNumber: '+1234567890',
      });

      const result = await service.startAuth({ phoneNumber: '+1234567890' });

      expect(result.sessionId).toBe('session-new');
      expect(result.status).toBe('code_required');
      expect(prisma.clientSession.create).toHaveBeenCalledWith({
        data: {
          sessionString: '',
          isActive: false,
          phoneNumber: '+1234567890',
        },
      });
    });
  });

  describe('submitCode', () => {
    it('should return password_required status', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.submitCode({
        sessionId: 'session-1',
        code: '12345',
      });

      expect(result.sessionId).toBe('session-1');
      expect(result.status).toBe('password_required');
    });

    it('should throw NotFoundException if session not found', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(null);

      await expect(
        service.submitCode({ sessionId: 'missing', code: '12345' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitPassword', () => {
    it('should return authenticated status', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.submitPassword({
        sessionId: 'session-1',
        password: 'secret',
      });

      expect(result.sessionId).toBe('session-1');
      expect(result.status).toBe('authenticated');
    });

    it('should throw NotFoundException if session not found', async () => {
      prisma.clientSession.findUnique.mockResolvedValue(null);

      await expect(
        service.submitPassword({ sessionId: 'missing', password: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
