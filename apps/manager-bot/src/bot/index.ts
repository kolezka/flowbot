import type { PrismaClient } from '@tg-allegro/db'
import type { BotConfig } from 'grammy'
import type { Config } from '../config.js'
import type { Logger } from '../logger.js'
import type { Context } from './context.js'
import { autoChatAction } from '@grammyjs/auto-chat-action'
import { autoRetry } from '@grammyjs/auto-retry'
import { hydrate } from '@grammyjs/hydrate'
import { hydrateReply, parseMode } from '@grammyjs/parse-mode'
import { sequentialize } from '@grammyjs/runner'
import { Bot as TelegramBot } from 'grammy'
import { AdminCacheService } from '../services/admin-cache.js'
import { createPermissionsFeature } from './features/permissions.js'
import { unhandledFeature } from './features/unhandled.js'
import { errorHandler } from './handlers/error.js'
import { adminCache } from './middlewares/admin-cache.js'
import { groupData } from './middlewares/group-data.js'
import { session } from './middlewares/session.js'
import { updateLogger } from './middlewares/update-logger.js'

interface Dependencies {
  config: Config
  logger: Logger
  prisma: PrismaClient
}

function getSessionKey(ctx: Omit<Context, 'session'>) {
  return ctx.chat?.id.toString()
}

export function createBot(token: string, dependencies: Dependencies, botConfig?: BotConfig<Context>) {
  const { config, logger, prisma } = dependencies

  const bot = new TelegramBot<Context>(token, botConfig)

  bot.use(async (ctx, next) => {
    ctx.config = config
    ctx.logger = logger.child({
      update_id: ctx.update.update_id,
      chat_id: ctx.chat?.id,
    })
    await next()
  })

  const protectedBot = bot.errorBoundary(errorHandler)

  // API config
  bot.api.config.use(parseMode('HTML'))
  bot.api.config.use(autoRetry())

  // Sequentialize in polling mode
  if (config.isPollingMode)
    protectedBot.use(sequentialize(getSessionKey))

  // Debug logging
  if (config.isDebug)
    protectedBot.use(updateLogger())

  // Core middlewares
  protectedBot.use(autoChatAction(bot.api))
  protectedBot.use(hydrateReply)
  protectedBot.use(hydrate())
  protectedBot.use(session())

  // Group data
  protectedBot.use(groupData(prisma))

  // Admin cache
  const adminCacheService = new AdminCacheService()
  protectedBot.use(adminCache(adminCacheService))
  // Rate tracker middleware (stub — MB-16)

  // Features
  protectedBot.use(createPermissionsFeature(prisma))
  protectedBot.use(unhandledFeature)

  return bot
}

export type Bot = ReturnType<typeof createBot>
