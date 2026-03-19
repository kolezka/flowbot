import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { QrAuthController } from './qr-auth.controller';
import { TelegramMtprotoStrategy } from './strategies/telegram-mtproto.strategy';
import { DiscordOauthStrategy } from './strategies/discord-oauth.strategy';
import { WhatsAppBaileysStrategy } from './strategies/whatsapp-baileys.strategy';

@Module({
  controllers: [ConnectionsController, QrAuthController],
  providers: [ConnectionsService, TelegramMtprotoStrategy, DiscordOauthStrategy, WhatsAppBaileysStrategy],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
