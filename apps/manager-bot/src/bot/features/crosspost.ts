import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { tasks } from '@trigger.dev/sdk/v3'
import { CrossPostTemplateRepository } from '../../repositories/CrossPostTemplateRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

export function createCrossPostFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const templateRepo = new CrossPostTemplateRepository(prisma)
  const modLogRepo = new ModerationLogRepository(prisma)

  feature.command('crosspost', requirePermission('admin', prisma), logHandle('cmd:crosspost'), async (ctx) => {
    const args = ctx.match?.toString().trim() ?? ''

    // /crosspost list
    if (args === 'list' || args === '') {
      const templates = await templateRepo.findAllActive()
      if (templates.length === 0) {
        await ctx.reply('No cross-post templates found.')
        return
      }

      const lines = templates.map((t, i) => {
        const preview = t.messageText.length > 40 ? `${t.messageText.slice(0, 40)}...` : t.messageText
        return `${i + 1}. <b>${t.name}</b> — ${t.targetChatIds.length} targets — ${preview}`
      })

      await ctx.reply(`<b>Cross-Post Templates</b> (${templates.length})\n\n${lines.join('\n')}`)
      return
    }

    // /crosspost create <name>
    if (args.startsWith('create ')) {
      const name = args.slice(7).trim()
      if (!name) {
        await ctx.reply('Usage: /crosspost create &lt;name&gt;\n\nSend this in a group to use the current message text as template. The group\'s chat ID will be added as a target.')
        return
      }

      if (!/^[\w-]+$/.test(name)) {
        await ctx.reply('Template name must contain only letters, numbers, hyphens, and underscores.')
        return
      }

      const existing = await templateRepo.findByName(name)
      if (existing) {
        await ctx.reply(`Template "<b>${name}</b>" already exists. Delete it first with /crosspost delete ${name}`)
        return
      }

      // Get all active managed groups as target chat IDs
      const groups = await prisma.managedGroup.findMany({
        where: { isActive: true },
        select: { chatId: true },
      })

      if (groups.length === 0) {
        await ctx.reply('No active managed groups found to use as targets.')
        return
      }

      const targetChatIds = groups.map(g => g.chatId)

      // Use replied-to message text if available, otherwise use a placeholder
      let messageText = ''
      if (ctx.message?.reply_to_message?.text) {
        messageText = ctx.message.reply_to_message.text
      }
      else {
        await ctx.reply('Reply to a message to use its text as the template content.\n\nUsage: Reply to a message with /crosspost create &lt;name&gt;')
        return
      }

      const template = await templateRepo.create({
        name,
        messageText,
        targetChatIds,
        createdBy: BigInt(ctx.from!.id),
      })

      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'crosspost_template_create',
          actorId: BigInt(ctx.from!.id),
          details: { templateName: name, targetCount: targetChatIds.length, templateId: template.id },
        })
      }

      await ctx.reply(`Template "<b>${name}</b>" created with ${targetChatIds.length} target(s).`)
      return
    }

    // /crosspost delete <name>
    if (args.startsWith('delete ')) {
      const name = args.slice(7).trim()
      if (!name) {
        await ctx.reply('Usage: /crosspost delete &lt;name&gt;')
        return
      }

      const deleted = await templateRepo.deleteByName(name)
      if (!deleted) {
        await ctx.reply(`Template "<b>${name}</b>" not found.`)
        return
      }

      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'crosspost_template_delete',
          actorId: BigInt(ctx.from!.id),
          details: { templateName: name },
        })
      }

      await ctx.reply(`Template "<b>${name}</b>" deleted.`)
      return
    }

    // /crosspost <template_name> — execute cross-post (placeholder for Trigger.dev)
    const templateName = args
    const template = await templateRepo.findByName(templateName)
    if (!template) {
      await ctx.reply(`Template "<b>${templateName}</b>" not found.\n\nUse /crosspost list to see available templates.`)
      return
    }

    if (!template.isActive) {
      await ctx.reply(`Template "<b>${templateName}</b>" is inactive.`)
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })

    try {
      await tasks.trigger('cross-post', {
        templateId: template.id,
        messageText: template.messageText,
        targetChatIds: template.targetChatIds.map((id: bigint) => id.toString()),
      })

      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'crosspost_execute',
          actorId: BigInt(ctx.from!.id),
          details: {
            templateName: template.name,
            templateId: template.id,
            targetCount: template.targetChatIds.length,
          },
        })
      }

      await ctx.reply(
        `Cross-post "<b>${template.name}</b>" dispatched to ${template.targetChatIds.length} target(s).`,
      )
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'crosspost_execute_failed',
          actorId: BigInt(ctx.from!.id),
          details: { templateName: template.name, error: errorMsg },
        })
      }
      await ctx.reply(`Failed to dispatch cross-post: ${errorMsg}`)
    }
  })

  return feature
}
