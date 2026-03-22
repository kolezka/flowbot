/**
 * Worker entry point for the Discord bot connector pool.
 *
 * This file is loaded by worker_threads via `new Worker(workerScript, { execArgv: ['--import', 'tsx'] })`.
 * It receives workerData set by the pool manager's toWorkerData() and starts a connector instance.
 */

import { runWorker } from '@flowbot/platform-kit'
import { pino } from 'pino'
import { DiscordBotConnector } from './connector.ts'

runWorker((config) => {
  const logger = pino({
    level: typeof config['logLevel'] === 'string' ? config['logLevel'] : 'info',
    name: `discord-bot:${config.instanceId}`,
  })

  return new DiscordBotConnector({
    botToken: config['botToken'] as string,
    botInstanceId: config.instanceId,
    logger,
    apiUrl: config['apiUrl'] as string,
  })
})
