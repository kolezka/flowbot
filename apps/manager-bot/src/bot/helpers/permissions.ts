import type { PrismaClient } from '@flowbot/db'
import type { Middleware } from 'grammy'
import type { Context } from '../context.js'
import { isAdmin } from '../filters/is-admin.js'
import { createIsModOrAdmin } from '../filters/is-moderator.js'

export type PermissionLevel = 'admin' | 'moderator'

export function requirePermission(level: PermissionLevel, prisma: PrismaClient): Middleware<Context> {
  const isModOrAdmin = createIsModOrAdmin(prisma)

  return async (ctx, next) => {
    let hasPermission = false

    if (level === 'admin') {
      hasPermission = isAdmin(ctx)
    }
    else if (level === 'moderator') {
      hasPermission = await isModOrAdmin(ctx)
    }

    if (!hasPermission) {
      await ctx.reply('You don\'t have permission to use this command.')
      return
    }

    return next()
  }
}
