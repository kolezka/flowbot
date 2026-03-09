import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

const ACTION_ICONS: Record<string, string> = {
  warn: '⚠️',
  unwarn: '✅',
  mute: '🔇',
  unmute: '🔊',
  ban: '🚫',
  unban: '✅',
  kick: '👢',
  link_blocked: '🔗',
  allowlink: '🔗',
  denylink: '🔗',
  config_change: '⚙️',
}

function formatLogEntry(log: { action: string, actorId: bigint, targetId: bigint | null, reason: string | null, automated: boolean, createdAt: Date }): string {
  const icon = ACTION_ICONS[log.action] ?? '📋'
  const date = log.createdAt.toISOString().slice(0, 16).replace('T', ' ')
  const actor = log.automated ? 'System' : `<code>${log.actorId}</code>`
  const target = log.targetId ? ` → <code>${log.targetId}</code>` : ''
  const reason = log.reason ? ` — ${log.reason}` : ''
  return `${icon} <b>${log.action}</b> by ${actor}${target}${reason}\n   <i>${date}</i>`
}

export function createAuditFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const modLogRepo = new ModerationLogRepository(prisma)

  // /modlog [N] or /modlog @user
  feature.command('modlog', requirePermission('moderator', prisma), logHandle('cmd:modlog'), async (ctx) => {
    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (!group)
      return

    const arg = ctx.match?.toString().trim()

    // /modlog @user — filter by target user (reply-based or mention)
    const replyTarget = ctx.message?.reply_to_message?.from
    if (replyTarget) {
      const logs = await modLogRepo.findByTarget(group.id, BigInt(replyTarget.id))
      if (logs.length === 0) {
        await ctx.reply('No moderation logs for this user.')
        return
      }
      const name = replyTarget.username ? `@${replyTarget.username}` : replyTarget.first_name
      const lines = logs.map(formatLogEntry)
      await ctx.reply(`📋 <b>Moderation log for ${name}</b>\n\n${lines.join('\n\n')}`)
      return
    }

    // /modlog N — last N entries (default 10)
    const limit = arg ? Number.parseInt(arg, 10) : 10
    const count = Number.isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 50)

    const logs = await modLogRepo.findByGroup(group.id, count)
    if (logs.length === 0) {
      await ctx.reply('No moderation logs for this group.')
      return
    }

    const lines = logs.map(formatLogEntry)
    await ctx.reply(`📋 <b>Moderation log</b> (last ${logs.length})\n\n${lines.join('\n\n')}`)
  })

  return feature
}
