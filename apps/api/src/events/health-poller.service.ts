import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventBusService } from './event-bus.service';

@Injectable()
export class HealthPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthPollerService.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private eventBus: EventBusService) {}

  onModuleInit() {
    this.intervalId = setInterval(() => this.poll(), 30_000);
    this.logger.log('Health poller started (30s interval)');
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private poll() {
    this.eventBus.emitSystem({
      type: 'health.update',
      data: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: Date.now(),
      },
      timestamp: new Date(),
    });
  }
}
