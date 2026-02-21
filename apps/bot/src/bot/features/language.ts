import type { Context } from '../context'
import { changeLanguageData } from '../callback-data/change-language'
import { menuData } from '../callback-data/menu'
import { logHandle } from '../helpers/logging'
import { i18n } from '../i18n'
import { createChangeLanguageKeyboard } from '../keyboards/change-language'
import { InlineKeyboard } from 'grammy'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command('language', logHandle('command-language'), async (ctx) => {
  const languageKeyboard = await createChangeLanguageKeyboard(ctx)
  const backButton = InlineKeyboard.from([
    [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
  ])

  const mergedKeyboard = InlineKeyboard.from([
    ...languageKeyboard.inline_keyboard,
    ...backButton.inline_keyboard,
  ])

  return ctx.reply(ctx.t('language-select'), {
    reply_markup: mergedKeyboard,
  })
})

feature.callbackQuery(
  changeLanguageData.filter(),
  logHandle('keyboard-language-select'),
  async (ctx) => {
    const { code: languageCode } = changeLanguageData.unpack(
      ctx.callbackQuery.data,
    )

    if (i18n.locales.includes(languageCode)) {
      await ctx.i18n.setLocale(languageCode)

      const languageKeyboard = await createChangeLanguageKeyboard(ctx)
      const backButton = InlineKeyboard.from([
        [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
      ])

      const mergedKeyboard = InlineKeyboard.from([
        ...languageKeyboard.inline_keyboard,
        ...backButton.inline_keyboard,
      ])

      return ctx.editMessageText(ctx.t('language-changed'), {
        reply_markup: mergedKeyboard,
      })
    }
  },
)

export { composer as languageFeature }
