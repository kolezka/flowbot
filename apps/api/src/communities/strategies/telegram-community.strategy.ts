import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  IPlatformStrategy,
  PlatformStrategyRegistry,
} from '../../platform/strategy-registry.service';
import { PLATFORMS } from '../../platform/platform.constants';

@Injectable()
export class TelegramCommunityStrategy implements IPlatformStrategy, OnModuleInit {
  platform = PLATFORMS.TELEGRAM;

  constructor(private registry: PlatformStrategyRegistry) {}

  onModuleInit() {
    this.registry.register('communities', this);
  }
}
