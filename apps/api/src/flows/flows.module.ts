import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { CorrelationService } from './correlation.service';

@Module({
  controllers: [FlowsController],
  providers: [FlowsService, CorrelationService],
  exports: [FlowsService, CorrelationService],
})
export class FlowsModule {}
