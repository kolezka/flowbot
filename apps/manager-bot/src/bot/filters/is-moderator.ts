import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { isAdmin } from './is-admin.js'

export function createIsModOrAdmin(prisma: PrismaClient) {
  return async function isModOrAdmin(ctx: Context): Promise<boolean> {
    if (isAdmin(ctx))
      return true

    const userId = ctx.from?.id
    const chatId = ctx.chat?.id
    if (!userId || !chatId)
      return false

    const member = await prisma.groupMember.findFirst({
      where: {
        group: { chatId: BigInt(chatId) },
        telegramId: BigInt(userId),
        role: 'moderator',
      },
    })

    return member !== null
  }
}
