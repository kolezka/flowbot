import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { EventBusService } from './event-bus.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
  namespace: '/events',
  transports: ['websocket', 'polling'],
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);

  constructor(private eventBus: EventBusService) {}

  afterInit() {
    this.eventBus.onModeration((event) => {
      this.server.to('moderation').emit('moderation', event);
    });

    this.eventBus.onAutomation((event) => {
      this.server.to('automation').emit('automation', event);
    });

    this.eventBus.onSystem((event) => {
      this.server.to('system').emit('system', event);
    });

    this.eventBus.onQrAuth((event) => {
      this.server.to(`qr-auth:${event.connectionId}`).emit('qr-auth', event);
    });

    this.eventBus.onFlowExecution((event) => {
      this.server
        .to(`flow:execution:${event.executionId}`)
        .emit('flow:execution:update', event);
    });

    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, room: string) {
    const validRooms = ['moderation', 'automation', 'system'];
    if (
      validRooms.includes(room) ||
      room.startsWith('qr-auth:') ||
      room.startsWith('flow:execution:')
    ) {
      client.join(room);
      this.logger.debug(`Client ${client.id} joined room: ${room}`);
      return { status: 'ok', room };
    }
    return { status: 'error', message: 'Invalid room' };
  }

  @SubscribeMessage('leave')
  handleLeave(client: Socket, room: string) {
    client.leave(room);
    this.logger.debug(`Client ${client.id} left room: ${room}`);
    return { status: 'ok', room };
  }
}
