#!/usr/bin/env tsx
/* eslint-disable antfu/no-top-level-await */

import type { RunnerHandle } from '@grammyjs/runner'
import type { PollingConfig, WebhookConfig } from './config.js'
import process from 'node:process'
import { run } from '@grammyjs/runner'
import { configure } from '@trigger.dev/sdk/v3'
import { createBot } from './bot/index.js'
import { createConfigFromEnvironment } from './config.js'
import { createDatabase } from './database.js'
import { createLogger } from './logger.js'
import { createApiServer, createServer, createServerManager } from './server/index.js'
import { AnalyticsService } from './services/analytics.js'
import { registerCommandsFromConfig } from './services/command-registry.js'
import { initConfigSync } from './services/config-sync.js'
import { SchedulerService } from './services/scheduler.js'

const config = createConfigFromEnvironment()

// Configure Trigger.dev SDK for self-hosted instance
if (config.triggerSecretKey) {
  configure({
    secretKey: config.triggerSecretKey,
    baseURL: config.triggerApiUrl,
  })
}
const logger = createLogger(config)
const prisma = createDatabase(config)

async function startPolling(config: PollingConfig) {
  const configSync = initConfigSync(prisma, config.botToken, logger)
  await configSync.start()

  const bot = createBot(config.botToken, { config, logger, prisma, configSync })
  let runner: undefined | RunnerHandle
  const scheduler = new SchedulerService(prisma, bot.api, logger)
  const analytics = new AnalyticsService(prisma, logger)

  // Start API server for health checks and Trigger.dev send-message endpoint
  const apiServer = createApiServer({ botApi: bot.api, logger, prisma, apiUrl: config.apiUrl })
  const apiServerManager = createServerManager(apiServer, {
    host: config.apiServerHost,
    port: config.apiServerPort,
  })

  onShutdown(async () => {
    logger.info('Shutdown')
    configSync.stop()
    analytics.stop()
    scheduler.stop()
    await runner?.stop()
    await apiServerManager.stop()
  })

  await Promise.all([
    bot.init(),
    bot.api.deleteWebhook(),
  ])

  // Register commands from DB config (and re-register on config changes)
  await registerCommandsFromConfig(bot.api, configSync.getCommands(), logger)
  configSync.onChange(async (cfg) => {
    await registerCommandsFromConfig(bot.api, cfg.commands, logger)
  })

  runner = run(bot, {
    runner: {
      fetch: {
        allowed_updates: config.botAllowedUpdates,
      },
    },
  })

  const apiInfo = await apiServerManager.start()
  logger.info({ msg: 'API server started', url: apiInfo.url })

  scheduler.start()
  analytics.start()

  logger.info({
    msg: 'Bot running...',
    username: bot.botInfo.username,
  })
}

async function startWebhook(config: WebhookConfig) {
  const configSync = initConfigSync(prisma, config.botToken, logger)
  await configSync.start()

  const bot = createBot(config.botToken, { config, logger, prisma, configSync })
  const server = createServer({ bot, config, logger, prisma, botApi: bot.api, apiUrl: config.apiUrl })
  const serverManager = createServerManager(server, {
    host: config.serverHost,
    port: config.serverPort,
  })
  const scheduler = new SchedulerService(prisma, bot.api, logger)
  const analytics = new AnalyticsService(prisma, logger)

  onShutdown(async () => {
    logger.info('Shutdown')
    configSync.stop()
    analytics.stop()
    scheduler.stop()
    await serverManager.stop()
  })

  await bot.init()

  // Register commands from DB config (and re-register on config changes)
  await registerCommandsFromConfig(bot.api, configSync.getCommands(), logger)
  configSync.onChange(async (cfg) => {
    await registerCommandsFromConfig(bot.api, cfg.commands, logger)
  })

  const info = await serverManager.start()
  logger.info({ msg: 'Server started', url: info.url })

  await bot.api.setWebhook(config.botWebhook, {
    allowed_updates: config.botAllowedUpdates,
    secret_token: config.botWebhookSecret,
  })
  logger.info({ msg: 'Webhook was set', url: config.botWebhook })

  scheduler.start()
  analytics.start()
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
