import type { Context } from '../context.js'
import { logHandle } from '../helpers/logging.js'
import { createMainMenuKeyboard } from '../keyboards/menu.js'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command('start', logHandle('command-start'), (ctx) => {
  const messageText =
    `🏠 <b>Main Menu</b>\n\n` +
    `Welcome! Please select a section:`

  return ctx.reply(messageText, {
    reply_markup: createMainMenuKeyboard(),
    parse_mode: 'HTML',
  })
})

export { composer as welcomeFeature }
