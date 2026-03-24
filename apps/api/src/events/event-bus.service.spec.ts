import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('EventBusService', () => {
  let service: EventBusService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService, EventEmitter2],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('emitModeration', () => {
    it('should emit on both "moderation" and "moderation.<type>" channels', () => {
      const spy = jest.fn();
      const typeSpy = jest.fn();
      eventEmitter.on('moderation', spy);
      eventEmitter.on('moderation.warning.created', typeSpy);

      const event = {
        type: 'warning.created' as const,
        groupId: 'g1',
        data: { userId: 'u1' },
        timestamp: new Date(),
      };

      service.emitModeration(event);

      expect(spy).toHaveBeenCalledWith(event);
      expect(typeSpy).toHaveBeenCalledWith(event);
    });

    it('should emit different moderation event types', () => {
      const spy = jest.fn();
      eventEmitter.on('moderation.member.banned', spy);

      const event = {
        type: 'member.banned' as const,
        groupId: 'g1',
        data: {},
        timestamp: new Date(),
      };

      service.emitModeration(event);

      expect(spy).toHaveBeenCalledWith(event);
    });
  });

  describe('emitSystem', () => {
    it('should emit on "system" channel', () => {
      const spy = jest.fn();
      eventEmitter.on('system', spy);

      const event = {
        type: 'health.update' as const,
        data: { status: 'ok' },
        timestamp: new Date(),
      };

      service.emitSystem(event);

      expect(spy).toHaveBeenCalledWith(event);
    });
  });

  describe('onModeration', () => {
    it('should register handler that receives moderation events', () => {
      const handler = jest.fn();
      service.onModeration(handler);

      const event = {
        type: 'warning.created' as const,
        groupId: 'g1',
        data: {},
        timestamp: new Date(),
      };
      service.emitModeration(event);

      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  describe('onSystem', () => {
    it('should register handler that receives system events', () => {
      const handler = jest.fn();
      service.onSystem(handler);

      const event = {
        type: 'health.update' as const,
        data: {},
        timestamp: new Date(),
      };
      service.emitSystem(event);

      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  describe('multiple handlers', () => {
    it('should support multiple handlers on the same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      service.onModeration(handler1);
      service.onModeration(handler2);

      const event = {
        type: 'log.created' as const,
        groupId: 'g1',
        data: {},
        timestamp: new Date(),
      };
      service.emitModeration(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });
  });
});
