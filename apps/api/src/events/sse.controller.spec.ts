import { Test, TestingModule } from '@nestjs/testing';
import { SseController } from './sse.controller';
import { EventBusService } from './event-bus.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ModerationEvent, SystemEvent } from './event-types';
import { firstValueFrom, take, toArray } from 'rxjs';

describe('SseController', () => {
  let controller: SseController;
  let eventBus: EventBusService;

  const moderationEvent: ModerationEvent = {
    type: 'warning.created',
    groupId: 'g1',
    data: { userId: 'u1' },
    timestamp: new Date('2026-03-10'),
  };

  const systemEvent: SystemEvent = {
    type: 'health.update',
    data: { uptime: 1000 },
    timestamp: new Date('2026-03-10'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService, EventEmitter2],
      controllers: [SseController],
    }).compile();

    controller = module.get<SseController>(SseController);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('stream', () => {
    it('should return an observable', () => {
      const result = controller.stream();
      expect(result).toBeDefined();
      expect(result.subscribe).toBeDefined();
    });

    it('should emit moderation events when subscribed to all rooms', async () => {
      const stream$ = controller.stream();
      const eventPromise = firstValueFrom(stream$.pipe(take(1)));

      eventBus.emitModeration(moderationEvent);

      const msg = await eventPromise;
      expect(msg.data).toBe(JSON.stringify(moderationEvent));
      expect(msg.type).toBe('warning.created');
    });

    it('should emit system events when subscribed to all rooms', async () => {
      const stream$ = controller.stream();
      const eventPromise = firstValueFrom(stream$.pipe(take(1)));

      eventBus.emitSystem(systemEvent);

      const msg = await eventPromise;
      expect(msg.data).toBe(JSON.stringify(systemEvent));
      expect(msg.type).toBe('health.update');
    });

    it('should filter to only moderation room', async () => {
      const stream$ = controller.stream('moderation');
      const eventPromise = firstValueFrom(stream$.pipe(take(1)));

      // These should be filtered out
      eventBus.emitSystem(systemEvent);
      // This should pass through
      eventBus.emitModeration(moderationEvent);

      const msg = await eventPromise;
      expect(msg.data).toBe(JSON.stringify(moderationEvent));
    });

    it('should filter to only system room', async () => {
      const stream$ = controller.stream('system');
      const eventPromise = firstValueFrom(stream$.pipe(take(1)));

      eventBus.emitModeration(moderationEvent);
      eventBus.emitSystem(systemEvent);

      const msg = await eventPromise;
      expect(msg.data).toBe(JSON.stringify(systemEvent));
    });

    it('should support multiple comma-separated rooms', async () => {
      const stream$ = controller.stream('moderation,system');
      const eventPromise = firstValueFrom(stream$.pipe(take(2), toArray()));

      eventBus.emitModeration(moderationEvent);
      eventBus.emitSystem(systemEvent);

      const msgs = await eventPromise;
      expect(msgs).toHaveLength(2);
      expect(msgs[0]!.type).toBe('warning.created');
      expect(msgs[1]!.type).toBe('health.update');
    });

    it('should format MessageEvent with data and type fields', async () => {
      const stream$ = controller.stream();
      const eventPromise = firstValueFrom(stream$.pipe(take(1)));

      eventBus.emitModeration(moderationEvent);

      const msg = await eventPromise;
      expect(msg).toEqual({
        data: JSON.stringify(moderationEvent),
        type: 'warning.created',
      });
    });

    it('should handle different moderation event types', async () => {
      const stream$ = controller.stream('moderation');
      const bannedEvent: ModerationEvent = {
        type: 'member.banned',
        groupId: 'g2',
        data: { reason: 'spam' },
        timestamp: new Date(),
      };

      const eventPromise = firstValueFrom(stream$.pipe(take(1)));
      eventBus.emitModeration(bannedEvent);

      const msg = await eventPromise;
      expect(JSON.parse(msg.data)).toEqual(expect.objectContaining({ type: 'member.banned', groupId: 'g2' }));
    });

    it('should default to all rooms when rooms parameter is undefined', async () => {
      const stream$ = controller.stream(undefined);
      const eventPromise = firstValueFrom(stream$.pipe(take(2), toArray()));

      eventBus.emitModeration(moderationEvent);
      eventBus.emitSystem(systemEvent);

      const msgs = await eventPromise;
      expect(msgs).toHaveLength(2);
    });
  });
});
