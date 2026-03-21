// packages/platform-kit/src/__tests__/pool-server.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Logger } from 'pino'
import { createPoolServer } from '../pool/pool-server.js'
import type { PoolServerConfig } from '../pool/pool-server.js'
import type { WorkerWrapper, WorkerWrapperConfig, ReconcilerConfig } from '../pool/reconciler.js'
import type { InstanceRecord, WorkerHealthMessage } from '../pool/types.js'
import { Reconciler } from '../pool/reconciler.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger

function makeInstance(id: string): InstanceRecord {
  return { id, botToken: null, platform: 'test', apiUrl: null, metadata: null }
}

function makeMockWorker(
  instanceId: string,
  overrides: Partial<{
    status: 'starting' | 'ready' | 'draining' | 'dead'
    health: WorkerHealthMessage | null
    executeResult: Awaited<ReturnType<WorkerWrapper['execute']>>
  }> = {},
): WorkerWrapper & { getHealth(): WorkerHealthMessage | null } {
  const defaultHealth: WorkerHealthMessage = {
    type: 'health',
    connected: true,
    uptime: 100,
    actionCount: 5,
    errorCount: 0,
  }

  return {
    spawn: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(),
    getStatus: vi.fn().mockReturnValue(overrides.status ?? 'ready'),
    getInstanceId: vi.fn().mockReturnValue(instanceId),
    getHealth: vi.fn().mockReturnValue(overrides.health !== undefined ? overrides.health : defaultHealth),
    execute: vi.fn().mockResolvedValue(
      overrides.executeResult ?? { type: 'result', requestId: 'r1', success: true, data: { ok: true } },
    ),
  }
}

/**
 * Build a PoolServerConfig with a pre-seeded Reconciler (workers already spawned).
 * `createReconciler` injects a Reconciler whose internal workers map is pre-populated
 * without actually spawning threads.
 */
function makeConfig(
  workerMap: Map<string, WorkerWrapper & { getHealth(): WorkerHealthMessage | null }>,
  overrides: Partial<PoolServerConfig> = {},
): PoolServerConfig {
  const createReconciler = (cfg: ReconcilerConfig): Reconciler => {
    const reconciler = new Reconciler({
      ...cfg,
      createWorker: (wc: WorkerWrapperConfig) => {
        const worker = workerMap.get(wc.instanceId)
        if (worker == null) throw new Error(`No mock worker for ${wc.instanceId}`)
        return worker
      },
    })

    // Pre-populate the internal workers map by running reconcile() synchronously
    // but we do this after construction so we return the reconciler immediately.
    // The server's start() calls reconciler.start() but tests call app.request()
    // without calling start() — so we pre-fill workers via reconcile().
    void reconciler.reconcile()

    return reconciler
  }

  return {
    platform: 'test',
    type: 'bot',
    workerScript: '/fake/worker.js',
    getInstances: vi.fn().mockResolvedValue(Array.from(workerMap.keys()).map(makeInstance)),
    toWorkerData: (instance) => ({ instanceId: instance.id }),
    poolUrl: 'http://localhost:3000',
    logger: mockLogger,
    host: '127.0.0.1',
    port: 0,
    createReconciler,
    ...overrides,
  }
}

