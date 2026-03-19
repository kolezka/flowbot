import { describe, expect, it } from 'vitest'
import { createConfig } from '../config.js'

describe('config', () => {
  it('validates required fields', () => {
    expect(() => createConfig({} as any)).toThrow()
  })

  it('accepts valid config', () => {
    const config = createConfig({
      waConnectionId: 'conn-123',
      waBotInstanceId: 'bot-456',
      databaseUrl: 'postgresql://localhost:5432/test',
    })
    expect(config.waConnectionId).toBe('conn-123')
    expect(config.apiServerPort).toBe(3004)
    expect(config.logLevel).toBe('info')
  })
})
