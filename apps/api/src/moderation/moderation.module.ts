import { Module } from '@nestjs/common';
import { GroupsModule } from './groups/groups.module';
import { LogsModule } from './logs/logs.module';
import { WarningsModule } from './warnings/warnings.module';
import { MembersModule } from './members/members.module';
import { ScheduledMessagesModule } from './scheduled-messages/scheduled-messages.module';

@Module({
  imports: [GroupsModule, LogsModule, WarningsModule, MembersModule, ScheduledMessagesModule],
  exports: [GroupsModule, LogsModule, WarningsModule, MembersModule, ScheduledMessagesModule],
})
export class ModerationModule {}
