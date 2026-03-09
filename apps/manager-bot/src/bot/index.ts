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
import { AntiSpamService } from '../services/anti-spam.js'
import { logChannelService } from '../services/log-channel.js'
import { createAntiLinkFeature } from './features/anti-link.js'
import { createAntiSpamFeature } from './features/anti-spam.js'
import { createAuditFeature } from './features/audit.js'
import { createDeletionFeature } from './features/deletion.js'
import { createFiltersFeature } from './features/filters.js'
import { createModerationFeature } from './features/moderation.js'
import { createPermissionsFeature } from './features/permissions.js'
import { createRulesFeature } from './features/rules.js'
import { createSetupFeature } from './features/setup.js'
import { unhandledFeature } from './features/unhandled.js'
import { createWelcomeFeature } from './features/welcome.js'
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

  // Wire log channel service with bot API
  logChannelService.setApi(bot.api)

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

  // Features — anti-spam runs first
  const antiSpamService = new AntiSpamService()
  protectedBot.use(createAntiSpamFeature(antiSpamService))
  protectedBot.use(createAntiLinkFeature(prisma))
  protectedBot.use(createFiltersFeature(prisma))
  protectedBot.use(createPermissionsFeature(prisma))
  protectedBot.use(createModerationFeature(prisma))
  protectedBot.use(createDeletionFeature(prisma))
  protectedBot.use(createWelcomeFeature(prisma))
  protectedBot.use(createSetupFeature(prisma))
  protectedBot.use(createAuditFeature(prisma))
  protectedBot.use(createRulesFeature(prisma))
  protectedBot.use(unhandledFeature)

  return bot
}

export type Bot = ReturnType<typeof createBot>
