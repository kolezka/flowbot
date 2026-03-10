import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ModerationEvent, AutomationEvent, SystemEvent } from './event-types';

@Injectable()
export class EventBusService {
  constructor(private eventEmitter: EventEmitter2) {}

  emitModeration(event: ModerationEvent): void {
    this.eventEmitter.emit('moderation', event);
    this.eventEmitter.emit(`moderation.${event.type}`, event);
  }

  emitAutomation(event: AutomationEvent): void {
    this.eventEmitter.emit('automation', event);
    this.eventEmitter.emit(`automation.${event.type}`, event);
  }

  emitSystem(event: SystemEvent): void {
    this.eventEmitter.emit('system', event);
  }

  onModeration(handler: (event: ModerationEvent) => void): void {
    this.eventEmitter.on('moderation', handler);
  }

  onAutomation(handler: (event: AutomationEvent) => void): void {
    this.eventEmitter.on('automation', handler);
  }

  onSystem(handler: (event: SystemEvent) => void): void {
    this.eventEmitter.on('system', handler);
  }
}
