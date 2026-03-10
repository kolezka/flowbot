import { Test, TestingModule } from '@nestjs/testing';
import { HealthPollerService } from './health-poller.service';
import { EventBusService } from './event-bus.service';

describe('HealthPollerService', () => {
  let service: HealthPollerService;
  let eventBus: EventBusService;

  beforeEach(async () => {
    jest.useFakeTimers();

    eventBus = {
      emitSystem: jest.fn(),
      emitModeration: jest.fn(),
      emitAutomation: jest.fn(),
      onModeration: jest.fn(),
      onAutomation: jest.fn(),
      onSystem: jest.fn(),
    } as unknown as EventBusService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthPollerService,
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<HealthPollerService>(HealthPollerService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should start the polling interval', () => {
      service.onModuleInit();
      expect(eventBus.emitSystem).not.toHaveBeenCalled();

      jest.advanceTimersByTime(30_000);
      expect(eventBus.emitSystem).toHaveBeenCalledTimes(1);
    });

    it('should poll every 30 seconds', () => {
      service.onModuleInit();

      jest.advanceTimersByTime(90_000);
      expect(eventBus.emitSystem).toHaveBeenCalledTimes(3);
    });

    it('should not poll before 30 seconds', () => {
      service.onModuleInit();

      jest.advanceTimersByTime(29_999);
      expect(eventBus.emitSystem).not.toHaveBeenCalled();
    });
  });

  describe('poll event format', () => {
    it('should emit a health.update system event', () => {
      service.onModuleInit();
      jest.advanceTimersByTime(30_000);

      expect(eventBus.emitSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health.update',
        }),
      );
    });

    it('should include uptime in event data', () => {
      service.onModuleInit();
      jest.advanceTimersByTime(30_000);

      const emitted = (eventBus.emitSystem as jest.Mock).mock.calls[0][0];
      expect(emitted.data).toHaveProperty('uptime');
      expect(typeof emitted.data.uptime).toBe('number');
    });

    it('should include memoryUsage in event data', () => {
      service.onModuleInit();
      jest.advanceTimersByTime(30_000);

      const emitted = (eventBus.emitSystem as jest.Mock).mock.calls[0][0];
      expect(emitted.data).toHaveProperty('memoryUsage');
      expect(typeof emitted.data.memoryUsage).toBe('number');
    });

    it('should include timestamp in event data', () => {
      service.onModuleInit();
      jest.advanceTimersByTime(30_000);

      const emitted = (eventBus.emitSystem as jest.Mock).mock.calls[0][0];
      expect(emitted.data).toHaveProperty('timestamp');
      expect(typeof emitted.data.timestamp).toBe('number');
    });

    it('should include a Date timestamp on the event itself', () => {
      service.onModuleInit();
      jest.advanceTimersByTime(30_000);

      const emitted = (eventBus.emitSystem as jest.Mock).mock.calls[0][0];
      expect(emitted.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop polling after destroy', () => {
      service.onModuleInit();
      jest.advanceTimersByTime(30_000);
      expect(eventBus.emitSystem).toHaveBeenCalledTimes(1);

      service.onModuleDestroy();

      jest.advanceTimersByTime(60_000);
      expect(eventBus.emitSystem).toHaveBeenCalledTimes(1);
    });

    it('should handle destroy when init was never called', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });
});
