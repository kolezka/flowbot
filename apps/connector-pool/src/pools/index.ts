import type { PoolConfig } from '@flowbot/platform-kit'
import type { PrismaClient } from '@flowbot/db'
import type { Logger } from 'pino'
import type { Config } from '../config.js'
import { isPoolEnabled } from '../config.js'
import { createTelegramBotPool } from './telegram-bot.js'
import { createDiscordBotPool } from './discord-bot.js'
import { createTelegramUserPool } from './telegram-user.js'
import { createWhatsappUserPool } from './whatsapp-user.js'

export interface PoolDeps {
  prisma: PrismaClient
  config: Config
  logger: Logger
  baseDir: string
}

export function createEnabledPools(deps: PoolDeps): Array<{ key: string; config: PoolConfig }> {
  const pools: Array<{ key: string; config: PoolConfig }> = []

  if (isPoolEnabled(deps.config, 'telegramBot')) {
    pools.push({ key: 'telegram:bot', config: createTelegramBotPool(deps) })
  }

  if (isPoolEnabled(deps.config, 'discordBot')) {
    pools.push({ key: 'discord:bot', config: createDiscordBotPool(deps) })
  }

  if (isPoolEnabled(deps.config, 'telegramUser')) {
    pools.push({ key: 'telegram:user', config: createTelegramUserPool(deps) })
  }

  if (isPoolEnabled(deps.config, 'whatsappUser')) {
    pools.push({ key: 'whatsapp:user', config: createWhatsappUserPool(deps) })
  }

  return pools
}
