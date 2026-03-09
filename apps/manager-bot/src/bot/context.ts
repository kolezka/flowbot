import type { AutoChatActionFlavor } from '@grammyjs/auto-chat-action'
import type { HydrateFlavor } from '@grammyjs/hydrate'
import type { I18nFlavor } from '@grammyjs/i18n'
import type { ParseModeFlavor } from '@grammyjs/parse-mode'
import type { GroupConfig } from '@tg-allegro/db'
import type { Context as DefaultContext, SessionFlavor } from 'grammy'
import type { Config } from '../config.js'
import type { Logger } from '../logger.js'

export interface SessionData {
  groupConfig?: GroupConfig
  adminIds?: number[]
  adminCacheExpiry?: number
}

interface ExtendedContextFlavor {
  logger: Logger
  config: Config
}

export type Context = ParseModeFlavor<
  HydrateFlavor<
    DefaultContext &
    ExtendedContextFlavor &
    SessionFlavor<SessionData> &
    I18nFlavor &
    AutoChatActionFlavor
  >
>
