import type { Context } from '../context'
import { changeLanguageData } from '../callback-data/change-language'
import { chunk } from '../helpers/keyboard'
import { i18n } from '../i18n'
import { InlineKeyboard } from 'grammy'
import ISO6391 from 'iso-639-1'

export async function createChangeLanguageKeyboard(ctx: Context) {
  const currentLocaleCode = await ctx.i18n.getLocale()

  const getLabel = (code: string) => {
    const isActive = code === currentLocaleCode

    return `${isActive ? '✅ ' : ''}${ISO6391.getNativeName(code)}`
  }

  return InlineKeyboard.from(
    chunk(
      i18n.locales.map(localeCode => ({
        text: getLabel(localeCode),
        callback_data: changeLanguageData.pack({
          code: localeCode,
        }),
      })),
      2,
    ),
  )
}
