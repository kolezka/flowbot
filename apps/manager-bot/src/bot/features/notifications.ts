import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

const VALID_EVENT_TYPES = ['order_placed', 'order_shipped'] as const

export function createNotificationsFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const modLogRepo = new ModerationLogRepository(prisma)

  feature.command('notifications', requirePermission('admin', prisma), logHandle('cmd:notifications'), async (ctx) => {
    const args = ctx.match?.toString().trim() ?? ''

    if (!args) {
      // Show current notification config
      const group = await prisma.managedGroup.findUnique({
        where: { chatId: BigInt(ctx.chat.id) },
        include: { config: true },
      })
      if (!group?.config) {
        await ctx.reply('No group config found. Run /setup first.')
        return
      }

      const events = group.config.notificationEvents
      const status = events.length > 0 ? 'ON' : 'OFF'
      const eventList = events.length > 0 ? events.join(', ') : 'none'

      await ctx.reply(
        `<b>Notification Config</b>\n\n`
        + `Status: <b>${status}</b>\n`
        + `Events: <code>${eventList}</code>\n\n`
        + `Usage:\n`
        + `/notifications on — enable notifications\n`
        + `/notifications off — disable notifications\n`
        + `/notifications events &lt;type1&gt; &lt;type2&gt; — set event types\n`
        + `\nValid events: ${VALID_EVENT_TYPES.join(', ')}`,
      )
      return
    }

    const group = await prisma.managedGroup.findUnique({
      where: { chatId: BigInt(ctx.chat.id) },
      include: { config: true },
    })
    if (!group?.config) {
      await ctx.reply('No group config found. Run /setup first.')
      return
    }

    if (args === 'on') {
      // Enable with default events if none set
      const events = group.config.notificationEvents.length > 0
        ? group.config.notificationEvents
        : ['order_placed']

      await prisma.groupConfig.update({
        where: { id: group.config.id },
        data: { notificationEvents: events },
      })

      await modLogRepo.create({
        groupId: group.id,
        action: 'notifications_on',
        actorId: BigInt(ctx.from!.id),
        details: { events },
      })

      await ctx.reply(`Notifications enabled. Events: <code>${events.join(', ')}</code>`)
      return
    }

    if (args === 'off') {
      await prisma.groupConfig.update({
        where: { id: group.config.id },
        data: { notificationEvents: [] },
      })

      await modLogRepo.create({
        groupId: group.id,
        action: 'notifications_off',
        actorId: BigInt(ctx.from!.id),
      })

      await ctx.reply('Notifications disabled.')
      return
    }

    if (args.startsWith('events')) {
      const eventArgs = args.replace(/^events\s*/, '').trim().split(/\s+/).filter(Boolean)

      if (eventArgs.length === 0) {
        await ctx.reply(
          `Usage: /notifications events &lt;type1&gt; &lt;type2&gt;\n\nValid events: ${VALID_EVENT_TYPES.join(', ')}`,
        )
        return
      }

      const invalidEvents = eventArgs.filter(e => !VALID_EVENT_TYPES.includes(e as typeof VALID_EVENT_TYPES[number]))
      if (invalidEvents.length > 0) {
        await ctx.reply(
          `Invalid event types: <code>${invalidEvents.join(', ')}</code>\n\nValid events: ${VALID_EVENT_TYPES.join(', ')}`,
        )
        return
      }

      await prisma.groupConfig.update({
        where: { id: group.config.id },
        data: { notificationEvents: eventArgs },
      })

      await modLogRepo.create({
        groupId: group.id,
        action: 'notifications_events',
        actorId: BigInt(ctx.from!.id),
        details: { events: eventArgs },
      })

      await ctx.reply(`Notification events set to: <code>${eventArgs.join(', ')}</code>`)
      return
    }

    await ctx.reply(
      `Unknown subcommand. Usage:\n`
      + `/notifications on|off\n`
      + `/notifications events &lt;type1&gt; &lt;type2&gt;`,
    )
  })

  return feature
}
