import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { MemberRepository } from '../../repositories/MemberRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { WarningRepository } from '../../repositories/WarningRepository.js'
import { checkEscalation } from '../../services/moderation.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

export function createModerationFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const warningRepo = new WarningRepository(prisma)
  const memberRepo = new MemberRepository(prisma)
  const modLogRepo = new ModerationLogRepository(prisma)

  // /warn — issue a warning (reply to user's message)
  feature.command('warn', requirePermission('moderator', prisma), logHandle('cmd:warn'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from
    if (!targetUser || targetUser.is_bot) {
      await ctx.reply('Reply to a user\'s message to warn them.')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const reason = ctx.match?.toString().trim() || undefined
    const config = ctx.session.groupConfig
    const expiresAt = config?.warnDecayDays
      ? new Date(Date.now() + config.warnDecayDays * 86400000)
      : undefined

    // Ensure member exists
    const member = await memberRepo.upsertMember(group.id, BigInt(targetUser.id))

    // Create warning
    await warningRepo.createWarning(group.id, member.id, BigInt(ctx.from!.id), reason, expiresAt)
    const count = await warningRepo.countActive(group.id, member.id)

    // Log
    await modLogRepo.create({
      groupId: group.id,
      action: 'warn',
      actorId: BigInt(ctx.from!.id),
      targetId: BigInt(targetUser.id),
      reason,
    })

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    let reply = `⚠️ <b>${name}</b> warned (${count} active warning${count > 1 ? 's' : ''}).`
    if (reason)
      reply += `\nReason: ${reason}`

    // Check escalation
    if (config) {
      const escalation = checkEscalation(count, config)
      if (escalation === 'mute') {
        const duration = config.defaultMuteDurationS
        await ctx.restrictChatMember(targetUser.id, { can_send_messages: false }, {
          until_date: Math.floor(Date.now() / 1000) + duration,
        })
        reply += `\n🔇 Auto-muted for ${Math.floor(duration / 60)} minutes.`
        await modLogRepo.create({
          groupId: group.id,
          action: 'mute',
          actorId: BigInt(0),
          targetId: BigInt(targetUser.id),
          reason: `Auto-mute: ${count} warnings reached threshold`,
          automated: true,
        })
      }
      else if (escalation === 'ban') {
        await ctx.banChatMember(targetUser.id)
        reply += `\n🚫 Auto-banned: warning threshold reached.`
        await modLogRepo.create({
          groupId: group.id,
          action: 'ban',
          actorId: BigInt(0),
          targetId: BigInt(targetUser.id),
          reason: `Auto-ban: ${count} warnings reached threshold`,
          automated: true,
        })
      }
    }

    await ctx.reply(reply)
  })

  // /unwarn — remove most recent warning
  feature.command('unwarn', requirePermission('moderator', prisma), logHandle('cmd:unwarn'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from
    if (!targetUser) {
      await ctx.reply('Reply to a user\'s message to remove their last warning.')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const member = await memberRepo.findByGroupAndTelegram(group.id, BigInt(targetUser.id))
    if (!member) {
      await ctx.reply('No warnings found for this user.')
      return
    }

    const removed = await warningRepo.deactivateLatest(group.id, member.id)
    if (!removed) {
      await ctx.reply('No active warnings to remove.')
      return
    }

    const count = await warningRepo.countActive(group.id, member.id)

    await modLogRepo.create({
      groupId: group.id,
      action: 'unwarn',
      actorId: BigInt(ctx.from!.id),
      targetId: BigInt(targetUser.id),
    })

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    await ctx.reply(`✅ Warning removed for <b>${name}</b>. Active warnings: ${count}.`)
  })

  // /warnings — show warning history
  feature.command('warnings', requirePermission('moderator', prisma), logHandle('cmd:warnings'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from
    if (!targetUser) {
      await ctx.reply('Reply to a user\'s message to see their warnings.')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const member = await memberRepo.findByGroupAndTelegram(group.id, BigInt(targetUser.id))
    if (!member) {
      await ctx.reply('No warnings found for this user.')
      return
    }

    const warnings = await warningRepo.findByMember(group.id, member.id)
    if (warnings.length === 0) {
      await ctx.reply('No warnings found for this user.')
      return
    }

    const activeCount = await warningRepo.countActive(group.id, member.id)
    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name

    const lines = warnings.map((w) => {
      const date = w.createdAt.toISOString().slice(0, 10)
      const status = w.isActive ? '🔴' : '⚪'
      const reason = w.reason || 'No reason'
      const expired = w.expiresAt && w.expiresAt < new Date() ? ' (expired)' : ''
      return `${status} ${date} — ${reason}${expired}`
    })

    await ctx.reply(
      `<b>Warnings for ${name}</b> (${activeCount} active):\n${lines.join('\n')}`,
    )
  })

  return feature
}
