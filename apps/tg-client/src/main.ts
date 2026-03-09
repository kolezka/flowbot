#!/usr/bin/env tsx
/* eslint-disable antfu/no-top-level-await */

import process from 'node:process'
import { ActionRunner } from './actions/runner.js'
import { loadSession } from './client/session.js'
import { createConfigFromEnvironment } from './config.js'
import { createDatabase } from './database.js'
import { createLogger } from './logger.js'
import { JobRepository, LogRepository } from './repositories/index.js'
import { Scheduler } from './scheduler/index.js'
import { createServer, createServerManager } from './server/index.js'
import { GramJsTransport } from './transport/GramJsTransport.js'

const config = createConfigFromEnvironment()
const logger = createLogger(config)
const prisma = createDatabase(config)

try {
  // Load session
  const session = loadSession(config.tgClientSession)

  // Create transport
  const transport = new GramJsTransport(
    config.tgClientApiId,
    config.tgClientApiHash,
    session,
    logger,
  )

  // Create repositories
  const jobRepo = new JobRepository(prisma)
  const _logRepo = new LogRepository(prisma)

  // Create action runner
  const actionRunner = new ActionRunner(transport, logger, {
    maxRetries: config.schedulerMaxRetries,
    backoffBaseMs: config.backoffBaseMs,
    backoffMaxMs: config.backoffMaxMs,
  })

  // Create scheduler
  const scheduler = new Scheduler(
    jobRepo,
    actionRunner,
    logger,
    config.schedulerPollIntervalMs,
  )

  // Create health server
  const server = createServer(transport)
  const serverManager = createServerManager(server, {
    host: config.healthServerHost,
    port: config.healthServerPort,
  })

  // Graceful shutdown
  let isShuttingDown = false
  const handleShutdown = async () => {
    if (isShuttingDown)
      return
    isShuttingDown = true

    logger.info('Shutdown signal received')

    // Stop scheduler (waits for in-flight jobs)
    await scheduler.stop()

    // Disconnect transport
    await transport.disconnect()

    // Stop health server
    await serverManager.stop()

    // Flush logger
    logger.flush()

    process.exit(0)
  }

  process.on('SIGINT', handleShutdown)
  process.on('SIGTERM', handleShutdown)

  // Connect transport
  await transport.connect()
  logger.info('Transport connected')

  // Start scheduler
  scheduler.start()
  logger.info('Scheduler started')

  // Start health server
  const info = await serverManager.start()
  logger.info({ msg: 'Health server started', url: info.url })
}
catch (error) {
  logger.error(error)
  process.exit(1)
}
