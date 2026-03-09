import { Module } from '@nestjs/common';
import { ScheduledMessagesController } from './scheduled-messages.controller';
import { ScheduledMessagesService } from './scheduled-messages.service';

@Module({
  controllers: [ScheduledMessagesController],
  providers: [ScheduledMessagesService],
  exports: [ScheduledMessagesService],
})
export class ScheduledMessagesModule {}
