import type { Context } from '../context'
import { menuData } from '../callback-data/menu'
import { logHandle } from '../helpers/logging'
import { createProfileKeyboard } from '../keyboards/profile'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

// Callback: Show profile
feature.callbackQuery(
  menuData.filter({ section: 'profile' }),
  logHandle('callback-menu-profile'),
  async (ctx) => {
    const user = ctx.session.userData

    const messageText =
      `👤 <b>Your Profile</b>\n\n` +
      `🆔 <b>ID:</b> ${user.id}\n` +
      `👤 <b>Username:</b> ${user.username || 'Not set'}\n` +
      `📝 <b>First Name:</b> ${user.firstName || 'Not set'}\n` +
      `📝 <b>Last Name:</b> ${user.lastName || 'Not set'}\n` +
      `🌐 <b>Language:</b> ${await ctx.i18n.getLocale()}\n` +
      `📅 <b>Joined:</b> ${new Date(user.createdAt).toLocaleDateString()}`

    return ctx.editMessageText(messageText, {
      reply_markup: createProfileKeyboard(),
      parse_mode: 'HTML',
    })
  },
)

export { composer as profileFeature }
