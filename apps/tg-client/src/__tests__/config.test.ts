import { describe, expect, it } from 'vitest'
import { createConfig } from '../config.js'

describe('createConfig', () => {
  const validInput = {
    tgClientApiId: '12345',
    tgClientApiHash: 'abc123hash',
    databaseUrl: 'postgresql://localhost:5432/test',
  }

  it('creates config with valid required env vars', () => {
    const config = createConfig(validInput)

    expect(config.tgClientApiId).toBe(12345)
    expect(config.tgClientApiHash).toBe('abc123hash')
    expect(config.databaseUrl).toBe('postgresql://localhost:5432/test')
  })

  it('applies default values for optional fields', () => {
    const config = createConfig(validInput)

    expect(config.logLevel).toBe('info')
    expect(config.isDebug).toBe(false)
    expect(config.schedulerPollIntervalMs).toBe(5000)
    expect(config.schedulerMaxRetries).toBe(3)
    expect(config.backoffBaseMs).toBe(1000)
    expect(config.backoffMaxMs).toBe(60000)
    expect(config.healthServerPort).toBe(3002)
    expect(config.healthServerHost).toBe('0.0.0.0')
  })

  it('accepts optional overrides', () => {
    const config = createConfig({
      ...validInput,
      logLevel: 'debug',
      debug: 'true',
      schedulerPollIntervalMs: '10000',
      schedulerMaxRetries: '5',
      backoffBaseMs: '2000',
      backoffMaxMs: '120000',
      healthServerPort: '4000',
      healthServerHost: '127.0.0.1',
      tgClientSession: 'session-string',
    })

    expect(config.logLevel).toBe('debug')
    expect(config.isDebug).toBe(true)
    expect(config.schedulerPollIntervalMs).toBe(10000)
    expect(config.schedulerMaxRetries).toBe(5)
    expect(config.backoffBaseMs).toBe(2000)
    expect(config.backoffMaxMs).toBe(120000)
    expect(config.healthServerPort).toBe(4000)
    expect(config.healthServerHost).toBe('127.0.0.1')
    expect(config.tgClientSession).toBe('session-string')
  })

  it('throws on missing required tgClientApiId', () => {
    const { tgClientApiId: _, ...missing } = validInput
    expect(() => createConfig(missing as any)).toThrow()
  })

  it('throws on missing required tgClientApiHash', () => {
    const { tgClientApiHash: _, ...missing } = validInput
    expect(() => createConfig(missing as any)).toThrow()
  })

  it('throws on missing required databaseUrl', () => {
    const { databaseUrl: _, ...missing } = validInput
    expect(() => createConfig(missing as any)).toThrow()
  })

  it('throws on empty tgClientApiHash', () => {
    expect(() => createConfig({ ...validInput, tgClientApiHash: '' })).toThrow()
  })

  it('throws on non-numeric tgClientApiId', () => {
    expect(() => createConfig({ ...validInput, tgClientApiId: 'not-a-number' })).toThrow()
  })

  it('throws on invalid logLevel', () => {
    expect(() => createConfig({ ...validInput, logLevel: 'invalid' as any })).toThrow()
  })
})
