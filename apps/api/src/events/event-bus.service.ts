import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ModerationEvent,
  AutomationEvent,
  SystemEvent,
  QrAuthEvent,
  ExecutionUpdateEvent,
} from './event-types';

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

  emitQrAuth(event: QrAuthEvent): void {
    this.eventEmitter.emit('qr-auth', event);
  }

  onQrAuth(handler: (event: QrAuthEvent) => void): void {
    this.eventEmitter.on('qr-auth', handler);
  }

  emitFlowExecution(event: ExecutionUpdateEvent): void {
    this.eventEmitter.emit('flow:execution:update', event);
    this.eventEmitter.emit(`flow:execution:update:${event.executionId}`, event);
  }

  onFlowExecution(handler: (event: ExecutionUpdateEvent) => void): void {
    this.eventEmitter.on('flow:execution:update', handler);
  }
}
