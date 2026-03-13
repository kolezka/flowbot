import { describe, it, expect, vi, beforeEach } from 'vitest'
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
    guilds: { cache: { size: 5 } },
    channels: { fetch: vi.fn() },
    users: { fetch: vi.fn() },
  } as unknown as Client
}

describe('GET /health', () => {
  let client: Client
  let app: ReturnType<typeof createServer>

  beforeEach(() => {
    vi.clearAllMocks()
    client = createMockClient()
    app = createServer(client, config)
  })

  it('returns status ok with uptime and memory info', async () => {
    const req = new Request('http://localhost/health')
    const res = await app.fetch(req)
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.status).toBe('ok')
    expect(typeof body.uptime).toBe('number')

    // Bot info
    const bot = body.bot as any
    expect(bot.ready).toBe(true)
    expect(bot.username).toBe('TestBot#1234')
    expect(bot.guilds).toBe(5)

    // Memory info
    const memory = body.memory as any
    expect(typeof memory.rss).toBe('number')
    expect(typeof memory.heapUsed).toBe('number')
    expect(typeof memory.heapTotal).toBe('number')
  })

  it('reports null username when client.user is null', async () => {
    const nullUserClient = {
      isReady: vi.fn().mockReturnValue(false),
      user: null,
      guilds: { cache: { size: 0 } },
      channels: { fetch: vi.fn() },
      users: { fetch: vi.fn() },
    } as unknown as Client

    const appWithNullUser = createServer(nullUserClient, config)
    const req = new Request('http://localhost/health')
    const res = await appWithNullUser.fetch(req)
    const body = await res.json() as any
    const bot = body.bot as any
    expect(bot.ready).toBe(false)
    expect(bot.username).toBe(null)
    expect(bot.guilds).toBe(0)
  })
})
