import type { AntiSpamService } from '../../services/anti-spam.js'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { isAdmin } from '../filters/is-admin.js'

export function createAntiSpamFeature(antiSpamService: AntiSpamService) {
  const feature = new Composer<Context>()

  feature.on('message:text', async (ctx, next) => {
    const chatType = ctx.chat?.type
    if (chatType !== 'group' && chatType !== 'supergroup')
      return next()

    // Admins bypass anti-spam
    if (isAdmin(ctx))
      return next()

    const config = ctx.session.groupConfig
    if (!config?.antiSpamEnabled)
      return next()

    const text = ctx.message.text
    if (!text)
      return next()

    const verdict = antiSpamService.checkMessage(
      ctx.chat.id.toString(),
      ctx.from!.id.toString(),
      text,
      config.antiSpamMaxMessages,
      config.antiSpamWindowSeconds,
    )

    if (verdict === 'clean')
      return next()

    // Spam detected — delete message
    try {
      await ctx.deleteMessage()
    }
    catch { /* ignore if can't delete */ }

    const reason = verdict === 'flood' ? 'Message flood detected' : 'Duplicate message spam detected'

    const msg = await ctx.reply(`🛡️ ${reason}. Message removed.`)

    // Auto-delete notice after 5s
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, msg.message_id)
      }
      catch { /* ignore */ }
    }, 5000)

    // Don't pass to other handlers
  })

  return feature
}
