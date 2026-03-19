import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { TelegramMtprotoStrategy } from './strategies/telegram-mtproto.strategy';
import { DiscordOauthStrategy } from './strategies/discord-oauth.strategy';

@Module({
  controllers: [ConnectionsController],
  providers: [ConnectionsService, TelegramMtprotoStrategy, DiscordOauthStrategy],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
