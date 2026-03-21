/**
 * Worker entry point for the Telegram bot connector pool.
 *
 * This file is loaded by worker_threads via `new Worker(workerScript, { execArgv: ['--import', 'tsx'] })`.
 * It receives workerData set by the pool manager's toWorkerData() and starts a connector instance.
 */

import { runWorker } from '@flowbot/platform-kit'
import { pino } from 'pino'
import { TelegramBotConnector } from './connector.ts'

runWorker((config) => {
  const logger = pino({
    level: typeof config['logLevel'] === 'string' ? config['logLevel'] : 'info',
    name: `telegram-bot:${config.instanceId}`,
  })

  return new TelegramBotConnector({
    botToken: config['botToken'] as string,
    botInstanceId: config.instanceId,
    logger,
    apiUrl: config['apiUrl'] as string,
  })
})
