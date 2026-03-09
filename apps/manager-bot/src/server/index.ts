import type { Bot } from '../bot/index.js'
import type { WebhookConfig } from '../config.js'
import type { Logger } from '../logger.js'
import { serve } from '@hono/node-server'
import { webhookCallback } from 'grammy'
import { Hono } from 'hono'

interface Dependencies {
  bot: Bot
  config: WebhookConfig
  logger: Logger
}

export function createServer(dependencies: Dependencies) {
  const { bot, config, logger } = dependencies
  const server = new Hono()

  server.get('/health', c => c.json({ status: 'ok' }))

  server.post(
    '/webhook',
    webhookCallback(bot, 'hono', {
      secretToken: config.botWebhookSecret,
    }),
  )

  server.onError((error, c) => {
    logger.error({ err: error, path: c.req.path })
    return c.json({ error: 'Internal server error' }, 500)
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
