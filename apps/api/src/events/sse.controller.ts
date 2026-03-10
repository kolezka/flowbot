import { Controller, Sse, Query, Logger } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';
import { EventBusService } from './event-bus.service';
import type { AppEvent } from './event-types';

interface MessageEvent {
  data: string;
  type?: string;
  id?: string;
}

@Controller('api/events')
export class SseController {
  private readonly logger = new Logger(SseController.name);
  private readonly eventSubject = new Subject<AppEvent>();

  constructor(private eventBus: EventBusService) {
    this.eventBus.onModeration((event) => this.eventSubject.next(event));
    this.eventBus.onAutomation((event) => this.eventSubject.next(event));
    this.eventBus.onSystem((event) => this.eventSubject.next(event));
  }

  @Sse('stream')
  stream(@Query('rooms') rooms?: string): Observable<MessageEvent> {
    const roomList = rooms?.split(',') ?? ['moderation', 'automation', 'system'];

    this.logger.debug(`SSE client connected, rooms: ${roomList.join(',')}`);

    return this.eventSubject.pipe(
      filter((event) => {
        if ('groupId' in event) return roomList.includes('moderation');
        if ('jobId' in event) return roomList.includes('automation');
        return roomList.includes('system');
      }),
      map((event) => ({
        data: JSON.stringify(event),
        type: event.type,
      })),
    );
  }
}
