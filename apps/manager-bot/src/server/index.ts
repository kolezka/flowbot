import type { PrismaClient } from '@tg-allegro/db'
import type { Api } from 'grammy'
import type { Bot } from '../bot/index.js'
import type { WebhookConfig } from '../config.js'
import type { Logger } from '../logger.js'
import process from 'node:process'
import { serve } from '@hono/node-server'
import { webhookCallback } from 'grammy'
import { Hono } from 'hono'

interface ApiDependencies {
  botApi: Api
  logger: Logger
  prisma: PrismaClient
}

interface WebhookDependencies extends ApiDependencies {
  bot: Bot
  config: WebhookConfig
}

const startedAt = Date.now()

function addApiRoutes(server: Hono, { botApi, logger, prisma }: ApiDependencies) {
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
      database: dbStatus,
      groups: groupCount,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    }, status === 'ok' ? 200 : 503)
  })

  server.post('/api/send-message', async (c) => {
    try {
      const body = await c.req.json<{ chatId: string, text: string }>()
      if (!body.chatId || !body.text) {
        return c.json({ success: false, error: 'chatId and text are required' }, 400)
      }

      const msg = await botApi.sendMessage(body.chatId, body.text, { parse_mode: 'HTML' })
      return c.json({ success: true, messageId: msg.message_id })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error }, 'Failed to send message via API')
      return c.json({ success: false, error: message }, 500)
    }
  })

  server.onError((error, c) => {
    logger.error({ err: error, path: c.req.path })
    return c.json({ error: 'Internal server error' }, 500)
  })
}

export function createServer(dependencies: WebhookDependencies) {
  const { bot, config } = dependencies
  const server = new Hono()

  addApiRoutes(server, dependencies)

  server.post(
    '/webhook',
    webhookCallback(bot, 'hono', {
      secretToken: config.botWebhookSecret,
    }),
  )

  return server
}

export function createApiServer(dependencies: ApiDependencies) {
  const server = new Hono()
  addApiRoutes(server, dependencies)
  return server
}

export function createServerManager(server: Hono, options: { host: string, port: number }) {
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
