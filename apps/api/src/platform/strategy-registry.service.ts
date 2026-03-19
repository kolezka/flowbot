import { Injectable, Logger } from '@nestjs/common';

export interface IPlatformStrategy {
  platform: string;
}

@Injectable()
export class PlatformStrategyRegistry {
  private readonly logger = new Logger(PlatformStrategyRegistry.name);
  private readonly strategies = new Map<string, Map<string, IPlatformStrategy>>();

  register(module: string, strategy: IPlatformStrategy): void {
    if (!this.strategies.has(module)) {
      this.strategies.set(module, new Map());
    }
    this.strategies.get(module)!.set(strategy.platform, strategy);
    this.logger.log(`Registered ${strategy.platform} strategy for ${module}`);
  }

  get<T extends IPlatformStrategy>(module: string, platform: string): T {
    const moduleStrategies = this.strategies.get(module);
    if (!moduleStrategies) {
      throw new Error(`No strategies registered for module: ${module}`);
    }
    const strategy = moduleStrategies.get(platform);
    if (!strategy) {
      throw new Error(`No ${platform} strategy registered for module: ${module}`);
    }
    return strategy as T;
  }

  getAll(module: string): IPlatformStrategy[] {
    const moduleStrategies = this.strategies.get(module);
    if (!moduleStrategies) {
      return [];
    }
    return Array.from(moduleStrategies.values());
  }

  supports(module: string, platform: string): boolean {
    return this.strategies.get(module)?.has(platform) ?? false;
  }
}
