import type { Middleware } from 'grammy'
import type { Context } from '../context.js'
import type { FlowEventForwarder } from '../../services/flow-events.js'

/**
 * Middleware that forwards incoming bot events to the flow engine.
 * Runs early in the middleware chain and does not block the pipeline —
 * flow forwarding happens asynchronously (fire-and-forget).
 */
export function flowEvents(forwarder: FlowEventForwarder): Middleware<Context> {
  return async (ctx, next) => {
    const isGroupChat = ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')

    // Forward text message events (groups/supergroups)
    if (ctx.message?.text && ctx.chat && isGroupChat) {
      const chatId = BigInt(ctx.chat.id)
      const userId = BigInt(ctx.from!.id)

      // Detect if it's a bot command (starts with /)
      if (ctx.message.text.startsWith('/')) {
        const parts = ctx.message.text.split(/\s+/)
        const command = parts[0]!.replace(/@\w+$/, '') // strip @botname
        const args = parts.slice(1).join(' ')

        forwarder.onCommandReceived(chatId, userId, command, args, ctx.message.message_id).catch((error) => {
          ctx.logger.error({ error }, 'Flow event forwarding failed for command')
        })
      } else {
        // Regular text message
        forwarder.onMessage(chatId, userId, ctx.message.text, ctx.message.message_id).catch((error) => {
          ctx.logger.error({ error }, 'Flow event forwarding failed for message')
        })
      }
    }

    // Forward message events with media (photo, video, document, etc.)
    if (ctx.message && ctx.chat && isGroupChat && !ctx.message.text) {
      const chatId = BigInt(ctx.chat.id)
      const userId = BigInt(ctx.from!.id)
      let messageType = 'unknown'
      let hasMedia = false

      if (ctx.message.photo) { messageType = 'photo'; hasMedia = true }
      else if (ctx.message.video) { messageType = 'video'; hasMedia = true }
      else if (ctx.message.document) { messageType = 'document'; hasMedia = true }
      else if (ctx.message.sticker) { messageType = 'sticker'; hasMedia = true }
      else if (ctx.message.voice) { messageType = 'voice'; hasMedia = true }
      else if (ctx.message.audio) { messageType = 'audio'; hasMedia = true }
      else if (ctx.message.animation) { messageType = 'animation'; hasMedia = true }
      else if (ctx.message.location) { messageType = 'location'; hasMedia = false }
      else if (ctx.message.contact) { messageType = 'contact'; hasMedia = false }
      else if (ctx.message.poll) { messageType = 'poll'; hasMedia = false }

      if (messageType !== 'unknown') {
        forwarder.onMessage(
          chatId,
          userId,
          ctx.message.caption ?? '',
          ctx.message.message_id,
          messageType,
          hasMedia,
        ).catch((error) => {
          ctx.logger.error({ error }, 'Flow event forwarding failed for media message')
        })
      }
    }

    // Forward edited message events
    if (ctx.editedMessage && ctx.chat && isGroupChat) {
      const chatId = BigInt(ctx.chat.id)
      const userId = BigInt(ctx.from!.id)
      const text = ctx.editedMessage.text ?? ctx.editedMessage.caption ?? ''

      forwarder.onMessageEdited(chatId, userId, text, ctx.editedMessage.message_id).catch((error) => {
        ctx.logger.error({ error }, 'Flow event forwarding failed for edited message')
      })
    }

    // Forward callback query events (inline button clicks)
    if (ctx.callbackQuery) {
      const userId = BigInt(ctx.from!.id)
      const chatId = ctx.callbackQuery.message?.chat
        ? BigInt(ctx.callbackQuery.message.chat.id)
        : undefined

      forwarder.onCallbackQuery(
        userId,
        ctx.callbackQuery.id,
        ctx.callbackQuery.data ?? '',
        chatId,
        ctx.callbackQuery.message?.message_id,
      ).catch((error) => {
        ctx.logger.error({ error }, 'Flow event forwarding failed for callback query')
      })
    }

    // Forward chat member updates (join, leave, status changes)
    if (ctx.chatMember) {
      const update = ctx.chatMember
      const oldStatus = update.old_chat_member.status
      const newStatus = update.new_chat_member.status

      const wasOut = oldStatus === 'left' || oldStatus === 'kicked'
      const isIn = newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator'
      const wasIn = oldStatus === 'member' || oldStatus === 'administrator' || oldStatus === 'creator'
      const isOut = newStatus === 'left' || newStatus === 'kicked'

      const chatId = BigInt(ctx.chat!.id)
      const userId = BigInt(update.new_chat_member.user.id)
      const username = update.new_chat_member.user.username

      // User joins
      if (wasOut && isIn && !update.new_chat_member.user.is_bot) {
        forwarder.onUserJoin(chatId, userId, username).catch((error) => {
          ctx.logger.error({ error }, 'Flow event forwarding failed for user join')
        })
      }

      // User leaves / gets kicked
      if (wasIn && isOut && !update.new_chat_member.user.is_bot) {
        forwarder.onUserLeave(chatId, userId, username, newStatus === 'kicked').catch((error) => {
          ctx.logger.error({ error }, 'Flow event forwarding failed for user leave')
        })
      }

      // General chat member status change (promoted, restricted, etc.)
      if (oldStatus !== newStatus && !update.new_chat_member.user.is_bot) {
        forwarder.onChatMemberUpdated(chatId, userId, oldStatus, newStatus, username).catch((error) => {
          ctx.logger.error({ error }, 'Flow event forwarding failed for chat member update')
        })
      }
    }

    // Forward poll answer events
    if ((ctx as any).poll_answer) {
      const pollAnswer = (ctx as any).poll_answer
      const userId = BigInt(pollAnswer.user.id)

      forwarder.onPollAnswer(
        userId,
        pollAnswer.poll_id,
        pollAnswer.option_ids ?? [],
      ).catch((error) => {
        ctx.logger.error({ error }, 'Flow event forwarding failed for poll answer')
      })
    }

    // Forward inline query events
    if (ctx.inlineQuery) {
      const userId = BigInt(ctx.from!.id)

      forwarder.onInlineQuery(
        userId,
        ctx.inlineQuery.id,
        ctx.inlineQuery.query,
        ctx.inlineQuery.offset,
      ).catch((error) => {
        ctx.logger.error({ error }, 'Flow event forwarding failed for inline query')
      })
    }

    // Forward bot's own chat member status changes
    if (ctx.myChatMember) {
      const update = ctx.myChatMember
      const chatId = BigInt(ctx.chat!.id)
      const oldStatus = update.old_chat_member.status
      const newStatus = update.new_chat_member.status

      if (oldStatus !== newStatus) {
        forwarder.onMyChatMemberUpdated(chatId, oldStatus, newStatus).catch((error) => {
          ctx.logger.error({ error }, 'Flow event forwarding failed for my_chat_member')
        })
      }
    }

    // Forward chat title change events
    if (ctx.message?.new_chat_title && ctx.chat && isGroupChat) {
      const chatId = BigInt(ctx.chat.id)
      const userId = BigInt(ctx.from!.id)

      forwarder.onNewChatTitle(chatId, userId, ctx.message.new_chat_title).catch((error) => {
        ctx.logger.error({ error }, 'Flow event forwarding failed for new chat title')
      })
    }

    // Forward chat photo change events
    if (ctx.message?.new_chat_photo && ctx.chat && isGroupChat) {
      const chatId = BigInt(ctx.chat.id)
      const userId = BigInt(ctx.from!.id)

      forwarder.onNewChatPhoto(chatId, userId).catch((error) => {
        ctx.logger.error({ error }, 'Flow event forwarding failed for new chat photo')
      })
    }

    // Forward chat join request events (user requests to join)
    if ((ctx as any).chatJoinRequest) {
      const request = (ctx as any).chatJoinRequest
      const chatId = BigInt(request.chat.id)
      const userId = BigInt(request.from.id)
      const username = request.from.username

      forwarder.onChatJoinRequest(chatId, userId, username).catch((error) => {
        ctx.logger.error({ error }, 'Flow event forwarding failed for chat join request')
      })
    }

    return next()
  }
}
