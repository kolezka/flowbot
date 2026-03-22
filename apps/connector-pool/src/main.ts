#!/usr/bin/env tsx

import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createPrismaClient } from '@flowbot/db'
import { Reconciler, createServerManager } from '@flowbot/platform-kit'
import { pino } from 'pino'
import { createConfigFromEnvironment } from './config.js'
import { createEnabledPools } from './pools/index.js'
import { createMultiPoolServer, type PoolEntry } from './server.js'

const config = createConfigFromEnvironment()
const logger = pino({ level: config.logLevel })
const prisma = createPrismaClient(config.databaseUrl)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Create pool configs for each enabled platform
const poolConfigs = createEnabledPools({ prisma, config, logger, baseDir: __dirname })

if (poolConfigs.length === 0) {
  logger.warn('No pools enabled — check ENABLE_* environment variables')
}

// Create reconcilers
const pools: PoolEntry[] = poolConfigs.map(({ key, config: poolConfig }) => ({
  key,
  reconciler: new Reconciler(poolConfig),
}))

logger.info({ pools: pools.map((p) => p.key) }, 'Enabled pools')

// Build multiplexed HTTP server
const server = createMultiPoolServer({ pools, logger })
const serverManager = createServerManager(server, {
  host: config.poolHost,
  port: config.poolPort,
})

// Start all reconcilers + HTTP server
async function start() {
  for (const pool of pools) {
    pool.reconciler.start()
    logger.info({ pool: pool.key }, 'Reconciler started')
  }

  const { url } = await serverManager.start()
  logger.info({ url, pools: pools.length }, 'Connector pool started')
}

// Graceful shutdown
let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true

  logger.info('Shutting down connector pool...')

  // Signal server to drain
  const serverAny = server as unknown as { setDraining?: () => void }
  if (typeof serverAny.setDraining === 'function') serverAny.setDraining()

  // Stop all reconcilers (which stops all workers)
  await Promise.all(pools.map((p) => p.reconciler.stop()))

  // Stop HTTP server
  await serverManager.stop()

  // Disconnect Prisma
  await prisma.$disconnect()

  logger.info('Connector pool stopped')
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

start().catch((err) => {
  logger.error(err)
  process.exit(1)
})
