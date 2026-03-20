import type { Context } from 'grammy'
import type { Bot } from 'grammy'
import { welcomeFeature } from './welcome.js'
import { menuFeature } from './menu.js'

/**
 * Registers all built-in bot features (command handlers) on the given bot.
 */
export function registerFeatures(bot: Bot<Context>): void {
  bot.use(welcomeFeature)
  bot.use(menuFeature)
}

export { welcomeFeature, menuFeature }
