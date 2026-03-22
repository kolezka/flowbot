/**
 * Worker entry point for the WhatsApp user connector pool.
 *
 * This file is loaded by worker_threads via `new Worker(workerScript, { execArgv: ['--import', 'tsx'] })`.
 * It receives workerData set by the pool manager's toWorkerData() and starts a connector instance.
 *
 * Each WhatsApp worker creates its own PrismaClient because Baileys needs DB access
 * for session storage and worker threads cannot share Prisma instances.
 */

import { runWorker } from '@flowbot/platform-kit'
import { PrismaClient } from '@flowbot/db'
import { pino } from 'pino'
import { WhatsAppUserConnector } from './connector.ts'

runWorker((config) => {
  const logger = pino({
    level: typeof config['logLevel'] === 'string' ? config['logLevel'] : 'info',
    name: `whatsapp-user:${config.instanceId}`,
  })

  const prisma = new PrismaClient({
    datasourceUrl: config['databaseUrl'] as string,
  })

  return new WhatsAppUserConnector({
    connectionId: config['connectionId'] as string,
    botInstanceId: config['botInstanceId'] as string,
    prisma,
    logger,
    apiUrl: config['apiUrl'] as string,
  })
})
