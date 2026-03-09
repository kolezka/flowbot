import type { Middleware } from 'grammy'
import type { AdminCacheService } from '../../services/admin-cache.js'
import type { Context } from '../context.js'

export function adminCache(adminCacheService: AdminCacheService): Middleware<Context> {
  return async (ctx, next) => {
    const chatType = ctx.chat?.type
    if (chatType !== 'group' && chatType !== 'supergroup') {
      return next()
    }

    const chatId = ctx.chat!.id.toString()

    // Invalidate cache on admin status changes
    if (ctx.chatMember) {
      const { old_chat_member, new_chat_member } = ctx.chatMember
      const wasAdmin = old_chat_member.status === 'administrator' || old_chat_member.status === 'creator'
      const isAdmin = new_chat_member.status === 'administrator' || new_chat_member.status === 'creator'
      if (wasAdmin !== isAdmin) {
        adminCacheService.invalidate(chatId)
      }
    }

    // Populate admin IDs from cache
    const adminIds = await adminCacheService.getAdminIds(chatId, async () => {
      const admins = await ctx.api.getChatAdministrators(ctx.chat!.id)
      return admins.map(a => a.user.id)
    })

    ctx.session.adminIds = adminIds

    return next()
  }
}
