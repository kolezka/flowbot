import { Test, TestingModule } from '@nestjs/testing';
import { PlatformStrategyRegistry, IPlatformStrategy } from './strategy-registry.service';

class TestStrategy implements IPlatformStrategy {
  platform = 'telegram';
}

class AnotherStrategy implements IPlatformStrategy {
  platform = 'discord';
}

describe('PlatformStrategyRegistry', () => {
  let registry: PlatformStrategyRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformStrategyRegistry],
    }).compile();

    registry = module.get(PlatformStrategyRegistry);
  });

  it('should register and retrieve a strategy', () => {
    const strategy = new TestStrategy();
    registry.register('moderation', strategy);
    const result = registry.get<TestStrategy>('moderation', 'telegram');
    expect(result).toBe(strategy);
  });

  it('should throw for unregistered module', () => {
    expect(() => registry.get('unknown', 'telegram')).toThrow();
  });

  it('should throw for unregistered platform', () => {
    registry.register('moderation', new TestStrategy());
    expect(() => registry.get('moderation', 'slack')).toThrow();
  });

  it('should return all strategies for a module', () => {
    const tg = new TestStrategy();
    const dc = new AnotherStrategy();
    registry.register('moderation', tg);
    registry.register('moderation', dc);
    const all = registry.getAll('moderation');
    expect(all).toHaveLength(2);
  });

  it('should check if platform is supported', () => {
    registry.register('moderation', new TestStrategy());
    expect(registry.supports('moderation', 'telegram')).toBe(true);
    expect(registry.supports('moderation', 'discord')).toBe(false);
  });
});
