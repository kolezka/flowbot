import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

function autoDeleteReply(ctx: Context, messageId: number) {
  const delay = (ctx.session.groupConfig?.autoDeleteCommandsS ?? 10) * 1000
  if (delay > 0) {
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, messageId)
      }
      catch { /* ignore if already deleted */ }
    }, delay)
  }
}

export function createDeletionFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const modLogRepo = new ModerationLogRepository(prisma)

  // /del — delete replied-to message
  feature.command('del', requirePermission('moderator', prisma), logHandle('cmd:del'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    if (!replyTo) {
      const msg = await ctx.reply('Reply to a message to delete it.')
      autoDeleteReply(ctx, msg.message_id)
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })

    try {
      await ctx.api.deleteMessage(ctx.chat.id, replyTo.message_id)
    }
    catch {
      const msg = await ctx.reply('Could not delete that message.')
      autoDeleteReply(ctx, msg.message_id)
      return
    }

    // Delete the command message too
    try {
      await ctx.api.deleteMessage(ctx.chat.id, ctx.message!.message_id)
    }
    catch { /* ignore */ }

    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'delete',
        actorId: BigInt(ctx.from!.id),
        targetId: replyTo.from ? BigInt(replyTo.from.id) : undefined,
      })
    }
  })

  // /purge N — bulk delete (admin+ only)
  feature.command('purge', requirePermission('admin', prisma), logHandle('cmd:purge'), async (ctx) => {
    const arg = ctx.match?.toString().trim()
    const count = arg ? Number.parseInt(arg, 10) : 0

    if (!count || count < 1 || count > 100) {
      const msg = await ctx.reply('Usage: /purge N (1-100)')
      autoDeleteReply(ctx, msg.message_id)
      return
    }

    const currentMsgId = ctx.message!.message_id
    const messageIds: number[] = []

    // Collect message IDs going backwards from the command message
    for (let i = 0; i <= count; i++) {
      messageIds.push(currentMsgId - i)
    }

    try {
      await ctx.api.deleteMessages(ctx.chat.id, messageIds)
    }
    catch {
      // Fall back to deleting one by one
      for (const id of messageIds) {
        try {
          await ctx.api.deleteMessage(ctx.chat.id, id)
        }
        catch { /* ignore individual failures */ }
      }
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'purge',
        actorId: BigInt(ctx.from!.id),
        details: { count },
      })
    }
  })

  return feature
}
