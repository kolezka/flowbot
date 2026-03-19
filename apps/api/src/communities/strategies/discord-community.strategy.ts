import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  IPlatformStrategy,
  PlatformStrategyRegistry,
} from '../../platform/strategy-registry.service';
import { PLATFORMS } from '../../platform/platform.constants';

@Injectable()
export class DiscordCommunityStrategy implements IPlatformStrategy, OnModuleInit {
  platform = PLATFORMS.DISCORD;

  constructor(private registry: PlatformStrategyRegistry) {}

  onModuleInit() {
    this.registry.register('communities', this);
  }
}
