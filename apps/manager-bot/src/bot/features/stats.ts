import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

interface AggregatedStats {
  totalMessages: number
  totalSpam: number
  totalLinksBlocked: number
  totalWarnings: number
  totalMutes: number
  totalBans: number
  totalDeleted: number
  totalNewMembers: number
  totalLeftMembers: number
  latestMemberCount: number
}

function formatStats(stats: AggregatedStats, period: string): string {
  const memberGrowth = stats.totalNewMembers - stats.totalLeftMembers
  const growthSign = memberGrowth >= 0 ? '+' : ''

  const lines = [
    `📊 <b>Group Stats — ${period}</b>`,
    '',
    `👥 <b>Members:</b> ${stats.latestMemberCount} (${growthSign}${memberGrowth})`,
    `   ➕ Joined: ${stats.totalNewMembers}`,
    `   ➖ Left: ${stats.totalLeftMembers}`,
    '',
    `💬 <b>Messages:</b> ${stats.totalMessages}`,
    '',
    `🛡 <b>Moderation:</b>`,
    `   🚫 Spam detected: ${stats.totalSpam}`,
    `   🔗 Links blocked: ${stats.totalLinksBlocked}`,
    `   ⚠️ Warnings: ${stats.totalWarnings}`,
    `   🔇 Mutes: ${stats.totalMutes}`,
    `   🚷 Bans: ${stats.totalBans}`,
    `   🗑 Deleted messages: ${stats.totalDeleted}`,
  ]

  return lines.join('\n')
}

export function createStatsFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()

  feature.command('stats', requirePermission('moderator', prisma), logHandle('cmd:stats'), async (ctx) => {
    const chatId = ctx.chat.id
    const group = await prisma.managedGroup.findUnique({
      where: { chatId: BigInt(chatId) },
    })

    if (!group) {
      await ctx.reply('This group is not managed.')
      return
    }

    const arg = ctx.match?.toString().trim().toLowerCase() ?? ''

    let days: number
    let periodLabel: string

    if (arg === '7d') {
      days = 7
      periodLabel = 'Last 7 Days'
    }
    else if (arg === '30d') {
      days = 30
      periodLabel = 'Last 30 Days'
    }
    else {
      days = 1
      periodLabel = 'Today'
    }

    const since = new Date()
    since.setHours(0, 0, 0, 0)
    if (days > 1) {
      since.setDate(since.getDate() - (days - 1))
    }

    const snapshots = await prisma.groupAnalyticsSnapshot.findMany({
      where: {
        groupId: group.id,
        date: { gte: since },
      },
      orderBy: { date: 'desc' },
    })

    if (snapshots.length === 0) {
      await ctx.reply(`📊 <b>Group Stats — ${periodLabel}</b>\n\nNo data available yet.`)
      return
    }

    const stats: AggregatedStats = {
      totalMessages: 0,
      totalSpam: 0,
      totalLinksBlocked: 0,
      totalWarnings: 0,
      totalMutes: 0,
      totalBans: 0,
      totalDeleted: 0,
      totalNewMembers: 0,
      totalLeftMembers: 0,
      latestMemberCount: snapshots[0]!.memberCount,
    }

    for (const s of snapshots) {
      stats.totalMessages += s.messageCount
      stats.totalSpam += s.spamDetected
      stats.totalLinksBlocked += s.linksBlocked
      stats.totalWarnings += s.warningsIssued
      stats.totalMutes += s.mutesIssued
      stats.totalBans += s.bansIssued
      stats.totalDeleted += s.deletedMessages
      stats.totalNewMembers += s.newMembers
      stats.totalLeftMembers += s.leftMembers
    }

    await ctx.reply(formatStats(stats, periodLabel))
  })

  return feature
}
