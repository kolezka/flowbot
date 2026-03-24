import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
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

// Worker threads don't inherit the parent's tsx ESM hooks. The register-tsx
// shim calls tsx/esm/api register() explicitly. We resolve it to an absolute
// file URL so it works regardless of where the worker script lives.
const __dirname = dirname(fileURLToPath(import.meta.url))
const registerShim = pathToFileURL(join(__dirname, '../register-tsx.mjs')).href
const WORKER_EXEC_ARGV = ['--import', registerShim]

export function createEnabledPools(deps: PoolDeps): Array<{ key: string; config: PoolConfig }> {
  const pools: Array<{ key: string; config: PoolConfig }> = []

  if (isPoolEnabled(deps.config, 'telegramBot')) {
    pools.push({ key: 'telegram:bot', config: { ...createTelegramBotPool(deps), execArgv: WORKER_EXEC_ARGV } })
  }

  if (isPoolEnabled(deps.config, 'discordBot')) {
    pools.push({ key: 'discord:bot', config: { ...createDiscordBotPool(deps), execArgv: WORKER_EXEC_ARGV } })
  }

  if (isPoolEnabled(deps.config, 'telegramUser')) {
    pools.push({ key: 'telegram:user', config: { ...createTelegramUserPool(deps), execArgv: WORKER_EXEC_ARGV } })
  }

  if (isPoolEnabled(deps.config, 'whatsappUser')) {
    pools.push({ key: 'whatsapp:user', config: { ...createWhatsappUserPool(deps), execArgv: WORKER_EXEC_ARGV } })
  }

  return pools
}
