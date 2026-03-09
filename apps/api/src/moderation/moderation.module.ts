import { Module } from '@nestjs/common';
import { GroupsModule } from './groups/groups.module';
import { LogsModule } from './logs/logs.module';
import { WarningsModule } from './warnings/warnings.module';
import { MembersModule } from './members/members.module';

@Module({
  imports: [GroupsModule, LogsModule, WarningsModule, MembersModule],
  exports: [GroupsModule, LogsModule, WarningsModule, MembersModule],
})
export class ModerationModule {}
