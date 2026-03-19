import { Global, Module } from '@nestjs/common';
import { PlatformStrategyRegistry } from './strategy-registry.service';

@Global()
@Module({
  providers: [PlatformStrategyRegistry],
  exports: [PlatformStrategyRegistry],
})
export class PlatformModule {}
