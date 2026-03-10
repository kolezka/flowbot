import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';
import { WsGateway } from './ws.gateway';
import { SseController } from './sse.controller';
import { HealthPollerService } from './health-poller.service';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [SseController],
  providers: [EventBusService, WsGateway, HealthPollerService],
  exports: [EventBusService],
})
export class EventsModule {}
