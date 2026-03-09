import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { MemberRepository } from '../../repositories/MemberRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { WarningRepository } from '../../repositories/WarningRepository.js'
import { checkEscalation } from '../../services/moderation.js'
import { isAdmin } from '../filters/is-admin.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return regex.test(text)
}

function findMatchingKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter(kw => matchesKeyword(text, kw))
}

export function createFiltersFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const configRepo = new GroupConfigRepository(prisma)
  const modLogRepo = new ModerationLogRepository(prisma)
  const warningRepo = new WarningRepository(prisma)
  const memberRepo = new MemberRepository(prisma)

  // Keyword filter middleware — runs on text/caption messages in groups
  feature.on(['message:text', 'message:caption'], async (ctx, next) => {
    const chatType = ctx.chat?.type
    if (chatType !== 'group' && chatType !== 'supergroup')
      return next()

    // Admins bypass
    if (isAdmin(ctx))
      return next()

    const config = ctx.session.groupConfig
    if (!config?.keywordFiltersEnabled || config.keywordFilters.length === 0)
      return next()

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : ctx.message?.caption
    if (!text)
      return next()

    const matched = findMatchingKeywords(text, config.keywordFilters)
    if (matched.length === 0)
      return next()

    // Delete the message
    try {
      await ctx.deleteMessage()
    }
    catch { /* ignore if can't delete */ }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const targetId = BigInt(ctx.from!.id)

    // Issue a warning
    const member = await memberRepo.upsertMember(group.id, targetId)
    const expiresAt = config.warnDecayDays
      ? new Date(Date.now() + config.warnDecayDays * 86400000)
      : undefined
    await warningRepo.createWarning(group.id, member.id, BigInt(0), `Keyword filter: ${matched.join(', ')}`, expiresAt)
    const count = await warningRepo.countActive(group.id, member.id)

    // Log to moderation log
    await modLogRepo.create({
      groupId: group.id,
      action: 'keyword_filter',
      actorId: BigInt(0),
      targetId,
      reason: `Matched keywords: ${matched.join(', ')}`,
      automated: true,
    })

    const name = ctx.from!.username ? `@${ctx.from!.username}` : ctx.from!.first_name
    let reply = `🚫 <b>${name}</b>: message removed (keyword filter). Warning ${count}.`

    // Check escalation
    const escalation = checkEscalation(count, config)
    if (escalation === 'mute') {
      const duration = config.defaultMuteDurationS
      await ctx.restrictChatMember(ctx.from!.id, { can_send_messages: false }, {
        until_date: Math.floor(Date.now() / 1000) + duration,
      })
      reply += `\n🔇 Auto-muted for ${Math.floor(duration / 60)} minutes.`
      await modLogRepo.create({
        groupId: group.id,
        action: 'mute',
        actorId: BigInt(0),
        targetId,
        reason: `Auto-mute: ${count} warnings reached threshold`,
        automated: true,
      })
    }
    else if (escalation === 'ban') {
      await ctx.banChatMember(ctx.from!.id)
      reply += `\n🚫 Auto-banned: warning threshold reached.`
      await modLogRepo.create({
        groupId: group.id,
        action: 'ban',
        actorId: BigInt(0),
        targetId,
        reason: `Auto-ban: ${count} warnings reached threshold`,
        automated: true,
      })
    }

    const msg = await ctx.reply(reply)

    // Auto-delete notice after 5s
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, msg.message_id)
      }
      catch { /* ignore */ }
    }, 5000)
  })

  // /filter add <keyword> — add keyword to filter list
  feature.command('filter', requirePermission('admin', prisma), logHandle('cmd:filter'), async (ctx) => {
    const args = ctx.match?.toString().trim()
    if (!args) {
      await ctx.reply('Usage:\n/filter add &lt;keyword&gt;\n/filter remove &lt;keyword&gt;\n/filter list')
      return
    }

    const config = ctx.session.groupConfig
    if (!config)
      return

    const parts = args.split(/\s+/)
    const subcommand = parts[0]?.toLowerCase()
    const keyword = parts.slice(1).join(' ').trim().toLowerCase()

    if (subcommand === 'add') {
      if (!keyword) {
        await ctx.reply('Usage: /filter add &lt;keyword or phrase&gt;')
        return
      }

      const filters = [...config.keywordFilters]
      if (filters.includes(keyword)) {
        await ctx.reply(`✅ <b>${keyword}</b> is already in the filter list.`)
        return
      }

      filters.push(keyword)
      await configRepo.updateConfig(config.groupId, { keywordFilters: filters, keywordFiltersEnabled: true })
      ctx.session.groupConfig = { ...config, keywordFilters: filters, keywordFiltersEnabled: true }

      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'filter_add',
          actorId: BigInt(ctx.from!.id),
          details: { keyword },
        })
      }

      await ctx.reply(`✅ Added <b>${keyword}</b> to keyword filters. (${filters.length} total)`)
    }
    else if (subcommand === 'remove') {
      if (!keyword) {
        await ctx.reply('Usage: /filter remove &lt;keyword or phrase&gt;')
        return
      }

      const filters = config.keywordFilters.filter(k => k !== keyword)
      if (filters.length === config.keywordFilters.length) {
        await ctx.reply(`⚠️ <b>${keyword}</b> is not in the filter list.`)
        return
      }

      const enabled = filters.length > 0 ? config.keywordFiltersEnabled : false
      await configRepo.updateConfig(config.groupId, { keywordFilters: filters, keywordFiltersEnabled: enabled })
      ctx.session.groupConfig = { ...config, keywordFilters: filters, keywordFiltersEnabled: enabled }

      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (group) {
        await modLogRepo.create({
          groupId: group.id,
          action: 'filter_remove',
          actorId: BigInt(ctx.from!.id),
          details: { keyword },
        })
      }

      await ctx.reply(`🚫 Removed <b>${keyword}</b> from keyword filters. (${filters.length} remaining)`)
    }
    else if (subcommand === 'list') {
      const enabled = config.keywordFiltersEnabled ? '✅ Enabled' : '❌ Disabled'

      if (config.keywordFilters.length === 0) {
        await ctx.reply(`📋 <b>Keyword Filters</b>: ${enabled}\n\nNo keywords configured.`)
        return
      }

      const keywords = config.keywordFilters.map(k => `• <code>${k}</code>`).join('\n')
      await ctx.reply(`📋 <b>Keyword Filters</b>: ${enabled}\n\n<b>Filtered keywords:</b>\n${keywords}`)
    }
    else {
      await ctx.reply('Usage:\n/filter add &lt;keyword&gt;\n/filter remove &lt;keyword&gt;\n/filter list')
    }
  })

  return feature
}
