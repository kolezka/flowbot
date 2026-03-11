import type { Context } from '../context'
import { menuData } from '../callback-data/menu'
import { changeLanguageData } from '../callback-data/change-language'
import { logHandle } from '../helpers/logging'
import { createMainMenuKeyboard } from '../keyboards/menu'
import { createChangeLanguageKeyboard } from '../keyboards/change-language'
import { InlineKeyboard } from 'grammy'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

// Main Menu Handler
feature.callbackQuery(
  menuData.filter({ section: 'menu' }),
  logHandle('callback-menu-main'),
  async (ctx) => {
    const messageText =
      `🏠 <b>Main Menu</b>\n\n` +
      `Welcome! Please select a section:`

    return ctx.editMessageText(messageText, {
      reply_markup: createMainMenuKeyboard(),
      parse_mode: 'HTML',
    })
  },
)

// Language Section Handler
feature.callbackQuery(
  menuData.filter({ section: 'language' }),
  logHandle('callback-menu-language'),
  async (ctx) => {
    const languageKeyboard = await createChangeLanguageKeyboard(ctx)
    const backButton = InlineKeyboard.from([
      [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
    ])

    const mergedKeyboard = InlineKeyboard.from([
      ...languageKeyboard.inline_keyboard,
      ...backButton.inline_keyboard,
    ])

    return ctx.editMessageText(ctx.t('language-select'), {
      reply_markup: mergedKeyboard,
    })
  },
)

export { composer as menuFeature }
