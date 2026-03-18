import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'
import { formatDuration, parseDuration } from '../helpers/time.js'

export function createScheduleFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const modLogRepo = new ModerationLogRepository(prisma)

  // /remind <duration> <message> — schedule a one-time reminder
  feature.command('remind', requirePermission('admin', prisma), logHandle('cmd:remind'), async (ctx) => {
    const args = ctx.match?.toString().trim() ?? ''
    const parts = args.split(/\s+/)
    const durationStr = parts[0]
    const text = parts.slice(1).join(' ')

    if (!durationStr || !text) {
      await ctx.reply('Usage: /remind &lt;duration&gt; &lt;message&gt;\n\nExample: /remind 1h Meeting in 1 hour!')
      return
    }

    const seconds = parseDuration(durationStr)
    if (!seconds) {
      await ctx.reply('Invalid duration. Use: 30s, 5m, 1h, 1d, 1w')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const sendAt = new Date(Date.now() + seconds * 1000)

    await prisma.scheduledMessage.create({
      data: {
        groupId: group.id,
        chatId: BigInt(ctx.chat.id),
        text: `⏰ <b>Reminder:</b> ${text}`,
        createdBy: BigInt(ctx.from!.id),
        sendAt,
      },
    })

    await modLogRepo.create({
      groupId: group.id,
      action: 'schedule_create',
      actorId: BigInt(ctx.from!.id),
      details: { type: 'remind', duration: durationStr },
    })

    await ctx.reply(`✅ Reminder set for <b>${formatDuration(seconds)}</b> from now.`)
  })

  // /schedule <duration> <message> — schedule a message
  feature.command('schedule', requirePermission('admin', prisma), logHandle('cmd:schedule'), async (ctx) => {
    const args = ctx.match?.toString().trim() ?? ''

    // /schedule list
    if (args === 'list' || args === '') {
      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (!group)
        return

      const messages = await prisma.scheduledMessage.findMany({
        where: { groupId: group.id, sent: false },
        orderBy: { sendAt: 'asc' },
        take: 20,
      })

      if (messages.length === 0) {
        await ctx.reply('📋 No scheduled messages.')
        return
      }

      const lines = messages.map((msg, i) => {
        const preview = msg.text.length > 50 ? `${msg.text.slice(0, 50)}...` : msg.text
        return `${i + 1}. <code>${msg.id.slice(0, 8)}</code> — ${msg.sendAt.toISOString().slice(0, 16)} — ${preview}`
      })

      await ctx.reply(`📋 <b>Scheduled Messages</b> (${messages.length})\n\n${lines.join('\n')}\n\nUse /schedule cancel &lt;id&gt; to remove.`)
      return
    }

    // /schedule cancel <id>
    if (args.startsWith('cancel')) {
      const id = args.split(/\s+/)[1]
      if (!id) {
        await ctx.reply('Usage: /schedule cancel &lt;id&gt;')
        return
      }

      const message = await prisma.scheduledMessage.findFirst({
        where: {
          id: { startsWith: id },
          sent: false,
        },
      })

      if (!message) {
        await ctx.reply('Scheduled message not found or already sent.')
        return
      }

      await prisma.scheduledMessage.delete({ where: { id: message.id } })

      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'schedule_cancel',
          actorId: BigInt(ctx.from!.id),
          details: { messageId: message.id },
        })
      }

      await ctx.reply('✅ Scheduled message cancelled.')
      return
    }

    // /schedule <duration> <message>
    const parts = args.split(/\s+/)
    const durationStr = parts[0]
    const text = parts.slice(1).join(' ')

    if (!durationStr || !text) {
      await ctx.reply('Usage:\n/schedule &lt;duration&gt; &lt;message&gt;\n/schedule list\n/schedule cancel &lt;id&gt;\n\nExample: /schedule 2h Hello everyone!')
      return
    }

    const seconds = parseDuration(durationStr)
    if (!seconds) {
      await ctx.reply('Invalid duration. Use: 30s, 5m, 1h, 1d, 1w')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const sendAt = new Date(Date.now() + seconds * 1000)

    await prisma.scheduledMessage.create({
      data: {
        groupId: group.id,
        chatId: BigInt(ctx.chat.id),
        text,
        createdBy: BigInt(ctx.from!.id),
        sendAt,
      },
    })

    await modLogRepo.create({
      groupId: group.id,
      action: 'schedule_create',
      actorId: BigInt(ctx.from!.id),
      details: { type: 'schedule', duration: durationStr },
    })

    await ctx.reply(`✅ Message scheduled for <b>${formatDuration(seconds)}</b> from now.`)
  })

  return feature
}
