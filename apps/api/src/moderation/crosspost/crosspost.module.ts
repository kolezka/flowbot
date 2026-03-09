import { Module } from '@nestjs/common';
import { CrossPostController } from './crosspost.controller';
import { CrossPostService } from './crosspost.service';

@Module({
  controllers: [CrossPostController],
  providers: [CrossPostService],
  exports: [CrossPostService],
})
export class CrossPostModule {}
