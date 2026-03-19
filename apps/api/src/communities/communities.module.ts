import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { TelegramCommunityStrategy } from './strategies/telegram-community.strategy';
import { DiscordCommunityStrategy } from './strategies/discord-community.strategy';
import { CommunityWarningsController } from './community-warnings.controller';
import { CommunityWarningsService } from './community-warnings.service';
import { CommunityLogsController } from './community-logs.controller';
import { CommunityLogsService } from './community-logs.service';
import { CommunityScheduledController } from './community-scheduled.controller';
import { CommunityScheduledService } from './community-scheduled.service';

@Module({
  controllers: [
    CommunitiesController,
    MembersController,
    CommunityWarningsController,
    CommunityLogsController,
    CommunityScheduledController,
  ],
  providers: [
    CommunitiesService,
    MembersService,
    TelegramCommunityStrategy,
    DiscordCommunityStrategy,
    CommunityWarningsService,
    CommunityLogsService,
    CommunityScheduledService,
  ],
  exports: [CommunitiesService, MembersService],
})
export class CommunitiesModule {}
