import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ModerationModule } from './moderation/moderation.module';
import { SystemModule } from './system/system.module';
import { EventsModule } from './events/events.module';
import { BotConfigModule } from './bot-config/bot-config.module';
import { FlowsModule } from './flows/flows.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { IdentityModule } from './identity/identity.module';
import { ConnectionsModule } from './connections/connections.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PlatformModule,
    AuthModule,
    PrismaModule,
    UsersModule,
    AnalyticsModule,
    ModerationModule,
    SystemModule,
    EventsModule,
    BotConfigModule,
    FlowsModule,
    WebhooksModule,
    IdentityModule,
    ConnectionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
