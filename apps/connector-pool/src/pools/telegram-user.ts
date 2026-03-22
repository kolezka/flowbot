import { join } from 'node:path'
import type { PoolConfig, InstanceRecord } from '@flowbot/platform-kit'
import type { PrismaClient } from '@flowbot/db'
import type { Logger } from 'pino'
import type { Config } from '../config.js'

export function createTelegramUserPool(deps: {
  prisma: PrismaClient
  config: Config
  logger: Logger
  baseDir: string
}): PoolConfig {
  const { prisma, config, logger, baseDir } = deps

  return {
    platform: 'telegram',
    type: 'user',
    workerScript: join(baseDir, '../../../packages/telegram-user-connector/src/worker.ts'),
    poolUrl: `http://${config.poolHost}:${config.poolPort}`,
    maxWorkersPerProcess: config.maxWorkers,
    batchSize: config.batchSize,
    batchDelayMs: config.batchDelayMs,
    reconcileIntervalMs: config.reconcileIntervalMs,
    logger: logger.child({ pool: 'telegram:user' }),

    getInstances: async () => {
      const instances = await prisma.platformConnection.findMany({
        where: { platform: 'telegram', connectionType: 'mtproto', status: 'active' },
        select: { id: true, platform: true, credentials: true, botInstanceId: true, metadata: true },
      })
      return instances as unknown as InstanceRecord[]
    },

    toWorkerData: (instance) => {
      const credentials = (instance as { credentials?: Record<string, unknown> | null }).credentials ?? {}
      return {
        instanceId: instance.id,
        sessionString: (credentials['sessionString'] as string) ?? '',
        apiId: config.tgApiId,
        apiHash: config.tgApiHash,
        logLevel: config.logLevel,
      }
    },
  }
}
