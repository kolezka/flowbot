import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiServer } from '../../server/index.js'

function createMockDeps(apiUrl?: string) {
  return {
    botApi: {} as any,
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
    prisma: { managedGroup: { count: vi.fn().mockResolvedValue(0) } } as any,
    apiUrl,
  }
}

function jsonRequest(app: ReturnType<typeof createApiServer>, body: unknown) {
  return app.request('/api/flow-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/flow-event', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('should forward event successfully', async () => {
    const upstreamResult = { processed: true }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(upstreamResult),
      text: () => Promise.resolve(JSON.stringify(upstreamResult)),
    })

    const deps = createMockDeps('http://test-api:3000')
    const app = createApiServer(deps)
    const res = await jsonRequest(app, { eventType: 'user_joined', data: { userId: 1 } })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, result: upstreamResult })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://test-api:3000/api/flow/webhook',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ eventType: 'user_joined', data: { userId: 1 } }),
      }),
    )
  })

  it('should return 400 when eventType is missing', async () => {
    const deps = createMockDeps()
    const app = createApiServer(deps)
    const res = await jsonRequest(app, { data: { foo: 'bar' } })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('eventType')
  })

  it('should return 502 when upstream API returns non-OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('Unprocessable'),
    })

    const deps = createMockDeps()
    const app = createApiServer(deps)
    const res = await jsonRequest(app, { eventType: 'some_event', data: {} })

    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('422')
  })

  it('should return 500 when fetch throws (network error)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const deps = createMockDeps()
    const app = createApiServer(deps)
    const res = await jsonRequest(app, { eventType: 'some_event', data: {} })

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('ECONNREFUSED')
  })
})
