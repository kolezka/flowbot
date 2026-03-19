import type { IWhatsAppTransport } from '@flowbot/whatsapp-transport'
import type { Logger } from '../logger.js'
import process from 'node:process'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { handleAction } from './actions.js'
import { createQrAuthHandler } from './qr-auth.js'

export interface ServerDependencies {
  transport: IWhatsAppTransport
  logger: Logger
  apiUrl?: string
}

export function createServer({ transport, logger, apiUrl = 'http://localhost:3000' }: ServerDependencies) {
  const server = new Hono()
  const startedAt = Date.now()

  server.get('/health', (c) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const memUsage = process.memoryUsage()
    const connected = transport.isConnected()

    return c.json({
      status: 'ok',
      uptime,
      connection: connected,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    })
  })

  server.post('/api/execute-action', async (c) => {
    let body: { action?: string; params?: Record<string, unknown> }
    try {
      body = await c.req.json<{ action?: string; params?: Record<string, unknown> }>()
    }
    catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400)
    }

    if (!body.action) {
      return c.json({ success: false, error: 'action is required' }, 400)
    }

    try {
      const result = await handleAction(transport, body.action, body.params ?? {})
      return c.json(result, result.success ? 200 : 400)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error }, 'Failed to execute action')
      return c.json({ success: false, error: message }, 500)
    }
  })

  server.post('/api/qr-auth/start', createQrAuthHandler(transport, apiUrl, logger))

  server.onError((error, c) => {
    logger.error({ err: error, path: c.req.path })
    return c.json({ error: 'Internal server error' }, 500)
  })

  return server
}

export function createServerManager(
  server: ReturnType<typeof createServer>,
  options: { host: string; port: number },
) {
  let handle: undefined | ReturnType<typeof serve>

  return {
    start() {
      return new Promise<{ url: string }>((resolve) => {
        handle = serve(
          {
            fetch: server.fetch,
            hostname: options.host,
            port: options.port,
          },
          (info) => {
            resolve({
              url:
                info.family === 'IPv6'
                  ? `http://[${info.address}]:${info.port}`
                  : `http://${info.address}:${info.port}`,
            })
          },
        )
      })
    },
    stop() {
      return new Promise<void>((resolve) => {
        if (handle)
          handle.close(() => resolve())
        else
          resolve()
      })
    },
  }
}
