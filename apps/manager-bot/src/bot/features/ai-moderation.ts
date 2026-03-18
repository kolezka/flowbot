import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

export function createAiModerationFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const modLogRepo = new ModerationLogRepository(prisma)
  const configRepo = new GroupConfigRepository(prisma)

  feature.command('aimod', requirePermission('admin', prisma), logHandle('cmd:aimod'), async (ctx) => {
    const config = ctx.session.groupConfig
    if (!config) {
      await ctx.reply('No configuration found for this group.')
      return
    }

    const args = ctx.match?.toString().trim().split(/\s+/) ?? []
    const subcommand = args[0]?.toLowerCase() ?? ''

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })

    // /aimod — show current status
    if (!subcommand) {
      const status = config.aiModEnabled ? '✅ Enabled' : '❌ Disabled'
      const threshold = config.aiModThreshold
      await ctx.reply(
        `🤖 <b>AI Moderation</b>\n\n`
        + `<b>Status:</b> ${status}\n`
        + `<b>Threshold:</b> ${threshold}\n`
        + `<b>Model:</b> claude-haiku-4-5\n\n`
        + `Commands:\n`
        + `• /aimod on — Enable AI moderation\n`
        + `• /aimod off — Disable AI moderation\n`
        + `• /aimod threshold &lt;0.0-1.0&gt; — Set confidence threshold\n`
        + `• /aimod stats — Show AI moderation statistics`,
      )
      return
    }

    // /aimod on
    if (subcommand === 'on') {
      await configRepo.updateConfig(config.groupId, { aiModEnabled: true })
      ctx.session.groupConfig = { ...config, aiModEnabled: true }

      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'config_change',
          actorId: BigInt(ctx.from!.id),
          details: { key: 'aiModEnabled', oldValue: String(config.aiModEnabled), newValue: 'true' },
        })
      }

      await ctx.reply('✅ AI moderation <b>enabled</b> for this group.')
      return
    }

    // /aimod off
    if (subcommand === 'off') {
      await configRepo.updateConfig(config.groupId, { aiModEnabled: false })
      ctx.session.groupConfig = { ...config, aiModEnabled: false }

      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'config_change',
          actorId: BigInt(ctx.from!.id),
          details: { key: 'aiModEnabled', oldValue: String(config.aiModEnabled), newValue: 'false' },
        })
      }

      await ctx.reply('❌ AI moderation <b>disabled</b> for this group.')
      return
    }

    // /aimod threshold <value>
    if (subcommand === 'threshold') {
      const rawValue = args[1]
      if (!rawValue) {
        await ctx.reply(`Current AI threshold: <b>${config.aiModThreshold}</b>\n\nUsage: /aimod threshold &lt;0.0-1.0&gt;`)
        return
      }

      const threshold = Number.parseFloat(rawValue)
      if (Number.isNaN(threshold) || threshold < 0.0 || threshold > 1.0) {
        await ctx.reply('Invalid threshold. Must be a number between 0.0 and 1.0.')
        return
      }

      const oldThreshold = config.aiModThreshold
      await configRepo.updateConfig(config.groupId, { aiModThreshold: threshold })
      ctx.session.groupConfig = { ...config, aiModThreshold: threshold }

      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'config_change',
          actorId: BigInt(ctx.from!.id),
          details: { key: 'aiModThreshold', oldValue: String(oldThreshold), newValue: String(threshold) },
        })
      }

      await ctx.reply(`✅ AI moderation threshold set to <b>${threshold}</b>.`)
      return
    }

    // /aimod stats
    if (subcommand === 'stats') {
      if (!group) {
        await ctx.reply('Group not found.')
        return
      }

      const count = await prisma.moderationLog.count({
        where: {
          groupId: group.id,
          action: 'ai_spam_detected',
        },
      })

      const recent = await prisma.moderationLog.findMany({
        where: {
          groupId: group.id,
          action: 'ai_spam_detected',
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      let statsText = `🤖 <b>AI Moderation Stats</b>\n\n`
        + `<b>Total detections:</b> ${count}\n`

      if (recent.length > 0) {
        statsText += `\n<b>Recent detections:</b>\n`
        for (const log of recent) {
          const details = log.details as Record<string, unknown> | null
          const label = details?.label ?? 'unknown'
          const confidence = details?.confidence
          const confStr = typeof confidence === 'number' ? ` (${(confidence * 100).toFixed(0)}%)` : ''
          const date = log.createdAt.toISOString().slice(0, 16).replace('T', ' ')
          statsText += `• ${date} — ${label}${confStr}\n`
        }
      }
      else {
        statsText += '\nNo AI detections recorded yet.'
      }

      await ctx.reply(statsText)
      return
    }

    await ctx.reply(
      'Unknown subcommand. Usage:\n'
      + '• /aimod — Show status\n'
      + '• /aimod on|off — Enable/disable\n'
      + '• /aimod threshold &lt;0.0-1.0&gt;\n'
      + '• /aimod stats',
    )
  })

  return feature
}
