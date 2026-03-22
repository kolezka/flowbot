import { join } from 'node:path'
import type { PoolConfig, InstanceRecord } from '@flowbot/platform-kit'
import type { PrismaClient } from '@flowbot/db'
import type { Logger } from 'pino'
import type { Config } from '../config.js'

export function createWhatsappUserPool(deps: {
  prisma: PrismaClient
  config: Config
  logger: Logger
  baseDir: string
}): PoolConfig {
  const { prisma, config, logger, baseDir } = deps

  return {
    platform: 'whatsapp',
    type: 'user',
    workerScript: join(baseDir, '../../../packages/whatsapp-user-connector/src/worker.ts'),
    poolUrl: `http://${config.poolHost}:${config.poolPort}`,
    maxWorkersPerProcess: config.maxWorkers,
    batchSize: config.batchSize,
    batchDelayMs: config.batchDelayMs,
    reconcileIntervalMs: config.reconcileIntervalMs,
    logger: logger.child({ pool: 'whatsapp:user' }),

    getInstances: async () => {
      const instances = await prisma.platformConnection.findMany({
        where: { platform: 'whatsapp', status: 'active' },
        select: { id: true, platform: true, credentials: true, botInstanceId: true, metadata: true },
      })
      return instances as unknown as InstanceRecord[]
    },

    toWorkerData: (instance) => ({
      instanceId: instance.id,
      connectionId: instance.id,
      botInstanceId: ('botInstanceId' in instance ? instance.botInstanceId : null) ?? '',
      databaseUrl: config.databaseUrl,
      apiUrl: config.apiUrl,
      logLevel: config.logLevel,
    }),
  }
}
