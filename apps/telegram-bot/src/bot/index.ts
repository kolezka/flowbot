import type { PrismaClient } from '@flowbot/db'
import type { BotConfig } from 'grammy'
import type { Config } from '../config.js'
import type { Logger } from '../logger.js'
import type { ConfigSyncService } from '../services/config-sync.js'
import type { Context } from './context.js'
import { autoChatAction } from '@grammyjs/auto-chat-action'
import { autoRetry } from '@grammyjs/auto-retry'
import { hydrate } from '@grammyjs/hydrate'
import { hydrateReply, parseMode } from '@grammyjs/parse-mode'
import { sequentialize } from '@grammyjs/runner'
import { Bot as TelegramBot } from 'grammy'
import { FlowEventForwarder } from '../services/flow-events.js'
import { adminFeature } from './features/admin.js'
import { languageFeature } from './features/language.js'
import { menuFeature } from './features/menu.js'
import { profileFeature } from './features/profile.js'
import { unhandledFeature } from './features/unhandled.js'
import { welcomeFeature } from './features/welcome.js'
import { errorHandler } from './handlers/error.js'
import { i18n, isMultipleLocales } from './i18n.js'
import { flowEvents } from './middlewares/flow-events.js'
import { session } from './middlewares/session.js'
import { updateLogger } from './middlewares/update-logger.js'
import { userDataMiddleware } from './middlewares/user-data.js'

interface Dependencies {
  config: Config
  logger: Logger
  prisma: PrismaClient
  configSync?: ConfigSyncService
}

function getSessionKey(ctx: Omit<Context, 'session'>) {
  return ctx.chat?.id.toString()
}

export function createBot(token: string, dependencies: Dependencies, botConfig?: BotConfig<Context>) {
  const { config, logger, prisma, configSync } = dependencies

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

  // i18n
  protectedBot.use(i18n)

  // User data upsert
  protectedBot.use(userDataMiddleware(prisma))

  // Flow event forwarding — forwards bot events to the flow engine via Trigger.dev
  const flowEventForwarder = new FlowEventForwarder(prisma, logger)
  protectedBot.use(flowEvents(flowEventForwarder))

  // Filter out disabled commands via ConfigSync
  if (configSync) {
    protectedBot.on('message:text', async (ctx, next) => {
      const text = ctx.message.text
      if (text.startsWith('/')) {
        const command = text.split(/[\s@]/)[0]!.slice(1)
        if (command && !configSync.isCommandEnabled(command)) {
          return // Skip disabled command
        }
      }
      return next()
    })
  }

  // Features
  protectedBot.use(welcomeFeature)
  protectedBot.use(menuFeature)
  protectedBot.use(profileFeature)
  protectedBot.use(adminFeature)

  if (isMultipleLocales)
    protectedBot.use(languageFeature)

  // must be the last handler
  protectedBot.use(unhandledFeature)

  return bot
}

export type Bot = ReturnType<typeof createBot>
