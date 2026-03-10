import { SessionData, type Context } from './context'
import type { Config } from '../config'
import type { Logger } from '../logger'
import type { ConfigSyncService } from '../services/config-sync'
import type { BotConfig } from 'grammy'
import { adminFeature } from './features/admin'
import { languageFeature } from './features/language'
import { menuFeature } from './features/menu'
import { profileFeature } from './features/profile'
import { productsFeature } from './features/products'
import { unhandledFeature } from './features/unhandled'
import { welcomeFeature } from './features/welcome'
import { errorHandler } from './handlers/error'
import { i18n, isMultipleLocales } from './i18n'
import { session } from './middlewares/session'
import { updateLogger } from './middlewares/update-logger'
import { autoChatAction } from '@grammyjs/auto-chat-action'
import { hydrate } from '@grammyjs/hydrate'
import { hydrateReply, parseMode } from '@grammyjs/parse-mode'
import { sequentialize } from '@grammyjs/runner'
import { MemorySessionStorage, Bot as TelegramBot } from 'grammy'
import { userDataMiddleware } from './middlewares/user-data'
import { isBanned } from './filters/is-banned'

interface Dependencies {
  config: Config
  logger: Logger
  configSync?: ConfigSyncService
}

function getSessionKey(ctx: Omit<Context, 'session'>) {
  return ctx.chat?.id.toString()
}

export function createBot(token: string, dependencies: Dependencies, botConfig?: BotConfig<Context>) {
  const {
    config,
    logger,
    configSync,
  } = dependencies

  const bot = new TelegramBot<Context>(token, botConfig)

  bot.use(async (ctx, next) => {
    ctx.config = config
    ctx.logger = logger.child({
      update_id: ctx.update.update_id,
    })

    await next()
  })

  const protectedBot = bot.errorBoundary(errorHandler)

  // Middlewares
  bot.api.config.use(parseMode('HTML'))

  if (config.isPollingMode)
    protectedBot.use(sequentialize(getSessionKey))

  if (config.isDebug)
    protectedBot.use(updateLogger())
  
  protectedBot.use(autoChatAction(bot.api))
  protectedBot.use(hydrateReply)
  protectedBot.use(hydrate())
  protectedBot.use(session({
    getSessionKey,
    storage: new MemorySessionStorage<SessionData>(),
  }))
  protectedBot.use(i18n)
  protectedBot.use(userDataMiddleware())

  protectedBot.filter(isBanned)

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

  // Handlers
  protectedBot.use(welcomeFeature)
  protectedBot.use(menuFeature)
  protectedBot.use(profileFeature)
  protectedBot.use(productsFeature)
  protectedBot.use(adminFeature)

  if (isMultipleLocales)
    protectedBot.use(languageFeature)

  // must be the last handler
  protectedBot.use(unhandledFeature)

  return bot
}

export type Bot = ReturnType<typeof createBot>
