import { Controller, Sse, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Observable, Subject, filter, map } from 'rxjs';
import { EventBusService } from './event-bus.service';
import type {
  AppEvent,
  ModerationEvent,
  AutomationEvent,
  SystemEvent,
} from './event-types';

type RoomEvent = ModerationEvent | AutomationEvent | SystemEvent;

interface MessageEvent {
  data: string;
  type?: string;
  id?: string;
}

@ApiTags('Events')
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
  @ApiOperation({ summary: 'Subscribe to real-time event stream (SSE)' })
  @ApiQuery({
    name: 'rooms',
    required: false,
    type: String,
    description: 'Comma-separated room names (moderation, automation, system)',
  })
  @ApiResponse({ status: 200, description: 'SSE stream of events' })
  stream(@Query('rooms') rooms?: string): Observable<MessageEvent> {
    const roomList = rooms?.split(',') ?? [
      'moderation',
      'automation',
      'system',
    ];

    this.logger.debug(`SSE client connected, rooms: ${roomList.join(',')}`);

    return this.eventSubject.pipe(
      filter((event) => {
        if ('groupId' in event) return roomList.includes('moderation');
        if ('jobId' in event) return roomList.includes('automation');
        return roomList.includes('system');
      }),
      map((event) => ({
        data: JSON.stringify(event),
        type: (event as RoomEvent).type,
      })),
    );
  }
}
