import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import { createConnectorServer } from '../server.js'
import { ActionRegistry } from '../action-registry.js'

describe('createConnectorServer', () => {
  function makeRegistry() {
    const registry = new ActionRegistry()
    registry.register('ping', {
      schema: v.object({}),
      handler: async () => ({ pong: true }),
    })
    return registry
  }

  const mockLogger = {
    child: () => mockLogger,
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  } as any

  it('GET /health returns status', async () => {
    const server = createConnectorServer({ registry: makeRegistry(), logger: mockLogger, healthCheck: () => true })
    const res = await server.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.status).toBe('ok')
    expect(body.connected).toBe(true)
    expect(body.uptime).toBeTypeOf('number')
  })

  it('POST /api/execute-action executes action', async () => {
    const server = createConnectorServer({ registry: makeRegistry(), logger: mockLogger, healthCheck: () => true })
    const res = await server.request('/api/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping', params: {} }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ pong: true })
  })

  it('POST /api/execute-action returns 400 for missing action', async () => {
    const server = createConnectorServer({ registry: makeRegistry(), logger: mockLogger, healthCheck: () => true })
    const res = await server.request('/api/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: {} }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/execute-action returns 400 for unknown action', async () => {
    const server = createConnectorServer({ registry: makeRegistry(), logger: mockLogger, healthCheck: () => true })
    const res = await server.request('/api/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nonexistent', params: {} }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as Record<string, unknown>
    expect(body.success).toBe(false)
  })

  it('GET /api/actions returns registered action names', async () => {
    const server = createConnectorServer({ registry: makeRegistry(), logger: mockLogger, healthCheck: () => true })
    const res = await server.request('/api/actions')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.actions).toEqual(['ping'])
  })

  it('returns degraded health when not connected', async () => {
    const server = createConnectorServer({ registry: makeRegistry(), logger: mockLogger, healthCheck: () => false })
    const res = await server.request('/health')
    const body = await res.json() as Record<string, unknown>
    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.connected).toBe(false)
  })
})
