#!/usr/bin/env tsx

import process from 'node:process'
import { BaileysTransport, CircuitBreaker } from '@flowbot/whatsapp-transport'
import { createWhatsAppBot } from './bot/index.js'
import { createConfigFromEnvironment } from './config.js'
import { createDatabase } from './database.js'
import { createLogger } from './logger.js'
import { createServer, createServerManager } from './server/index.js'

const config = createConfigFromEnvironment()
const logger = createLogger(config)
const prisma = createDatabase()

async function start(): Promise<void> {
  const transport = new BaileysTransport({
    connectionId: config.waConnectionId,
    prisma,
    logger,
  })

  const circuitBreaker = new CircuitBreaker(transport, {}, logger)

  const bot = createWhatsAppBot(circuitBreaker, config, logger)
  const server = createServer({ transport: circuitBreaker, logger, apiUrl: config.apiUrl })
  const serverManager = createServerManager(server, {
    host: config.apiServerHost,
    port: config.apiServerPort,
  })

  let isShuttingDown = false
  const handleShutdown = async (): Promise<void> => {
    if (isShuttingDown)
      return
    isShuttingDown = true
    logger.info('Shutdown signal received')
    await bot.stop()
    await serverManager.stop()
    logger.info('Shutdown complete')
  }

  process.on('SIGINT', () => void handleShutdown())
  process.on('SIGTERM', () => void handleShutdown())

  await bot.start()

  const serverInfo = await serverManager.start()
  logger.info({ url: serverInfo.url }, 'WhatsApp bot HTTP server started')
}

start().catch((err) => {
  logger.error(err)
  process.exit(1)
})
