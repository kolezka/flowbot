import process from 'node:process'
import { Hono } from 'hono'
import { Reconciler, type WorkerHealthMessage } from '@flowbot/platform-kit'
import type { Logger } from 'pino'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolEntry {
  key: string
  reconciler: Reconciler
}

type PoolStatus = 'healthy' | 'degraded' | 'unhealthy'

// ---------------------------------------------------------------------------
// Health aggregation
// ---------------------------------------------------------------------------

function aggregateStatus(totalWorkers: number, healthyCount: number): PoolStatus {
  if (totalWorkers === 0) return 'healthy' // No workers expected yet is OK
  const ratio = healthyCount / totalWorkers
  if (ratio > 0.8) return 'healthy'
  if (ratio >= 0.5) return 'degraded'
  return 'unhealthy'
}

function getWorkerHealth(worker: { getHealth?: () => WorkerHealthMessage | null }): WorkerHealthMessage | null {
  return typeof worker.getHealth === 'function' ? worker.getHealth() : null
}

// ---------------------------------------------------------------------------
// Reverse map: instanceId → poolKey
// ---------------------------------------------------------------------------

function buildInstanceMap(pools: readonly PoolEntry[]): Map<string, PoolEntry> {
  const map = new Map<string, PoolEntry>()
  for (const pool of pools) {
    for (const [instanceId] of pool.reconciler.getWorkers()) {
      map.set(instanceId, pool)
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createMultiPoolServer(opts: {
  pools: readonly PoolEntry[]
  logger: Logger
}): Hono {
  const { pools, logger } = opts
  const startedAt = Date.now()
  let draining = false

  // Rebuild instance map on every request (cheap — just iterating maps)
  const findPool = (instanceId: string) => buildInstanceMap(pools).get(instanceId)

  const server = new Hono()

  // Drain middleware
  server.use('*', async (c, next) => {
    if (draining) return c.json({ error: 'Server is draining' }, 503)
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

    const { action, params = {} } = body

    const resolvedInstanceId = body.instanceId ?? (() => {
      const allWorkers = pools.flatMap((p) => Array.from(p.reconciler.getWorkers().keys()))
      return allWorkers.length === 1 ? allWorkers[0] : undefined
    })()

    if (!resolvedInstanceId) {
      const totalWorkers = pools.reduce((sum, p) => sum + p.reconciler.getWorkers().size, 0)
      if (totalWorkers === 0) {
        return c.json({ success: false, error: 'No workers available' }, 503)
      }
      return c.json({ success: false, error: 'instanceId is required when multiple workers are running' }, 400)
    }

    const pool = findPool(resolvedInstanceId)
    if (!pool) {
      return c.json({ success: false, error: `Worker not found: ${resolvedInstanceId}` }, 404)
    }

    const worker = pool.reconciler.getWorker(resolvedInstanceId)
    if (!worker) {
      return c.json({ success: false, error: `Worker not found: ${resolvedInstanceId}` }, 404)
    }

    try {
      const result = await worker.execute(action, params)
      return c.json(result, result.success ? 200 : 400)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ success: false, error: message }, 503)
    }
  })

  // ---------------------------------------------------------------------------
  // GET /health
  // ---------------------------------------------------------------------------

  server.get('/health', (c) => {
    let totalWorkers = 0
    let healthyCount = 0

    for (const pool of pools) {
      for (const [, worker] of pool.reconciler.getWorkers()) {
        totalWorkers++
        const health = getWorkerHealth(worker as unknown as { getHealth?: () => WorkerHealthMessage | null })
        if (health?.connected === true) healthyCount++
      }
    }

    const status = aggregateStatus(totalWorkers, healthyCount)
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const memUsage = process.memoryUsage()
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 207 : 503

    return c.json({
      status,
      uptime,
      pools: pools.map((p) => {
        const workers = p.reconciler.getWorkers()
        return { key: p.key, workers: workers.size }
      }),
      workers: { total: totalWorkers, healthy: healthyCount },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    }, httpStatus)
  })

  // ---------------------------------------------------------------------------
  // GET /pools
  // ---------------------------------------------------------------------------

  server.get('/pools', (c) => {
    const result = pools.map((p) => {
      const workers = p.reconciler.getWorkers()
      let healthyCount = 0
      for (const [, worker] of workers) {
        const health = getWorkerHealth(worker as unknown as { getHealth?: () => WorkerHealthMessage | null })
        if (health?.connected === true) healthyCount++
      }
      return {
        key: p.key,
        workers: { total: workers.size, healthy: healthyCount },
      }
    })
    return c.json({ pools: result })
  })

  // ---------------------------------------------------------------------------
  // GET /instances
  // ---------------------------------------------------------------------------

  server.get('/instances', (c) => {
    const instances = pools.flatMap((pool) =>
      Array.from(pool.reconciler.getWorkers().entries()).map(([id, worker]) => {
        const health = getWorkerHealth(worker as unknown as { getHealth?: () => WorkerHealthMessage | null })
        return {
          instanceId: id,
          pool: pool.key,
          status: worker.getStatus(),
          health,
        }
      }),
    )
    return c.json({ instances })
  })

  // ---------------------------------------------------------------------------
  // GET /instances/:id/health
  // ---------------------------------------------------------------------------

  server.get('/instances/:id/health', (c) => {
    const { id } = c.req.param()
    const pool = findPool(id)
    if (!pool) return c.json({ error: `Worker not found: ${id}` }, 404)

    const worker = pool.reconciler.getWorker(id)
    if (!worker) return c.json({ error: `Worker not found: ${id}` }, 404)

    const health = getWorkerHealth(worker as unknown as { getHealth?: () => WorkerHealthMessage | null })
    return c.json({ instanceId: id, pool: pool.key, status: worker.getStatus(), health })
  })

  // ---------------------------------------------------------------------------
  // POST /instances/:id/restart
  // ---------------------------------------------------------------------------

  server.post('/instances/:id/restart', async (c) => {
    const { id } = c.req.param()
    const pool = findPool(id)
    if (!pool) return c.json({ error: `Worker not found: ${id}` }, 404)

    try {
      await pool.reconciler.restartWorker(id)
      return c.json({ success: true, instanceId: id, pool: pool.key })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error({ instanceId: id, err }, 'Failed to restart worker')
      return c.json({ success: false, error: message }, 500)
    }
  })

  // ---------------------------------------------------------------------------
  // GET /metrics
  // ---------------------------------------------------------------------------

  server.get('/metrics', (c) => {
    const metrics = pools.flatMap((pool) =>
      Array.from(pool.reconciler.getWorkers().entries()).map(([id, worker]) => {
        const health = getWorkerHealth(worker as unknown as { getHealth?: () => WorkerHealthMessage | null })
        return {
          instanceId: id,
          pool: pool.key,
          actionCount: health?.actionCount ?? 0,
          errorCount: health?.errorCount ?? 0,
          uptime: health?.uptime ?? 0,
          connected: health?.connected ?? false,
        }
      }),
    )
    return c.json({ metrics })
  })

  // ---------------------------------------------------------------------------
  // Error handler
  // ---------------------------------------------------------------------------

  server.onError((error, c) => {
    logger.error({ err: error, path: c.req.path })
    return c.json({ error: 'Internal server error' }, 500)
  })

  // Expose drain setter for shutdown
  ;(server as unknown as { setDraining: () => void }).setDraining = () => { draining = true }

  return server
}
