import { describe, expect, it } from 'vitest'
import { createConfig } from './config.js'

const validBase = {
  botMode: 'polling' as const,
  botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  databaseUrl: 'postgresql://localhost:5432/test',
}

describe('createConfig', () => {
  it('creates polling config with defaults', () => {
    const config = createConfig({ ...validBase })
    expect(config.botMode).toBe('polling')
    expect(config.isPollingMode).toBe(true)
    expect(config.isWebhookMode).toBe(false)
    expect(config.logLevel).toBe('info')
    expect(config.isDebug).toBe(false)
    expect(config.botAdmins).toEqual([])
    expect(config.botAllowedUpdates).toContain('chat_member')
    expect(config.botAllowedUpdates).toContain('my_chat_member')
    expect(config.botAllowedUpdates).toContain('message')
    expect(config.botAllowedUpdates).toContain('callback_query')
    expect(config.botAllowedUpdates).toContain('edited_message')
    expect(config.botAllowedUpdates).toContain('chat_join_request')
  })

  it('creates webhook config with required fields', () => {
    const config = createConfig({
      ...validBase,
      botMode: 'webhook',
      botWebhook: 'https://example.com/webhook',
      botWebhookSecret: 'supersecretkey123',
    })
    expect(config.botMode).toBe('webhook')
    expect(config.isWebhookMode).toBe(true)
    expect(config.isPollingMode).toBe(false)
  })

  it('throws on missing BOT_TOKEN', () => {
    expect(() => createConfig({ databaseUrl: 'postgresql://localhost' } as any))
      .toThrow()
  })

  it('throws on missing DATABASE_URL', () => {
    expect(() => createConfig({ botToken: '123456:ABC-DEF' } as any))
      .toThrow()
  })

  it('throws on invalid BOT_TOKEN format', () => {
    expect(() => createConfig({ ...validBase, botToken: 'invalid-token' }))
      .toThrow()
  })

  it('throws on invalid BOT_MODE', () => {
    expect(() => createConfig({ ...validBase, botMode: 'invalid' } as any))
      .toThrow()
  })

  it('parses BOT_ADMINS as JSON array of numbers', () => {
    const config = createConfig({ ...validBase, botAdmins: '[111, 222]' })
    expect(config.botAdmins).toEqual([111, 222])
  })

  it('parses custom BOT_ALLOWED_UPDATES', () => {
    const config = createConfig({ ...validBase, botAllowedUpdates: '["message"]' })
    expect(config.botAllowedUpdates).toEqual(['message'])
  })
})
