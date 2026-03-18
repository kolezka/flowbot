import type { PrismaClient } from '@flowbot/db'
import type { Context } from '../context.js'
import { createCallbackData } from 'callback-data'
import { Composer, InlineKeyboard } from 'grammy'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

interface PendingVerification {
  chatId: number
  userId: number
  messageId: number
  correctAnswer: string
  timer: ReturnType<typeof setTimeout>
}

const pendingVerifications = new Map<string, PendingVerification>()

const captchaCallbackData = createCallbackData('captcha', {
  answer: String,
  chatId: Number,
  userId: Number,
})

function makeKey(chatId: number, userId: number): string {
  return `${chatId}:${userId}`
}

function generateButtonChallenge(): { correct: string, options: string[] } {
  const emojis = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍒', '🍑', '🥝', '🍌', '🫐']
  const shuffled = [...emojis].sort(() => Math.random() - 0.5)
  const correct = shuffled[0]!
  const options = shuffled.slice(0, 4).sort(() => Math.random() - 0.5)
  return { correct, options }
}

function generateMathChallenge(): { question: string, answer: string } {
  const a = Math.floor(Math.random() * 20) + 1
  const b = Math.floor(Math.random() * 20) + 1
  return { question: `${a} + ${b}`, answer: String(a + b) }
}

