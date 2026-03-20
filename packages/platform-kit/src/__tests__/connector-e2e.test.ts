import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import * as v from 'valibot'
import { ActionRegistry } from '../action-registry.js'
import { createConnectorServer } from '../server.js'
import { createServerManager } from '../server-manager.js'
import type { Logger } from 'pino'

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger

// Pick a random high port to avoid conflicts
const PORT = 49152 + Math.floor(Math.random() * 10000)

describe('Connector end-to-end (real HTTP)', () => {
  let baseUrl: string
  let manager: ReturnType<typeof createServerManager>
  let registry: ActionRegistry

  beforeAll(async () => {
    registry = new ActionRegistry()

    registry.register('add', {
      schema: v.object({ a: v.number(), b: v.number() }),
      handler: async ({ a, b }) => ({ sum: a + b }),
    })

    registry.register('echo', {
      schema: v.object({ message: v.string() }),
      handler: async ({ message }) => ({ echoed: message }),
    })

    registry.register('boom', {
      schema: v.object({}),
      handler: async () => { throw new Error('intentional failure') },
    })

    const server = createConnectorServer({
      registry,
      logger: mockLogger,
      healthCheck: () => true,
    })

    manager = createServerManager(server, { host: '127.0.0.1', port: PORT })
    const { url } = await manager.start()
    baseUrl = url
  })

  afterAll(async () => {
    await manager.stop()
  })

  describe('POST /api/execute-action', () => {
    it('executes a valid action and returns data', async () => {
      const res = await fetch(`${baseUrl}/api/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', params: { a: 3, b: 7 } }),
      })

      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(true)
      expect(body.data).toEqual({ sum: 10 })
    })

    it('echoes string params correctly', async () => {
      const res = await fetch(`${baseUrl}/api/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'echo', params: { message: 'hello world' } }),
      })

      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(true)
      expect(body.data).toEqual({ echoed: 'hello world' })
    })

    it('returns 400 with validation error when params are wrong type', async () => {
      const res = await fetch(`${baseUrl}/api/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', params: { a: 'not-a-number', b: 7 } }),
      })

      expect(res.status).toBe(400)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(false)
      expect(typeof body.error).toBe('string')
      expect((body.error as string).toLowerCase()).toContain('invalid')
    })

    it('returns 400 with error when action is unknown', async () => {
      const res = await fetch(`${baseUrl}/api/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nonexistent', params: {} }),
      })

      expect(res.status).toBe(400)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(false)
      expect(body.error).toContain('nonexistent')
    })

    it('returns 400 when action field is missing from body', async () => {
      const res = await fetch(`${baseUrl}/api/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { a: 1, b: 2 } }),
      })

      expect(res.status).toBe(400)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(false)
    })

    it('returns 400 when body is not valid JSON', async () => {
      const res = await fetch(`${baseUrl}/api/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      })

      expect(res.status).toBe(400)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(false)
      expect(body.error).toContain('Invalid JSON')
    })

    it('returns failure when action handler throws', async () => {
      const res = await fetch(`${baseUrl}/api/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'boom', params: {} }),
      })

      expect(res.status).toBe(400)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(false)
      expect(body.error).toContain('intentional failure')
    })
  })

  describe('GET /health', () => {
    it('returns status ok with correct shape', async () => {
      const res = await fetch(`${baseUrl}/health`)

      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.status).toBe('ok')
      expect(body.connected).toBe(true)
      expect(typeof body.uptime).toBe('number')
      expect(body.uptime).toBeGreaterThanOrEqual(0)
      expect(typeof body.actions).toBe('number')
      expect(body.actions).toBe(3) // add, echo, boom
      expect(body.memory).toBeDefined()
      const memory = body.memory as Record<string, unknown>
      expect(typeof memory.rss).toBe('number')
      expect(typeof memory.heapUsed).toBe('number')
      expect(typeof memory.heapTotal).toBe('number')
    })
  })

  describe('GET /api/actions', () => {
    it('lists all registered actions', async () => {
      const res = await fetch(`${baseUrl}/api/actions`)

      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(Array.isArray(body.actions)).toBe(true)
      const actions = body.actions as string[]
      expect(actions).toHaveLength(3)
      expect(actions).toContain('add')
      expect(actions).toContain('echo')
      expect(actions).toContain('boom')
    })
  })

  describe('server lifecycle', () => {
    it('handles concurrent requests correctly', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        fetch(`${baseUrl}/api/execute-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', params: { a: i, b: i } }),
        }).then(r => r.json() as Promise<Record<string, unknown>>),
      )

      const results = await Promise.all(requests)
      results.forEach((body, i) => {
        expect(body.success).toBe(true)
        expect(body.data).toEqual({ sum: i + i })
      })
    })
  })
})

describe('Connector end-to-end (degraded health)', () => {
  let baseUrl: string
  let manager: ReturnType<typeof createServerManager>

  beforeAll(async () => {
    const registry = new ActionRegistry()
    registry.register('noop', {
      schema: v.object({}),
      handler: async () => ({}),
    })

    const server = createConnectorServer({
      registry,
      logger: mockLogger,
      healthCheck: () => false, // simulate disconnected state
    })

    const port = PORT + 1000
    manager = createServerManager(server, { host: '127.0.0.1', port })
    const { url } = await manager.start()
    baseUrl = url
  })

  afterAll(async () => {
    await manager.stop()
  })

  it('GET /health returns 503 with degraded status when not connected', async () => {
    const res = await fetch(`${baseUrl}/health`)

    expect(res.status).toBe(503)
    const body = await res.json() as Record<string, unknown>
    expect(body.status).toBe('degraded')
    expect(body.connected).toBe(false)
  })
})
