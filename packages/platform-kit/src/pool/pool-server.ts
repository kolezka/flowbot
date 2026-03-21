// packages/platform-kit/src/pool/pool-server.ts
import process from 'node:process'
import { Hono } from 'hono'
import type { PoolConfig, WorkerHealthMessage } from './types.js'
import { Reconciler, type ReconcilerConfig } from './reconciler.js'
import { createServerManager } from '../server-manager.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolServerConfig extends PoolConfig {
  host?: string
  port?: number
  /**
   * Optional factory to override Reconciler creation (e.g. for testing).
   * If not provided, a real Reconciler is created.
   */
  createReconciler?: (config: ReconcilerConfig) => Reconciler
}

// ---------------------------------------------------------------------------
// Health aggregation
// ---------------------------------------------------------------------------

type PoolStatus = 'healthy' | 'degraded' | 'unhealthy'

function aggregateStatus(totalWorkers: number, healthyCount: number): PoolStatus {
  if (totalWorkers === 0) return 'unhealthy'
  const ratio = healthyCount / totalWorkers
  if (ratio > 0.8) return 'healthy'
  if (ratio >= 0.5) return 'degraded'
  return 'unhealthy'
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPoolServer(config: PoolServerConfig): {
  server: Hono
  start(): Promise<{ url: string }>
  stop(): Promise<void>
} {
  const { host = '0.0.0.0', port = 3000, createReconciler, ...reconcilerConfig } = config
  const logger = config.logger.child({ component: 'PoolServer' })
  const startedAt = Date.now()

  // Create reconciler
  const reconciler = createReconciler != null
    ? createReconciler(reconcilerConfig as ReconcilerConfig)
    : new Reconciler(reconcilerConfig as ReconcilerConfig)

  let draining = false
  const server = new Hono()

  // Drain middleware — return 503 when shutting down
  server.use('*', async (c, next) => {
    if (draining) {
      return c.json({ error: 'Server is draining' }, 503)
    }
    return next()
  })

  // ---------------------------------------------------------------------------
  // POST /execute
  // ---------------------------------------------------------------------------

  server.post('/execute', async (c) => {
    let body: { instanceId?: string; action?: string; params?: Record<string, unknown> }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400)
    }

    if (!body.action) {
      return c.json({ success: false, error: 'action is required' }, 400)
    }

    const params = body.params ?? {}
    let instanceId = body.instanceId

    if (!instanceId) {
      const workers = reconciler.getWorkers()
      if (workers.size === 1) {
        instanceId = workers.keys().next().value as string
      } else if (workers.size === 0) {
        return c.json({ success: false, error: 'No workers available' }, 503)
      } else {
        return c.json(
          { success: false, error: 'instanceId is required when multiple workers are running' },
          400,
        )
      }
    }

    const worker = reconciler.getWorker(instanceId)
    if (worker == null) {
      return c.json({ success: false, error: `Worker not found: ${instanceId}` }, 404)
    }

    let result: Awaited<ReturnType<typeof worker.execute>>
    try {
      result = await worker.execute(body.action, params)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ success: false, error: message }, 503)
    }

    return c.json(result, result.success ? 200 : 400)
  })

  // ---------------------------------------------------------------------------
  // GET /health
  // ---------------------------------------------------------------------------

  server.get('/health', (c) => {
    const workers = reconciler.getWorkers()
    const total = workers.size
    let healthyCount = 0

    for (const [, worker] of workers) {
      const health: WorkerHealthMessage | null = 'getHealth' in worker
        ? (worker as { getHealth(): WorkerHealthMessage | null }).getHealth()
        : null
      if (health?.connected === true) healthyCount++
    }

    const status = aggregateStatus(total, healthyCount)
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const memUsage = process.memoryUsage()

    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 207 : 503

    return c.json(
      {
        status,
        uptime,
        workers: { total, healthy: healthyCount },
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
      },
      httpStatus,
    )
  })

  // ---------------------------------------------------------------------------
  // GET /instances
  // ---------------------------------------------------------------------------

  server.get('/instances', (c) => {
    const workers = reconciler.getWorkers()
    const instances = Array.from(workers.entries()).map(([id, worker]) => {
      const health: WorkerHealthMessage | null = 'getHealth' in worker
        ? (worker as { getHealth(): WorkerHealthMessage | null }).getHealth()
        : null
      return {
        instanceId: id,
        status: worker.getStatus(),
        health,
      }
    })
    return c.json({ instances })
  })

  // ---------------------------------------------------------------------------
  // GET /instances/:id/health
  // ---------------------------------------------------------------------------

  server.get('/instances/:id/health', (c) => {
    const { id } = c.req.param()
    const worker = reconciler.getWorker(id)
    if (worker == null) {
      return c.json({ error: `Worker not found: ${id}` }, 404)
    }

    const health: WorkerHealthMessage | null = 'getHealth' in worker
      ? (worker as { getHealth(): WorkerHealthMessage | null }).getHealth()
      : null

    return c.json({
      instanceId: id,
      status: worker.getStatus(),
      health,
    })
  })

  // ---------------------------------------------------------------------------
  // GET /metrics
  // ---------------------------------------------------------------------------

  server.get('/metrics', (c) => {
    const workers = reconciler.getWorkers()
    const metrics = Array.from(workers.entries()).map(([id, worker]) => {
      const health: WorkerHealthMessage | null = 'getHealth' in worker
        ? (worker as { getHealth(): WorkerHealthMessage | null }).getHealth()
        : null
      return {
        instanceId: id,
        actionCount: health?.actionCount ?? 0,
        errorCount: health?.errorCount ?? 0,
        uptime: health?.uptime ?? 0,
        connected: health?.connected ?? false,
      }
    })
    return c.json({ metrics })
  })

  // ---------------------------------------------------------------------------
  // POST /instances/:id/restart
  // ---------------------------------------------------------------------------

  server.post('/instances/:id/restart', async (c) => {
    const { id } = c.req.param()
    const worker = reconciler.getWorker(id)
    if (worker == null) {
      return c.json({ error: `Worker not found: ${id}` }, 404)
    }

    try {
      await reconciler.restartWorker(id)
      return c.json({ success: true, instanceId: id })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error({ instanceId: id, err }, 'Failed to restart worker')
      return c.json({ success: false, error: message }, 500)
    }
  })

  // ---------------------------------------------------------------------------
  // Error handler
  // ---------------------------------------------------------------------------

  server.onError((error, c) => {
    logger.error({ err: error, path: c.req.path })
    return c.json({ error: 'Internal server error' }, 500)
  })

  // ---------------------------------------------------------------------------
  // start / stop
  // ---------------------------------------------------------------------------

  const serverManager = createServerManager(server, { host, port })

  return {
    server,

    async start() {
      reconciler.start()
      const result = await serverManager.start()
      logger.info({ url: result.url }, 'Pool server started')
      return result
    },

    async stop() {
      draining = true
      await reconciler.stop()
      await serverManager.stop()
      logger.info('Pool server stopped')
    },
  }
}
