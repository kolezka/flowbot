#!/usr/bin/env tsx
/* eslint-disable antfu/no-top-level-await */

import type { PollingConfig, WebhookConfig } from './config'
import type { RunnerHandle } from '@grammyjs/runner'
import process from 'node:process'
import { createBot } from './bot'
import { config } from './config'
import { prismaClient } from './database'
import { logger } from './logger'
import { createServer, createServerManager } from './server'
import { registerCommandsFromConfig } from './services/command-registry'
import { initConfigSync } from './services/config-sync'
import { run } from '@grammyjs/runner'

async function startPolling(config: PollingConfig) {
  const configSync = initConfigSync(prismaClient, config.botToken, logger)
  await configSync.start()

  const bot = createBot(config.botToken, {
    config,
    logger,
    configSync,
  })
  let runner: undefined | RunnerHandle

  // graceful shutdown
  onShutdown(async () => {
    logger.info('Shutdown')
    configSync.stop()
    await runner?.stop()
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

  // start bot
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
  const configSync = initConfigSync(prismaClient, config.botToken, logger)
  await configSync.start()

  const bot = createBot(config.botToken, {
    config,
    logger,
    configSync,
  })
  const server = createServer({
    bot,
    config,
    logger,
  })
  const serverManager = createServerManager(server, {
    host: config.serverHost,
    port: config.serverPort,
  })

  // graceful shutdown
  onShutdown(async () => {
    logger.info('Shutdown')
    configSync.stop()
    await serverManager.stop()
  })

  // to prevent receiving updates before the bot is ready
  await bot.init()

  // Register commands from DB config (and re-register on config changes)
  await registerCommandsFromConfig(bot.api, configSync.getCommands(), logger)
  configSync.onChange(async (cfg) => {
    await registerCommandsFromConfig(bot.api, cfg.commands, logger)
  })

  // start server
  const info = await serverManager.start()
  logger.info({
    msg: 'Server started',
    url: info.url,
  })

  // set webhook
  await bot.api.setWebhook(config.botWebhook, {
    allowed_updates: config.botAllowedUpdates,
    secret_token: config.botWebhookSecret,
  })
  logger.info({
    msg: 'Webhook was set',
    url: config.botWebhook,
  })
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

// Utils

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