export function createCaptchaFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const configRepo = new GroupConfigRepository(prisma)

  // Handle chat_member join — issue captcha challenge
  feature.on('chat_member', async (ctx, next) => {
    const update = ctx.chatMember
    if (!update)
      return next()

    const oldStatus = update.old_chat_member.status
    const newStatus = update.new_chat_member.status

    const wasOut = oldStatus === 'left' || oldStatus === 'kicked'
    const isIn = newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator'

    if (!wasOut || !isIn)
      return next()

    const newMember = update.new_chat_member.user
    if (newMember.is_bot)
      return next()

    const config = ctx.session.groupConfig
    if (!config?.captchaEnabled)
      return next()

    // Check if user is already an admin — bypass captcha
    try {
      const member = await ctx.api.getChatMember(ctx.chat.id, newMember.id)
      if (member.status === 'administrator' || member.status === 'creator')
        return next()
    }
    catch { /* ignore */ }

    const chatId = ctx.chat.id
    const userId = newMember.id
    const key = makeKey(chatId, userId)

    // Clear any existing pending verification
    const existing = pendingVerifications.get(key)
    if (existing) {
      clearTimeout(existing.timer)
      try {
        await ctx.api.deleteMessage(chatId, existing.messageId)
      }
      catch { /* ignore */ }
      pendingVerifications.delete(key)
    }

    // Restrict new member — no sending messages
    try {
      await ctx.api.restrictChatMember(chatId, userId, {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_invite_users: false,
      })
    }
    catch (error) {
      ctx.logger.warn({ error, chatId, userId }, 'Failed to restrict new member for captcha')
      return next()
    }

    const userMention = `<a href="tg://user?id=${userId}">${escapeHtml(newMember.first_name)}</a>`
    const mode = config.captchaMode || 'button'
    const timeoutSeconds = config.captchaTimeoutS || 120

    let challengeMsg
    let correctAnswer: string

    if (mode === 'math') {
      const challenge = generateMathChallenge()
      correctAnswer = challenge.answer
      challengeMsg = await ctx.api.sendMessage(
        chatId,
        `🔒 ${userMention}, please verify you are human.\n\nWhat is <b>${challenge.question}</b>?\n\nReply with the correct answer within ${timeoutSeconds} seconds.`,
        { parse_mode: 'HTML' },
      )
    }
    else {
      // Button mode (default)
      const challenge = generateButtonChallenge()
      correctAnswer = challenge.correct

      const keyboard = new InlineKeyboard()
      for (const option of challenge.options) {
        keyboard.text(
          option,
          captchaCallbackData.pack({ answer: option, chatId, userId }),
        )
      }

      challengeMsg = await ctx.api.sendMessage(
        chatId,
        `🔒 ${userMention}, please verify you are human.\n\nTap the <b>${challenge.correct}</b> button within ${timeoutSeconds} seconds.`,
        { parse_mode: 'HTML', reply_markup: keyboard },
      )
    }

    // Set timeout to kick unverified member
    const timer = setTimeout(async () => {
      const pending = pendingVerifications.get(key)
      if (!pending)
        return

      pendingVerifications.delete(key)

      try {
        await ctx.api.deleteMessage(chatId, pending.messageId)
      }
      catch { /* ignore */ }

      try {
        await ctx.api.banChatMember(chatId, userId)
        // Unban immediately so they can rejoin
        await ctx.api.unbanChatMember(chatId, userId, { only_if_banned: true })
      }
      catch { /* ignore */ }

      try {
        const notice = await ctx.api.sendMessage(
          chatId,
          `⏰ ${userMention} was removed for not completing verification.`,
          { parse_mode: 'HTML' },
        )
        setTimeout(async () => {
          try {
            await ctx.api.deleteMessage(chatId, notice.message_id)
          }
          catch { /* ignore */ }
        }, 10_000)
      }
      catch { /* ignore */ }
    }, timeoutSeconds * 1000)

    pendingVerifications.set(key, {
      chatId,
      userId,
      messageId: challengeMsg.message_id,
      correctAnswer,
      timer,
    })

    return next()
  })

  // Handle button captcha callback
  feature.callbackQuery(captchaCallbackData.filter(), async (ctx) => {
    const data = captchaCallbackData.unpack(ctx.callbackQuery.data)
    const key = makeKey(data.chatId, data.userId)
    const pending = pendingVerifications.get(key)

    if (!pending) {
      await ctx.answerCallbackQuery({ text: 'This verification has expired.' })
      return
    }

    // Only the challenged user can answer
    if (ctx.from.id !== data.userId) {
      await ctx.answerCallbackQuery({ text: 'This verification is not for you.' })
      return
    }

    if (data.answer === pending.correctAnswer) {
      // Correct answer — unrestrict and cleanup
      clearTimeout(pending.timer)
      pendingVerifications.delete(key)

      try {
        await ctx.api.restrictChatMember(data.chatId, data.userId, {
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
      }
      catch { /* ignore */ }

      try {
        await ctx.deleteMessage()
      }
      catch { /* ignore */ }

      await ctx.answerCallbackQuery({ text: 'Verified! Welcome to the group.' })

      const notice = await ctx.api.sendMessage(
        data.chatId,
        `✅ <a href="tg://user?id=${data.userId}">${escapeHtml(ctx.from.first_name)}</a> has been verified.`,
        { parse_mode: 'HTML' },
      )
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(data.chatId, notice.message_id)
        }
        catch { /* ignore */ }
      }, 10_000)
    }
    else {
      await ctx.answerCallbackQuery({ text: 'Wrong answer, try again!' })
    }
  })

  // Handle math captcha — text message answers
  feature.on('message:text', async (ctx, next) => {
    const chatType = ctx.chat?.type
    if (chatType !== 'group' && chatType !== 'supergroup')
      return next()

    const userId = ctx.from?.id
    if (!userId)
      return next()

    const key = makeKey(ctx.chat.id, userId)
    const pending = pendingVerifications.get(key)

    if (!pending)
      return next()

    const config = ctx.session.groupConfig
    if (!config || config.captchaMode !== 'math')
      return next()

    const answer = ctx.message.text.trim()

    // Delete the user's answer message regardless
    try {
      await ctx.deleteMessage()
    }
    catch { /* ignore */ }

    if (answer === pending.correctAnswer) {
      clearTimeout(pending.timer)
      pendingVerifications.delete(key)

      try {
        await ctx.api.restrictChatMember(ctx.chat.id, userId, {
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
      }
      catch { /* ignore */ }

      try {
        await ctx.api.deleteMessage(ctx.chat.id, pending.messageId)
      }
      catch { /* ignore */ }

      const notice = await ctx.reply(
        `✅ <a href="tg://user?id=${userId}">${escapeHtml(ctx.from!.first_name)}</a> has been verified.`,
        { parse_mode: 'HTML' },
      )
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(ctx.chat!.id, notice.message_id)
        }
        catch { /* ignore */ }
      }, 10_000)
    }
    // Wrong answer — just silently delete, user can try again
  })

  // /captcha on|off — toggle captcha
  feature.command('captcha', requirePermission('admin', prisma), logHandle('cmd:captcha'), async (ctx) => {
    const args = ctx.match?.toString().trim().split(/\s+/) ?? []
    const config = ctx.session.groupConfig
    if (!config)
      return

    const subcommand = args[0]?.toLowerCase()

    if (subcommand === 'on') {
      await configRepo.updateConfig(config.groupId, { captchaEnabled: true })
      ctx.session.groupConfig = { ...config, captchaEnabled: true }
      await ctx.reply('✅ CAPTCHA verification enabled for new members.')
    }
    else if (subcommand === 'off') {
      await configRepo.updateConfig(config.groupId, { captchaEnabled: false })
      ctx.session.groupConfig = { ...config, captchaEnabled: false }
      await ctx.reply('✅ CAPTCHA verification disabled.')
    }
    else if (subcommand === 'mode') {
      const mode = args[1]?.toLowerCase()
      if (mode === 'button' || mode === 'math') {
        await configRepo.updateConfig(config.groupId, { captchaMode: mode })
        ctx.session.groupConfig = { ...config, captchaMode: mode }
        await ctx.reply(`✅ CAPTCHA mode set to <b>${mode}</b>.`)
      }
      else {
        await ctx.reply('Usage: /captcha mode button|math\n\n<b>button</b> — Tap the correct emoji\n<b>math</b> — Solve a simple math problem')
      }
    }
    else {
      const status = config.captchaEnabled ? '✅ Enabled' : '❌ Disabled'
      const mode = config.captchaMode || 'button'
      const timeout = config.captchaTimeoutS || 120
      await ctx.reply(
        `🔒 <b>CAPTCHA Verification</b>\n\n`
        + `Status: ${status}\n`
        + `Mode: <b>${mode}</b>\n`
        + `Timeout: <b>${timeout}s</b>\n\n`
        + `Commands:\n`
        + `/captcha on — Enable\n`
        + `/captcha off — Disable\n`
        + `/captcha mode button|math — Set mode`,
      )
    }
  })

  return feature
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
