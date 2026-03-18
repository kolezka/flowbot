import type { PrismaClient } from '@flowbot/db'
import type { AntiSpamService } from '../../services/anti-spam.js'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { isAdmin } from '../filters/is-admin.js'

// Minimum text length to consider for AI classification
const AI_CHECK_MIN_LENGTH = 50
// URL pattern to detect messages with links (potential spam vector)
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i
// Default AI moderation threshold if not configured in GroupConfig
const DEFAULT_AI_THRESHOLD = 0.8

/**
 * Check if a message has suspicious patterns that warrant AI classification.
 * Only messages that pass rule-based checks but look suspicious get sent to AI.
 */
function hasSuspiciousPatterns(text: string): boolean {
  // Long messages are more likely to contain spam/scam content
  if (text.length >= AI_CHECK_MIN_LENGTH)
    return true

  // Messages with URLs that passed anti-link (may still be spam)
  if (URL_PATTERN.test(text))
    return true

  // Messages with excessive caps (shouting/spam indicator)
  const letters = text.replace(/[^a-z]/gi, '')
  const upperOnly = text.replace(/[^A-Z]/g, '')
  const upperRatio = letters.length > 0
    ? (upperOnly.length / letters.length)
    : 0
  if (upperRatio > 0.7 && text.length > 20)
    return true

  // Messages with repeated special characters (common in spam)
  if (/(.)\1{4,}/.test(text))
    return true

  return false
}

export function createAntiSpamFeature(antiSpamService: AntiSpamService, prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const modLogRepo = new ModerationLogRepository(prisma)

  feature.on('message:text', async (ctx, next) => {
    const chatType = ctx.chat?.type
    if (chatType !== 'group' && chatType !== 'supergroup')
      return next()

    // Admins bypass anti-spam
    if (isAdmin(ctx))
      return next()

    const config = ctx.session.groupConfig
    if (!config?.antiSpamEnabled)
      return next()

    const text = ctx.message.text
    if (!text)
      return next()

    const verdict = antiSpamService.checkMessage(
      ctx.chat.id.toString(),
      ctx.from!.id.toString(),
      text,
      config.antiSpamMaxMessages,
      config.antiSpamWindowSeconds,
    )

    if (verdict !== 'clean') {
      // Rule-based spam detected — delete message
      try {
        await ctx.deleteMessage()
      }
      catch { /* ignore if can't delete */ }

      const reason = verdict === 'flood' ? 'Message flood detected' : 'Duplicate message spam detected'

      const msg = await ctx.reply(`🛡️ ${reason}. Message removed.`)

      // Auto-delete notice after 5s
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(ctx.chat!.id, msg.message_id)
        }
        catch { /* ignore */ }
      }, 5000)

      // Don't pass to other handlers
      return
    }

    // Message passed rule-based checks — check AI if enabled and configured
    // AI classification is non-blocking for normal flow: if AI is not available, skip
    if (antiSpamService.hasAiClassifier && hasSuspiciousPatterns(text)) {
      // Check if AI moderation is enabled for this group (per-group config)
      const aiEnabled = config.aiModEnabled
      const aiThreshold = config.aiModThreshold ?? DEFAULT_AI_THRESHOLD

      if (aiEnabled) {
        // Fire AI check without blocking message processing
        // We use a non-blocking approach: the message proceeds, but if AI flags it,
        // we delete it retroactively
        const chatId = ctx.chat.id
        const messageId = ctx.message.message_id
        const fromId = ctx.from!.id

        antiSpamService.checkWithAi(text, aiThreshold)
          .then(async (result) => {
            if (!result.isSpam)
              return

            // AI flagged this message — take action
            try {
              await ctx.api.deleteMessage(chatId, messageId)
            }
            catch { /* message may already be deleted */ }

            const reason = `AI detected ${result.classification.label} (confidence: ${(result.classification.confidence * 100).toFixed(0)}%): ${result.classification.reason}`

            try {
              const msg = await ctx.api.sendMessage(chatId, `🤖 ${reason}. Message removed.`)
              // Auto-delete notice after 5s
              setTimeout(async () => {
                try {
                  await ctx.api.deleteMessage(chatId, msg.message_id)
                }
                catch { /* ignore */ }
              }, 5000)
            }
            catch { /* ignore send errors */ }

            // Log AI moderation action
            const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(chatId) } })
            if (group) {
              await modLogRepo.create({
                groupId: group.id,
                action: 'ai_spam_detected',
                actorId: BigInt(0),
                targetId: BigInt(fromId),
                reason,
                details: {
                  classifier: 'ai',
                  label: result.classification.label,
                  confidence: result.classification.confidence,
                  aiReason: result.classification.reason,
                  messageText: text.slice(0, 200),
                },
                automated: true,
              })
            }
          })
          .catch(() => {
            // AI check failed silently — don't affect normal message processing
          })
      }
    }

    return next()
  })

  return feature
}
