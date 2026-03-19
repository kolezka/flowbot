import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  IPlatformStrategy,
  PlatformStrategyRegistry,
} from '../../platform/strategy-registry.service';
import { PLATFORMS } from '../../platform/platform.constants';

@Injectable()
export class WhatsAppBaileysStrategy implements IPlatformStrategy, OnModuleInit {
  readonly platform = PLATFORMS.WHATSAPP;
  constructor(private readonly registry: PlatformStrategyRegistry) {}
  onModuleInit(): void {
    this.registry.register('connections', this);
  }
}
