import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Client } from 'discord.js'
import { createServer } from '../../server/index.js'
import type { Config } from '../../config.js'

const config: Config = {
  discordBotToken: 'test-token',
  discordClientId: 'test-client-id',
  databaseUrl: 'postgres://localhost/test',
  apiUrl: 'http://localhost:3000',
  port: 3003,
}

function createMockClient() {
  return {
    isReady: vi.fn().mockReturnValue(true),
    user: { tag: 'TestBot#1234' },
    guilds: { cache: { size: 1 } },
    channels: { fetch: vi.fn() },
    users: { fetch: vi.fn() },
  } as unknown as Client
}

describe('POST /api/flow-event', () => {
  let client: Client
  let app: ReturnType<typeof createServer>
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    client = createMockClient()
    app = createServer(client, config)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('forwards event to flow webhook and returns result', async () => {
    const webhookResponse = { processed: true }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(webhookResponse),
      text: vi.fn().mockResolvedValue(''),
    })

    const req = new Request('http://localhost/api/flow-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'discord_message_received',
        data: { channelId: 'ch-1', content: 'Hello' },
      }),
    })

    const res = await app.fetch(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result).toEqual(webhookResponse)

    // Verify the upstream call was made correctly
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/flow/webhook',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"platform":"discord"'),
      }),
    )
  })

  it('returns 400 when eventType is missing', async () => {
    const req = new Request('http://localhost/api/flow-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { channelId: 'ch-1' } }),
    })

    const res = await app.fetch(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('eventType is required')
  })

  it('returns 502 when upstream API responds with error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    })

    const req = new Request('http://localhost/api/flow-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'discord_member_join',
        data: { userId: 'u-1' },
      }),
    })

    const res = await app.fetch(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('500')
  })

  it('returns 500 when fetch throws a network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))

    const req = new Request('http://localhost/api/flow-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'discord_reaction_add',
        data: { emoji: '👍' },
      }),
    })

    const res = await app.fetch(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Network failure')
  })
})
