import type { Context } from '../context.js'

export function isAdmin(ctx: Context): boolean {
  const userId = ctx.from?.id
  if (!userId)
    return false

  // Superadmins from config
  if (ctx.config.botAdmins.includes(userId))
    return true

  // Telegram group admins from cache
  return ctx.session.adminIds?.includes(userId) ?? false
}
