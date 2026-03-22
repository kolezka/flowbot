#!/usr/bin/env tsx

import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PrismaClient } from '@flowbot/db'
import { createPoolServer } from '@flowbot/platform-kit'
import { pino } from 'pino'
import { createConfigFromEnvironment } from './config.js'

const config = createConfigFromEnvironment()
const logger = pino({ level: config.logLevel })
const prisma = new PrismaClient()

const __dirname = dirname(fileURLToPath(import.meta.url))

const pool = createPoolServer({
  platform: 'telegram',
  type: 'bot',
  workerScript: join(__dirname, '../../../packages/telegram-bot-connector/src/worker.ts'),
  getInstances: async () => {
    return prisma.botInstance.findMany({
      where: { platform: 'telegram', isActive: true },
      select: { id: true, botToken: true, platform: true, apiUrl: true, metadata: true },
    })
  },
  toWorkerData: (instance) => ({
    instanceId: instance.id,
    botToken: instance.botToken ?? '',
    apiUrl: config.apiUrl,
    logLevel: config.logLevel,
    scope: (instance.metadata as Record<string, unknown> | null)?.scope,
  }),
  updateApiUrl: async (instanceId, apiUrl) => {
    await prisma.botInstance.update({ where: { id: instanceId }, data: { apiUrl } })
  },
  poolUrl: `http://${config.poolHost}:${config.poolPort}`,
  maxWorkersPerProcess: config.maxWorkers,
  batchSize: config.batchSize,
  batchDelayMs: config.batchDelayMs,
  reconcileIntervalMs: config.reconcileIntervalMs,
  logger,
  host: config.poolHost,
  port: config.poolPort,
})

pool.start().then(({ url }) => {
  logger.info({ url }, 'Telegram bot pool started')
}).catch((err: unknown) => {
  logger.error(err)
  process.exit(1)
})

process.on('SIGINT', () => { void pool.stop() })
process.on('SIGTERM', () => { void pool.stop() })
