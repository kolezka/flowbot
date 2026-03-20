#!/usr/bin/env tsx

import process from 'node:process'
import { PrismaClient } from '@flowbot/db'
import { createConnectorServer, createServerManager } from '@flowbot/platform-kit'
import { WhatsAppUserConnector } from '@flowbot/whatsapp-user-connector'
import { pino } from 'pino'
import { createConfigFromEnvironment } from './config.js'

const config = createConfigFromEnvironment()
const logger = pino({ level: config.logLevel })
const prisma = new PrismaClient()

const connector = new WhatsAppUserConnector({
  connectionId: config.waConnectionId,
  botInstanceId: config.waBotInstanceId,
  prisma,
  logger,
  apiUrl: config.apiUrl,
})

const server = createConnectorServer({
  registry: connector.registry,
  logger,
  healthCheck: () => connector.isConnected(),
})

const serverManager = createServerManager(server, {
  host: config.apiServerHost,
  port: config.apiServerPort,
})

async function start() {
  await connector.connect()
  const info = await serverManager.start()
  logger.info({ url: info.url }, 'WhatsApp user connector started')
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
