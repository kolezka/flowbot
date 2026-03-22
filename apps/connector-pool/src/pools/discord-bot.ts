import { join } from 'node:path'
import type { PoolConfig, InstanceRecord } from '@flowbot/platform-kit'
import type { PrismaClient } from '@flowbot/db'
import type { Logger } from 'pino'
import type { Config } from '../config.js'

export function createDiscordBotPool(deps: {
  prisma: PrismaClient
  config: Config
  logger: Logger
  baseDir: string
}): PoolConfig {
  const { prisma, config, logger, baseDir } = deps

  return {
    platform: 'discord',
    type: 'bot',
    workerScript: join(baseDir, '../../../packages/discord-bot-connector/src/worker.ts'),
    poolUrl: `http://${config.poolHost}:${config.poolPort}`,
    maxWorkersPerProcess: config.maxWorkers,
    batchSize: config.batchSize,
    batchDelayMs: config.batchDelayMs,
    reconcileIntervalMs: config.reconcileIntervalMs,
    logger: logger.child({ pool: 'discord:bot' }),

    getInstances: async () => {
      const instances = await prisma.botInstance.findMany({
        where: { platform: 'discord', isActive: true },
        select: { id: true, botToken: true, platform: true, apiUrl: true, metadata: true },
      })
      return instances as unknown as InstanceRecord[]
    },

    toWorkerData: (instance) => ({
      instanceId: instance.id,
      botToken: ('botToken' in instance ? instance.botToken : null) ?? '',
      apiUrl: config.apiUrl,
      logLevel: config.logLevel,
    }),

    updateApiUrl: async (instanceId, apiUrl) => {
      await prisma.botInstance.update({ where: { id: instanceId }, data: { apiUrl } })
    },
  }
}
