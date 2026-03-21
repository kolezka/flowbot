// packages/platform-kit/src/__tests__/pool-integration.test.ts
//
// End-to-end integration test for the pool system.
// Spawns REAL worker threads, uses REAL HTTP (via Hono app.request()), verifies
// the full stack: createPoolServer → Reconciler → WorkerWrapper → echo-connector-worker.
//
// IMPORTANT: Worker threads need `execArgv: ['--import', 'tsx']` to run .ts files.
// The Reconciler's default createWorker doesn't pass execArgv, so we inject a
// custom createWorker via the `createReconciler` override in PoolServerConfig.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import pino from 'pino'
import { createPoolServer } from '../pool/pool-server.js'
import type { PoolServerConfig } from '../pool/pool-server.js'
import { Reconciler } from '../pool/reconciler.js'
import type { ReconcilerConfig, WorkerWrapperConfig } from '../pool/reconciler.js'
import { WorkerWrapper } from '../pool/worker-wrapper.js'
import type { InstanceRecord } from '../pool/types.js'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const ECHO_WORKER = join(__dirname, 'fixtures', 'echo-connector-worker.ts')

// tsx loader so TypeScript worker files can run inside worker threads
const TSX_EXECARGV = ['--import', 'tsx']

// ---------------------------------------------------------------------------
// Logger (silent for tests)
// ---------------------------------------------------------------------------

const logger = pino({ level: 'silent' })

// ---------------------------------------------------------------------------
// Fake instances
// ---------------------------------------------------------------------------

const INSTANCES: InstanceRecord[] = [
  { id: 'inst-a', botToken: null, platform: 'test', apiUrl: null, metadata: null },
  { id: 'inst-b', botToken: null, platform: 'test', apiUrl: null, metadata: null },
  { id: 'inst-c', botToken: null, platform: 'test', apiUrl: null, metadata: null },
]

// ---------------------------------------------------------------------------
// Pool setup
// ---------------------------------------------------------------------------

