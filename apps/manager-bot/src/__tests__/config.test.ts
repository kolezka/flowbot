import { describe, expect, it } from 'vitest'
import { createConfig } from '../config.js'

describe('createConfig', () => {
  const validPollingInput = {
    botMode: 'polling' as const,
    botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    databaseUrl: 'postgresql://localhost:5432/test',
  }

  it('creates a valid polling config with minimal input', () => {
    const config = createConfig(validPollingInput)
    expect(config.botMode).toBe('polling')
    expect(config.isPollingMode).toBe(true)
    expect(config.isWebhookMode).toBe(false)
    expect(config.botToken).toBe(validPollingInput.botToken)
    expect(config.databaseUrl).toBe(validPollingInput.databaseUrl)
  })

  it('applies defaults for optional fields', () => {
    const config = createConfig(validPollingInput)
    expect(config.logLevel).toBe('info')
    expect(config.isDebug).toBe(false)
    expect(config.botAdmins).toEqual([])
  })

  it('parses custom log level', () => {
    const config = createConfig({ ...validPollingInput, logLevel: 'debug' })
    expect(config.logLevel).toBe('debug')
  })

  it('parses botAdmins as JSON array', () => {
    const config = createConfig({ ...validPollingInput, botAdmins: '[100, 200]' })
    expect(config.botAdmins).toEqual([100, 200])
  })

  it('throws on invalid bot token format', () => {
    expect(() => createConfig({ ...validPollingInput, botToken: 'invalid-token' })).toThrow()
  })

  it('throws on missing required fields', () => {
    expect(() => createConfig({ botMode: 'polling' as const } as any)).toThrow()
  })

  it('throws on invalid log level', () => {
    expect(() => createConfig({ ...validPollingInput, logLevel: 'invalid' as any })).toThrow()
  })

  it('creates a valid webhook config', () => {
    const config = createConfig({
      botMode: 'webhook' as const,
      botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      databaseUrl: 'postgresql://localhost:5432/test',
      botWebhook: 'https://example.com/webhook',
      botWebhookSecret: 'supersecretkey12',
    })
    expect(config.botMode).toBe('webhook')
    expect(config.isWebhookMode).toBe(true)
    expect(config.isPollingMode).toBe(false)
  })

  it('throws on webhook config missing required webhook fields', () => {
    expect(() =>
      createConfig({
        botMode: 'webhook' as const,
        botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        databaseUrl: 'postgresql://localhost:5432/test',
      } as any),
    ).toThrow()
  })

  it('throws on webhook secret that is too short', () => {
    expect(() =>
      createConfig({
        botMode: 'webhook' as const,
        botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        databaseUrl: 'postgresql://localhost:5432/test',
        botWebhook: 'https://example.com/webhook',
        botWebhookSecret: 'short',
      }),
    ).toThrow()
  })
})
