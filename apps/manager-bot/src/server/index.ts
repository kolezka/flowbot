import type { PrismaClient } from '@tg-allegro/db'
import type { Bot } from '../bot/index.js'
import type { WebhookConfig } from '../config.js'
import type { Logger } from '../logger.js'
import process from 'node:process'
import { serve } from '@hono/node-server'
import { webhookCallback } from 'grammy'
import { Hono } from 'hono'

interface Dependencies {
  bot: Bot
  config: WebhookConfig
  logger: Logger
  prisma: PrismaClient
}

const startedAt = Date.now()

export function createServer(dependencies: Dependencies) {
  const { bot, config, logger, prisma } = dependencies
  const server = new Hono()

  server.get('/health', async (c) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)

    let dbStatus: 'ok' | 'error' = 'ok'
    let groupCount = 0
    try {
      groupCount = await prisma.managedGroup.count({ where: { isActive: true } })
    }
    catch {
      dbStatus = 'error'
    }

    const memUsage = process.memoryUsage()
    const status = dbStatus === 'ok' ? 'ok' : 'degraded'

    return c.json({
      status,
      uptime,
      bot: {
        username: bot.botInfo.username,
        mode: config.isWebhookMode ? 'webhook' : 'polling',
      },
      database: dbStatus,
      groups: groupCount,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    }, status === 'ok' ? 200 : 503)
  })

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
