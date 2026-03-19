import type { Middleware } from 'grammy'
import type { Context } from '../context.js'
import { isAdmin } from '../filters/is-admin.js'

export type PermissionLevel = 'admin'

export function requirePermission(level: PermissionLevel): Middleware<Context> {
  return async (ctx, next) => {
    const hasPermission = level === 'admin' ? isAdmin(ctx) : false

    if (!hasPermission) {
      await ctx.reply('You don\'t have permission to use this command.')
      return
    }

    return next()
  }
}
