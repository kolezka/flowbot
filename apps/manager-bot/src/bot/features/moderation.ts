import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { MemberRepository } from '../../repositories/MemberRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { WarningRepository } from '../../repositories/WarningRepository.js'
import { checkEscalation } from '../../services/moderation.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'
import { formatDuration, parseDuration } from '../helpers/time.js'

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

  // /mute — restrict a user
  feature.command('mute', requirePermission('moderator', prisma), logHandle('cmd:mute'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from
    if (!targetUser || targetUser.is_bot) {
      await ctx.reply('Reply to a user\'s message to mute them.')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const args = ctx.match?.toString().trim().split(/\s+/) ?? []
    let durationS = ctx.session.groupConfig?.defaultMuteDurationS ?? 3600
    let reason: string | undefined

    if (args.length > 0 && args[0]) {
      const parsed = parseDuration(args[0])
      if (parsed !== null) {
        durationS = parsed
        reason = args.slice(1).join(' ') || undefined
      }
      else {
        reason = args.join(' ') || undefined
      }
    }

    await ctx.restrictChatMember(targetUser.id, { can_send_messages: false }, {
      until_date: Math.floor(Date.now() / 1000) + durationS,
    })

    await modLogRepo.create({
      groupId: group.id,
      action: 'mute',
      actorId: BigInt(ctx.from!.id),
      targetId: BigInt(targetUser.id),
      reason,
      details: { duration: durationS },
    })

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    let reply = `🔇 <b>${name}</b> muted for ${formatDuration(durationS)}.`
    if (reason)
      reply += `\nReason: ${reason}`
    await ctx.reply(reply)
  })

  // /unmute — lift restrictions
  feature.command('unmute', requirePermission('moderator', prisma), logHandle('cmd:unmute'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from
    if (!targetUser) {
      await ctx.reply('Reply to a user\'s message to unmute them.')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    await ctx.restrictChatMember(targetUser.id, {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_invite_users: true,
    })

    await modLogRepo.create({
      groupId: group.id,
      action: 'unmute',
      actorId: BigInt(ctx.from!.id),
      targetId: BigInt(targetUser.id),
    })

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    await ctx.reply(`🔊 <b>${name}</b> unmuted.`)
  })

  // /ban — ban a user
  feature.command('ban', requirePermission('moderator', prisma), logHandle('cmd:ban'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from
    if (!targetUser || targetUser.is_bot) {
      await ctx.reply('Reply to a user\'s message to ban them.')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const reason = ctx.match?.toString().trim() || undefined

    await ctx.banChatMember(targetUser.id)

    await modLogRepo.create({
      groupId: group.id,
      action: 'ban',
      actorId: BigInt(ctx.from!.id),
      targetId: BigInt(targetUser.id),
      reason,
    })

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    let reply = `🚫 <b>${name}</b> banned.`
    if (reason)
      reply += `\nReason: ${reason}`
    await ctx.reply(reply)
  })

  // /unban — unban a user
  feature.command('unban', requirePermission('moderator', prisma), logHandle('cmd:unban'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from
    if (!targetUser) {
      await ctx.reply('Reply to a user\'s message to unban them.')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    await ctx.api.unbanChatMember(ctx.chat.id, targetUser.id, { only_if_banned: true })

    await modLogRepo.create({
      groupId: group.id,
      action: 'unban',
      actorId: BigInt(ctx.from!.id),
      targetId: BigInt(targetUser.id),
    })

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    await ctx.reply(`✅ <b>${name}</b> unbanned.`)
  })

  // /kick — remove user without permanent ban
  feature.command('kick', requirePermission('moderator', prisma), logHandle('cmd:kick'), async (ctx) => {
    const replyTo = ctx.message?.reply_to_message
    const targetUser = replyTo?.from
    if (!targetUser || targetUser.is_bot) {
      await ctx.reply('Reply to a user\'s message to kick them.')
      return
    }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const reason = ctx.match?.toString().trim() || undefined

    await ctx.banChatMember(targetUser.id)
    await ctx.api.unbanChatMember(ctx.chat.id, targetUser.id, { only_if_banned: true })

    await modLogRepo.create({
      groupId: group.id,
      action: 'kick',
      actorId: BigInt(ctx.from!.id),
      targetId: BigInt(targetUser.id),
      reason,
    })

    const name = targetUser.username ? `@${targetUser.username}` : targetUser.first_name
    let reply = `👢 <b>${name}</b> kicked.`
    if (reason)
      reply += `\nReason: ${reason}`
    await ctx.reply(reply)
  })

  return feature
}
