import type { Logger } from 'pino'
import process from 'node:process'
import { Hono } from 'hono'
import type { ActionRegistry } from './action-registry.js'

export interface ConnectorServerConfig {
  registry: ActionRegistry
  logger: Logger
  healthCheck: () => boolean
}

export function createConnectorServer(config: ConnectorServerConfig) {
  const { registry, logger, healthCheck } = config
  const server = new Hono()
  const startedAt = Date.now()

  server.get('/health', (c) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const memUsage = process.memoryUsage()
    const connected = healthCheck()
    const status = connected ? 'ok' : 'degraded'
    return c.json({
      status, uptime, connected,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      actions: registry.getActions().length,
    }, connected ? 200 : 503)
  })

  server.post('/api/execute-action', async (c) => {
    let body: { action?: string; params?: Record<string, unknown> }
    try { body = await c.req.json() }
    catch { return c.json({ success: false, error: 'Invalid JSON body' }, 400) }

    if (!body.action) {
      return c.json({ success: false, error: 'action is required' }, 400)
    }

    const result = await registry.execute(body.action, body.params ?? {})
    return c.json(result, result.success ? 200 : 400)
  })

  server.get('/api/actions', (c) => {
    return c.json({ actions: registry.getActions() })
  })

  server.onError((error, c) => {
    logger.error({ err: error, path: c.req.path })
    return c.json({ error: 'Internal server error' }, 500)
  })

  return server
}
