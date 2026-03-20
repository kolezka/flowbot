import { Test, TestingModule } from '@nestjs/testing';
import { WsGateway } from './ws.gateway';
import { EventBusService } from './event-bus.service';

describe('WsGateway', () => {
  let gateway: WsGateway;
  let eventBus: EventBusService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  const mockEventBus = {
    onModeration: jest.fn(),
    onAutomation: jest.fn(),
    onSystem: jest.fn(),
    onQrAuth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsGateway,
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    gateway = module.get<WsGateway>(WsGateway);
    eventBus = module.get<EventBusService>(EventBusService);
    (gateway as any).server = mockServer;
    jest.clearAllMocks();
  });

  describe('afterInit', () => {
    it('should register moderation event handler', () => {
      gateway.afterInit();
      expect(mockEventBus.onModeration).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should register automation event handler', () => {
      gateway.afterInit();
      expect(mockEventBus.onAutomation).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should register system event handler', () => {
      gateway.afterInit();
      expect(mockEventBus.onSystem).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should emit moderation events to the moderation room', () => {
      gateway.afterInit();
      const handler = mockEventBus.onModeration.mock.calls[0][0];
      const event = {
        type: 'warning.created',
        groupId: 'g1',
        data: {},
        timestamp: new Date(),
      };

      handler(event);

      expect(mockServer.to).toHaveBeenCalledWith('moderation');
      expect(mockServer.emit).toHaveBeenCalledWith('moderation', event);
    });

    it('should emit automation events to the automation room', () => {
      gateway.afterInit();
      const handler = mockEventBus.onAutomation.mock.calls[0][0];
      const event = {
        type: 'broadcast.created',
        jobId: 'j1',
        data: {},
        timestamp: new Date(),
      };

      handler(event);

      expect(mockServer.to).toHaveBeenCalledWith('automation');
      expect(mockServer.emit).toHaveBeenCalledWith('automation', event);
    });

    it('should emit system events to the system room', () => {
      gateway.afterInit();
      const handler = mockEventBus.onSystem.mock.calls[0][0];
      const event = {
        type: 'health.update',
        data: {},
        timestamp: new Date(),
      };

      handler(event);

      expect(mockServer.to).toHaveBeenCalledWith('system');
      expect(mockServer.emit).toHaveBeenCalledWith('system', event);
    });

    it('should register qr-auth event handler', () => {
      gateway.afterInit();
      expect(mockEventBus.onQrAuth).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should emit qr-auth events to the connection-scoped room', () => {
      gateway.afterInit();
      const handler = mockEventBus.onQrAuth.mock.calls[0][0];
      const event = {
        connectionId: 'conn-42',
        qr: 'data:image/png;base64,abc',
        timestamp: new Date(),
      };

      handler(event);

      expect(mockServer.to).toHaveBeenCalledWith('qr-auth:conn-42');
      expect(mockServer.emit).toHaveBeenCalledWith('qr-auth', event);
    });
  });

  describe('handleConnection', () => {
    it('should accept client connections', () => {
      const client = { id: 'client-1' };
      // Should not throw
      expect(() => gateway.handleConnection(client as any)).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    it('should handle client disconnections', () => {
      const client = { id: 'client-1' };
      expect(() => gateway.handleDisconnect(client as any)).not.toThrow();
    });
  });

  describe('handleJoin', () => {
    it('should allow joining valid rooms', () => {
      const client = { id: 'c1', join: jest.fn() };

      const result = gateway.handleJoin(client as any, 'moderation');

      expect(client.join).toHaveBeenCalledWith('moderation');
      expect(result).toEqual({ status: 'ok', room: 'moderation' });
    });

    it('should allow joining automation room', () => {
      const client = { id: 'c1', join: jest.fn() };

      const result = gateway.handleJoin(client as any, 'automation');

      expect(client.join).toHaveBeenCalledWith('automation');
      expect(result).toEqual({ status: 'ok', room: 'automation' });
    });

    it('should allow joining system room', () => {
      const client = { id: 'c1', join: jest.fn() };

      const result = gateway.handleJoin(client as any, 'system');

      expect(client.join).toHaveBeenCalledWith('system');
      expect(result).toEqual({ status: 'ok', room: 'system' });
    });

    it('should allow joining qr-auth scoped rooms', () => {
      const client = { id: 'c1', join: jest.fn() };

      const result = gateway.handleJoin(client as any, 'qr-auth:conn-99');

      expect(client.join).toHaveBeenCalledWith('qr-auth:conn-99');
      expect(result).toEqual({ status: 'ok', room: 'qr-auth:conn-99' });
    });

    it('should reject invalid room names', () => {
      const client = { id: 'c1', join: jest.fn() };

      const result = gateway.handleJoin(client as any, 'invalid-room');

      expect(client.join).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'error', message: 'Invalid room' });
    });
  });

  describe('handleLeave', () => {
    it('should leave a room', () => {
      const client = { id: 'c1', leave: jest.fn() };

      const result = gateway.handleLeave(client as any, 'moderation');

      expect(client.leave).toHaveBeenCalledWith('moderation');
      expect(result).toEqual({ status: 'ok', room: 'moderation' });
    });
  });
});