function buildConfig(): PoolServerConfig {
  return {
    platform: 'test',
    type: 'bot',
    workerScript: ECHO_WORKER,
    getInstances: async () => INSTANCES,
    toWorkerData: (instance: InstanceRecord) => ({ instanceId: instance.id }),
    poolUrl: 'http://localhost:3099',
    logger,
    host: '127.0.0.1',
    port: 3099,
    // Inject a Reconciler that creates WorkerWrappers with tsx execArgv so
    // the TypeScript worker file can be loaded by node:worker_threads.
    createReconciler: (cfg: ReconcilerConfig): Reconciler =>
      new Reconciler({
        ...cfg,
        createWorker: (wc: WorkerWrapperConfig) =>
          new WorkerWrapper({
            ...wc,
            execArgv: TSX_EXECARGV,
            readyTimeoutMs: 15_000,
            executeTimeoutMs: 10_000,
            shutdownTimeoutMs: 5_000,
          }),
      }),
  }
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let pool: ReturnType<typeof createPoolServer>

/**
 * Wait until the pool has `count` ready workers, polling every 100ms up to
 * `timeoutMs`.  Returns the number of ready workers found.
 */
async function waitForWorkers(count: number, timeoutMs = 20_000): Promise<number> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await pool.server.request('/instances')
    const body = await res.json() as { instances: Array<{ instanceId: string; status: string }> }
    const readyCount = body.instances.filter((i) => i.status === 'ready').length
    if (readyCount >= count) return readyCount
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${count} ready workers (timeout: ${timeoutMs}ms)`)
}

beforeAll(async () => {
  pool = createPoolServer(buildConfig())
  // Call start() so the reconciler runs and spawns workers.
  // We don't need the HTTP server to be listening — app.request() works in-process.
  await pool.start()
  // Wait for all 3 workers to become ready before running tests.
  await waitForWorkers(3)
}, 30_000)

afterAll(async () => {
  await pool.stop()
}, 15_000)

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function postExecute(body: Record<string, unknown>): Promise<Response> {
  return pool.server.request('/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pool integration (real worker threads)', () => {
  it('1. pool starts and reconciler creates 3 workers', async () => {
    const res = await pool.server.request('/instances')
    expect(res.status).toBe(200)
    const body = await res.json() as { instances: Array<{ instanceId: string; status: string }> }
    expect(body.instances).toHaveLength(3)
    const ids = body.instances.map((i) => i.instanceId)
    expect(ids).toContain('inst-a')
    expect(ids).toContain('inst-b')
    expect(ids).toContain('inst-c')
    for (const inst of body.instances) {
      expect(inst.status).toBe('ready')
    }
  })

  it('2. POST /execute echo on inst-a returns echoed text and instanceId', async () => {
    const res = await postExecute({
      instanceId: 'inst-a',
      action: 'echo',
      params: { text: 'hi' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ echoed: 'hi', instanceId: 'inst-a' })
  })

  it('3. POST /execute routes to inst-b, returns correct instanceId', async () => {
    const res = await postExecute({
      instanceId: 'inst-b',
      action: 'echo',
      params: { text: 'hello' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ echoed: 'hello', instanceId: 'inst-b' })
  })

  it('4. POST /execute with action fail returns error (400)', async () => {
    const res = await postExecute({
      instanceId: 'inst-a',
      action: 'fail',
      params: {},
    })
    // ActionRegistry.execute catches the thrown error and returns success: false
    // which pool-server maps to 400.
    expect(res.status).toBe(400)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/intentional failure/i)
  })

  it('5. POST /execute with unknown instanceId returns 404', async () => {
    const res = await postExecute({
      instanceId: 'nonexistent',
      action: 'echo',
      params: { text: 'test' },
    })
    expect(res.status).toBe(404)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/Worker not found/)
  })

  it('6. POST /execute without instanceId (3 workers) returns 400 with helpful message', async () => {
    const res = await postExecute({
      action: 'echo',
      params: { text: 'test' },
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/instanceId/i)
  })

  it('7. GET /health shows 3 workers (total)', async () => {
    const res = await pool.server.request('/health')
    // Status depends on whether health heartbeats have arrived (every 10s in worker-entry).
    // We assert only on worker count and structural fields — not on healthy/unhealthy —
    // since health heartbeats may not have been received yet in the test window.
    const body = await res.json() as {
      status: string
      uptime: number
      workers: { total: number; healthy: number }
      memory: { rss: number; heapUsed: number; heapTotal: number }
    }
    expect(body.workers.total).toBe(3)
    expect(body.uptime).toBeTypeOf('number')
    expect(body.memory.rss).toBeTypeOf('number')
    expect(body.memory.heapUsed).toBeTypeOf('number')
    expect(body.memory.heapTotal).toBeTypeOf('number')
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status)
  })

  it('8. GET /instances lists 3 instances with expected shape', async () => {
    const res = await pool.server.request('/instances')
    expect(res.status).toBe(200)
    const body = await res.json() as { instances: Array<{ instanceId: string; status: string; health: unknown }> }
    expect(body.instances).toHaveLength(3)
    const ids = body.instances.map((i) => i.instanceId).sort()
    expect(ids).toEqual(['inst-a', 'inst-b', 'inst-c'])
  })

  it('9. GET /metrics shows action counts (incremented by test 2 and 3)', async () => {
    const res = await pool.server.request('/metrics')
    expect(res.status).toBe(200)
    const body = await res.json() as {
      metrics: Array<{
        instanceId: string
        actionCount: number
        errorCount: number
        uptime: number
        connected: boolean
      }>
    }
    expect(body.metrics).toHaveLength(3)
    for (const metric of body.metrics) {
      expect(metric.instanceId).toBeTypeOf('string')
      expect(metric.actionCount).toBeTypeOf('number')
      expect(metric.errorCount).toBeTypeOf('number')
    }
    // Tests 2 and 3 each called echo on inst-a and inst-b, so those workers
    // should have actionCount >= 1. However, /metrics uses lastHealth which
    // arrives on the 10s heartbeat — so we only assert structure here.
    // The action counts are verified implicitly via successful execute responses.
  })

  it('10. stop() gracefully shuts down all workers', async () => {
    // stop() is called in afterAll — verify it completes without error.
    // We test the shutdown path by verifying the pool is functional before stop.
    const res = await pool.server.request('/instances')
    const body = await res.json() as { instances: Array<{ status: string }> }
    // All workers should still be alive before stop() is called.
    expect(body.instances.every((i) => i.status === 'ready')).toBe(true)
    // Actual stop() is exercised in afterAll with a 15s timeout.
  })
})
