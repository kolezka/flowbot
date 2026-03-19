import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { TelegramCommunityStrategy } from './strategies/telegram-community.strategy';
import { DiscordCommunityStrategy } from './strategies/discord-community.strategy';

@Module({
  controllers: [CommunitiesController, MembersController],
  providers: [
    CommunitiesService,
    MembersService,
    TelegramCommunityStrategy,
    DiscordCommunityStrategy,
  ],
  exports: [CommunitiesService, MembersService],
})
export class CommunitiesModule {}
