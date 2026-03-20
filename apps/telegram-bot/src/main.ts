#!/usr/bin/env tsx

import process from 'node:process'
import { createConnectorServer, createServerManager } from '@flowbot/platform-kit'
import { TelegramBotConnector } from '@flowbot/telegram-bot-connector'
import { pino } from 'pino'
import { createConfigFromEnvironment } from './config.js'

const config = createConfigFromEnvironment()
const logger = pino({ level: config.logLevel })

const connector = new TelegramBotConnector({
  botToken: config.botToken,
  botInstanceId: config.botInstanceId ?? '',
  logger,
  apiUrl: config.apiUrl ?? `http://${config.apiServerHost}:${config.apiServerPort}`,
})

const server = createConnectorServer({
  registry: connector.registry,
  logger,
  healthCheck: () => connector.isConnected(),
})

const serverManager = createServerManager(server, {
  host: config.serverHost,
  port: config.serverPort,
})

async function start() {
  await connector.connect()
  const info = await serverManager.start()
  logger.info({ url: info.url }, 'Telegram bot connector started')
}

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  await connector.disconnect()
  await serverManager.stop()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

start().catch((err) => { logger.error(err); process.exit(1) })
