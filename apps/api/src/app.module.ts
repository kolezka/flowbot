import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { ModerationModule } from './moderation/moderation.module';
import { ReputationModule } from './reputation/reputation.module';
import { SystemModule } from './system/system.module';
import { EventsModule } from './events/events.module';
import { BotConfigModule } from './bot-config/bot-config.module';
import { TgClientModule } from './tg-client/tg-client.module';
import { FlowsModule } from './flows/flows.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AutomationModule } from './automation/automation.module';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { IdentityModule } from './identity/identity.module';
import { CommunitiesModule } from './communities/communities.module';

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
    BroadcastModule,
    ModerationModule,
    ReputationModule,
    SystemModule,
    EventsModule,
    BotConfigModule,
    TgClientModule,
    FlowsModule,
    WebhooksModule,
    AutomationModule,
    IdentityModule,
    CommunitiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
