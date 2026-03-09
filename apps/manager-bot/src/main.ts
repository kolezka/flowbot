#!/usr/bin/env tsx
/* eslint-disable antfu/no-top-level-await */

import type { RunnerHandle } from '@grammyjs/runner'
import type { PollingConfig, WebhookConfig } from './config.js'
import process from 'node:process'
import { run } from '@grammyjs/runner'
import { createBot } from './bot/index.js'
import { createConfigFromEnvironment } from './config.js'
import { createDatabase } from './database.js'
import { createLogger } from './logger.js'
import { createServer, createServerManager } from './server/index.js'

const config = createConfigFromEnvironment()
const logger = createLogger(config)
const prisma = createDatabase(config)

async function startPolling(config: PollingConfig) {
  const bot = createBot(config.botToken, { config, logger, prisma })
  let runner: undefined | RunnerHandle

  onShutdown(async () => {
    logger.info('Shutdown')
    await runner?.stop()
  })

  await Promise.all([
    bot.init(),
    bot.api.deleteWebhook(),
  ])

  runner = run(bot, {
    runner: {
      fetch: {
        allowed_updates: config.botAllowedUpdates,
      },
    },
  })

  logger.info({
    msg: 'Bot running...',
    username: bot.botInfo.username,
  })
}

async function startWebhook(config: WebhookConfig) {
  const bot = createBot(config.botToken, { config, logger, prisma })
  const server = createServer({ bot, config, logger })
  const serverManager = createServerManager(server, {
    host: config.serverHost,
    port: config.serverPort,
  })

  onShutdown(async () => {
    logger.info('Shutdown')
    await serverManager.stop()
  })

  await bot.init()

  const info = await serverManager.start()
  logger.info({ msg: 'Server started', url: info.url })

  await bot.api.setWebhook(config.botWebhook, {
    allowed_updates: config.botAllowedUpdates,
    secret_token: config.botWebhookSecret,
  })
  logger.info({ msg: 'Webhook was set', url: config.botWebhook })
}

try {
  if (config.isWebhookMode)
    await startWebhook(config)
  else if (config.isPollingMode)
    await startPolling(config)
}
catch (error) {
  logger.error(error)
  process.exit(1)
}

function onShutdown(cleanUp: () => Promise<void>) {
  let isShuttingDown = false
  const handleShutdown = async () => {
    if (isShuttingDown)
      return
    isShuttingDown = true
    await cleanUp()
  }
  process.on('SIGINT', handleShutdown)
  process.on('SIGTERM', handleShutdown)
}