// Small helper to wait for the async reconcile that fires in createReconciler
function wait(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPoolServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // POST /execute
  // -------------------------------------------------------------------------

  describe('POST /execute', () => {
    it('routes to the only worker when no instanceId given', async () => {
      const worker = makeMockWorker('inst-a')
      const workers = new Map([['inst-a', worker]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', params: {} }),
      })

      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(true)
      expect(worker.execute).toHaveBeenCalledWith('ping', {})
    })

    it('routes to the specified instanceId', async () => {
      const workerA = makeMockWorker('inst-a')
      const workerB = makeMockWorker('inst-b')
      const workers = new Map([['inst-a', workerA], ['inst-b', workerB]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: 'inst-b', action: 'ping', params: {} }),
      })

      expect(res.status).toBe(200)
      expect(workerB.execute).toHaveBeenCalledWith('ping', {})
      expect(workerA.execute).not.toHaveBeenCalled()
    })

    it('returns 400 when no instanceId and multiple workers', async () => {
      const workers = new Map([
        ['inst-a', makeMockWorker('inst-a')],
        ['inst-b', makeMockWorker('inst-b')],
      ])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', params: {} }),
      })

      expect(res.status).toBe(400)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(false)
      expect(String(body.error)).toMatch(/instanceId/i)
    })

    it('returns 400 when action is missing', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: 'inst-a', params: {} }),
      })

      expect(res.status).toBe(400)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(false)
    })

    it('returns 404 when instanceId not found', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: 'nonexistent', action: 'ping', params: {} }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 when worker execute returns success: false', async () => {
      const worker = makeMockWorker('inst-a', {
        executeResult: { type: 'result', requestId: 'r1', success: false, error: 'action failed' },
      })
      const workers = new Map([['inst-a', worker]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fail', params: {} }),
      })

      expect(res.status).toBe(400)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(false)
    })

    it('returns 503 when worker throws', async () => {
      const worker = makeMockWorker('inst-a')
      ;(worker.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('worker crash'))
      const workers = new Map([['inst-a', worker]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', params: {} }),
      })

      expect(res.status).toBe(503)
    })

    it('returns 400 for invalid JSON body', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const { server } = createPoolServer(makeConfig(workers))

      const res = await server.request('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      })

      expect(res.status).toBe(400)
    })
  })

  // -------------------------------------------------------------------------
  // GET /health
  // -------------------------------------------------------------------------

  describe('GET /health', () => {
    it('returns healthy when all workers are connected', async () => {
      const workers = new Map([
        ['inst-a', makeMockWorker('inst-a')],
        ['inst-b', makeMockWorker('inst-b')],
      ])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/health')
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.status).toBe('healthy')
      const w = body.workers as Record<string, number>
      expect(w.total).toBe(2)
      expect(w.healthy).toBe(2)
    })

    it('returns degraded when 50-80% of workers are healthy', async () => {
      // 2 out of 3 = 66% → degraded
      const workers = new Map([
        ['inst-a', makeMockWorker('inst-a')],
        ['inst-b', makeMockWorker('inst-b')],
        ['inst-c', makeMockWorker('inst-c', { health: { type: 'health', connected: false, uptime: 0, actionCount: 0, errorCount: 0 } })],
      ])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/health')
      expect(res.status).toBe(207)
      const body = await res.json() as Record<string, unknown>
      expect(body.status).toBe('degraded')
    })

    it('returns unhealthy when <50% of workers are healthy', async () => {
      const disconnectedHealth: WorkerHealthMessage = { type: 'health', connected: false, uptime: 0, actionCount: 0, errorCount: 0 }
      const workers = new Map([
        ['inst-a', makeMockWorker('inst-a', { health: disconnectedHealth })],
        ['inst-b', makeMockWorker('inst-b', { health: disconnectedHealth })],
        ['inst-c', makeMockWorker('inst-c')],
      ])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/health')
      expect(res.status).toBe(503)
      const body = await res.json() as Record<string, unknown>
      expect(body.status).toBe('unhealthy')
    })

    it('returns unhealthy when no workers exist', async () => {
      const workers = new Map<string, WorkerWrapper & { getHealth(): WorkerHealthMessage | null }>()
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/health')
      expect(res.status).toBe(503)
      const body = await res.json() as Record<string, unknown>
      expect(body.status).toBe('unhealthy')
    })

    it('includes memory and uptime fields', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/health')
      const body = await res.json() as Record<string, unknown>
      expect(body.uptime).toBeTypeOf('number')
      const mem = body.memory as Record<string, unknown>
      expect(mem.rss).toBeTypeOf('number')
      expect(mem.heapUsed).toBeTypeOf('number')
      expect(mem.heapTotal).toBeTypeOf('number')
    })
  })

  // -------------------------------------------------------------------------
  // GET /instances
  // -------------------------------------------------------------------------

  describe('GET /instances', () => {
    it('lists all instances with status and health', async () => {
      const workers = new Map([
        ['inst-a', makeMockWorker('inst-a')],
        ['inst-b', makeMockWorker('inst-b')],
      ])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/instances')
      expect(res.status).toBe(200)
      const body = await res.json() as { instances: Array<Record<string, unknown>> }
      expect(body.instances).toHaveLength(2)
      const ids = body.instances.map((i) => i['instanceId'])
      expect(ids).toContain('inst-a')
      expect(ids).toContain('inst-b')
      for (const inst of body.instances) {
        expect(inst['status']).toBe('ready')
        expect(inst['health']).toBeDefined()
      }
    })

    it('returns empty list when no workers', async () => {
      const workers = new Map<string, WorkerWrapper & { getHealth(): WorkerHealthMessage | null }>()
      const { server } = createPoolServer(makeConfig(workers))

      const res = await server.request('/instances')
      const body = await res.json() as { instances: unknown[] }
      expect(body.instances).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // GET /instances/:id/health
  // -------------------------------------------------------------------------

  describe('GET /instances/:id/health', () => {
    it('returns health for a specific instance', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/instances/inst-a/health')
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.instanceId).toBe('inst-a')
      expect(body.status).toBe('ready')
      const health = body.health as Record<string, unknown>
      expect(health.connected).toBe(true)
    })

    it('returns 404 for unknown instance', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/instances/nonexistent/health')
      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // GET /metrics
  // -------------------------------------------------------------------------

  describe('GET /metrics', () => {
    it('returns per-instance action and error counts', async () => {
      const health: WorkerHealthMessage = { type: 'health', connected: true, uptime: 50, actionCount: 10, errorCount: 2 }
      const workers = new Map([['inst-a', makeMockWorker('inst-a', { health })]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/metrics')
      expect(res.status).toBe(200)
      const body = await res.json() as { metrics: Array<Record<string, unknown>> }
      expect(body.metrics).toHaveLength(1)
      const metric = body.metrics[0]!
      expect(metric['instanceId']).toBe('inst-a')
      expect(metric['actionCount']).toBe(10)
      expect(metric['errorCount']).toBe(2)
      expect(metric['uptime']).toBe(50)
      expect(metric['connected']).toBe(true)
    })

    it('returns zero counts when health is null', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a', { health: null })]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/metrics')
      const body = await res.json() as { metrics: Array<Record<string, unknown>> }
      const metric = body.metrics[0]!
      expect(metric['actionCount']).toBe(0)
      expect(metric['errorCount']).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // POST /instances/:id/restart
  // -------------------------------------------------------------------------

  describe('POST /instances/:id/restart', () => {
    it('restarts the specified worker', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const config = makeConfig(workers)
      const restartSpy = vi.fn().mockResolvedValue(undefined)
      const originalCreateReconciler = config.createReconciler!
      config.createReconciler = (cfg) => {
        const reconciler = originalCreateReconciler(cfg)
        ;(reconciler as unknown as { restartWorker: typeof restartSpy }).restartWorker = restartSpy
        return reconciler
      }

      const { server } = createPoolServer(config)
      await wait()

      const res = await server.request('/instances/inst-a/restart', { method: 'POST' })
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body.success).toBe(true)
      expect(restartSpy).toHaveBeenCalledWith('inst-a')
    })

    it('returns 404 for unknown instance', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const { server } = createPoolServer(makeConfig(workers))
      await wait()

      const res = await server.request('/instances/nonexistent/restart', { method: 'POST' })
      expect(res.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // Drain middleware
  // -------------------------------------------------------------------------

  describe('drain middleware', () => {
    it('returns 503 on all routes when draining', async () => {
      const workers = new Map([['inst-a', makeMockWorker('inst-a')]])
      const { server, stop } = createPoolServer(makeConfig(workers))
      await wait()

      // Trigger drain by calling stop — but we need to check the response
      // before/after drain. We'll spy on stop to set the flag.
      // Instead, simulate by calling stop (which sets draining=true) but don't
      // await it completing. Actually, for test simplicity, we call stop() and
      // then immediately check. The drain flag is synchronous.
      void stop()
      // Give it a tick for the flag to be set
      await new Promise((r) => setTimeout(r, 0))

      const res = await server.request('/health')
      expect(res.status).toBe(503)
      const body = await res.json() as Record<string, unknown>
      expect(body.error).toMatch(/drain/i)
    })
  })
})
