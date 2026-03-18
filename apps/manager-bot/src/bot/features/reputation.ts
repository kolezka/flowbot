import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { ReputationService } from '../../services/reputation.js'
import { logHandle } from '../helpers/logging.js'

function formatReputation(
  name: string,
  rep: { totalScore: number, messageFactor: number, tenureFactor: number, warningPenalty: number, moderationBonus: number, lastCalculated: Date },
): string {
  const lines = [
    `⭐ <b>Reputation for ${name}</b>`,
    '',
    `🏆 <b>Total Score:</b> ${rep.totalScore}`,
    '',
    `📊 <b>Breakdown:</b>`,
    `   💬 Messages: +${rep.messageFactor}`,
    `   📅 Tenure: +${rep.tenureFactor}`,
    `   ⚠️ Warnings: -${rep.warningPenalty}`,
    `   🛡 Moderation role: +${rep.moderationBonus}`,
    '',
    `<i>Last calculated: ${rep.lastCalculated.toISOString().slice(0, 16).replace('T', ' ')}</i>`,
  ]
  return lines.join('\n')
}

export function createReputationFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const reputationService = new ReputationService(prisma)

  // /reputation — show own score, or reply to show another user's score
  feature.command('reputation', logHandle('cmd:reputation'), async (ctx) => {
    const replyTarget = ctx.message?.reply_to_message?.from

    if (replyTarget) {
      // Show target user's reputation
      if (replyTarget.is_bot) {
        await ctx.reply('Bots do not have reputation scores.')
        return
      }

      const rep = await reputationService.getOrCalculate(BigInt(replyTarget.id))
      const name = replyTarget.username ? `@${replyTarget.username}` : replyTarget.first_name
      await ctx.reply(formatReputation(name, rep))
      return
    }

    // Check for @username mention in args
    const arg = ctx.match?.toString().trim()
    if (arg && arg.startsWith('@')) {
      // We can't resolve @username to telegramId without a group member lookup
      // Try to find the user in group members by scanning
      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (!group) {
        await ctx.reply('This group is not managed.')
        return
      }

      // Unfortunately we don't store usernames in GroupMember, so direct @mention lookup isn't possible
      // Advise the user to reply to the target's message instead
      await ctx.reply('To check another user\'s reputation, reply to their message with /reputation.')
      return
    }

    // Show own reputation
    if (!ctx.from) {
      await ctx.reply('Could not identify you.')
      return
    }

    const rep = await reputationService.getOrCalculate(BigInt(ctx.from.id))
    const name = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name
    await ctx.reply(formatReputation(name, rep))
  })

  return feature
}
