import { Module } from '@nestjs/common';
import { TgClientController } from './tg-client.controller';
import { TgClientService } from './tg-client.service';

@Module({
  controllers: [TgClientController],
  providers: [TgClientService],
  exports: [TgClientService],
})
export class TgClientModule {}
