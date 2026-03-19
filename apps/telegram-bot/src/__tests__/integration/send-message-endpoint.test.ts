import { describe, expect, it, vi } from 'vitest'
import { createApiServer } from '../../server/index.js'

function createMockDeps() {
  return {
    botApi: {
      sendMessage: vi.fn(),
    } as any,
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any,
    prisma: {
      managedGroup: { count: vi.fn().mockResolvedValue(0) },
    } as any,
  }
}

function jsonRequest(app: ReturnType<typeof createApiServer>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/send-message', () => {
  it('should send a message successfully', async () => {
    const deps = createMockDeps()
    deps.botApi.sendMessage.mockResolvedValue({ message_id: 42 })
    const app = createApiServer(deps)

    const res = await jsonRequest(app, '/api/send-message', {
      chatId: '123',
      text: 'Hello world',
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>
    expect(json).toEqual({ success: true, messageId: 42 })
    expect(deps.botApi.sendMessage).toHaveBeenCalledWith('123', 'Hello world', {
      parse_mode: 'HTML',
    })
  })

  it('should return 400 when chatId is missing', async () => {
    const deps = createMockDeps()
    const app = createApiServer(deps)

    const res = await jsonRequest(app, '/api/send-message', {
      text: 'Hello world',
    })

    expect(res.status).toBe(400)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.success).toBe(false)
    expect(json.error).toContain('chatId')
  })

  it('should return 400 when text is missing', async () => {
    const deps = createMockDeps()
    const app = createApiServer(deps)

    const res = await jsonRequest(app, '/api/send-message', {
      chatId: '123',
    })

    expect(res.status).toBe(400)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.success).toBe(false)
    expect(json.error).toContain('text')
  })

  it('should return 500 when botApi.sendMessage throws', async () => {
    const deps = createMockDeps()
    deps.botApi.sendMessage.mockRejectedValue(new Error('Telegram API down'))
    const app = createApiServer(deps)

    const res = await jsonRequest(app, '/api/send-message', {
      chatId: '123',
      text: 'Hello',
    })

    expect(res.status).toBe(500)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.success).toBe(false)
    expect(json.error).toBe('Telegram API down')
  })
})
