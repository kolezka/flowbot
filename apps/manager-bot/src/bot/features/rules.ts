import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

export function createRulesFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const configRepo = new GroupConfigRepository(prisma)

  // /rules — display group rules (available to all members)
  feature.command('rules', logHandle('cmd:rules'), async (ctx) => {
    const config = ctx.session.groupConfig
    if (!config?.rulesText) {
      await ctx.reply('No rules have been set for this group. Admins can use /setrules to set them.')
      return
    }

    await ctx.reply(`📜 <b>Group Rules</b>\n\n${config.rulesText}`)
  })

  // /setrules <text> — set group rules (admin only)
  feature.command('setrules', requirePermission('admin', prisma), logHandle('cmd:setrules'), async (ctx) => {
    const text = ctx.match?.toString().trim()
    if (!text) {
      await ctx.reply('Usage: /setrules &lt;rules text&gt;\n\nTip: Use line breaks to separate rules.')
      return
    }

    const config = ctx.session.groupConfig
    if (!config)
      return

    await configRepo.updateConfig(config.groupId, { rulesText: text })
    ctx.session.groupConfig = { ...config, rulesText: text }

    await ctx.reply('✅ Group rules updated.')
  })

  // /pinrules — pin the rules message (admin only)
  feature.command('pinrules', requirePermission('admin', prisma), logHandle('cmd:pinrules'), async (ctx) => {
    const config = ctx.session.groupConfig
    if (!config?.rulesText) {
      await ctx.reply('No rules set. Use /setrules first.')
      return
    }

    const msg = await ctx.reply(`📜 <b>Group Rules</b>\n\n${config.rulesText}`)

    try {
      await ctx.pinChatMessage(msg.message_id)
      await ctx.reply('✅ Rules pinned.')
    }
    catch {
      await ctx.reply('⚠️ Could not pin the message. Make sure the bot has pin permissions.')
    }
  })

  return feature
}
