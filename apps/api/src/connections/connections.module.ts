import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { QrAuthController } from './qr-auth.controller';
import { TelegramConnectionStrategy } from './strategies/telegram-connection.strategy';
import { DiscordOauthStrategy } from './strategies/discord-oauth.strategy';
import { WhatsAppBaileysStrategy } from './strategies/whatsapp-baileys.strategy';

@Module({
  controllers: [ConnectionsController, QrAuthController],
  providers: [
    ConnectionsService,
    TelegramConnectionStrategy,
    DiscordOauthStrategy,
    WhatsAppBaileysStrategy,
  ],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
