import type { ITelegramTransport } from '../transport/ITelegramTransport.js'
import process from 'node:process'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const startedAt = Date.now()

export function createServer(transport: ITelegramTransport) {
  const server = new Hono()

  server.get('/health', (c) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const connected = transport.isConnected()
    const memUsage = process.memoryUsage()

    const status = connected ? 'ok' : 'error'

    return c.json({
      status,
      uptime,
      transport: {
        connected,
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    }, connected ? 200 : 503)
  })

  return server
}

export function createServerManager(server: ReturnType<typeof createServer>, options: { host: string, port: number }) {
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
          info => resolve({
            url: info.family === 'IPv6'
              ? `http://[${info.address}]:${info.port}`
              : `http://${info.address}:${info.port}`,
          }),
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
