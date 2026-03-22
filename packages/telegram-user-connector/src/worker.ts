/**
 * Worker entry point for the Telegram user connector pool.
 *
 * This file is loaded by worker_threads via `new Worker(workerScript, { execArgv: ['--import', 'tsx'] })`.
 * It receives workerData set by the pool manager's toWorkerData() and starts a connector instance.
 */

import { runWorker } from '@flowbot/platform-kit'
import { pino } from 'pino'
import { TelegramUserConnector } from './connector.ts'

runWorker((config) => {
  const logger = pino({
    level: typeof config['logLevel'] === 'string' ? config['logLevel'] : 'info',
    name: `telegram-user:${config.instanceId}`,
  })

  return new TelegramUserConnector({
    sessionString: config['sessionString'] as string,
    apiId: config['apiId'] as number,
    apiHash: config['apiHash'] as string,
    logger,
  })
})
