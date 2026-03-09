import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { CartModule } from './cart/cart.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { ModerationModule } from './moderation/moderation.module';
import { ReputationModule } from './reputation/reputation.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    CartModule,
    AnalyticsModule,
    BroadcastModule,
    ModerationModule,
    ReputationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
