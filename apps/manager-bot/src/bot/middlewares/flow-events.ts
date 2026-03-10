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
    // Forward message events (text messages in groups)
    if (ctx.message?.text && ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
      const chatId = BigInt(ctx.chat.id)
      const userId = BigInt(ctx.from!.id)

      // Fire-and-forget: don't block the middleware chain
      forwarder.onMessage(chatId, userId, ctx.message.text, ctx.message.message_id).catch((error) => {
        ctx.logger.error({ error }, 'Flow event forwarding failed for message')
      })
    }

    // Forward user join events (chat_member updates)
    if (ctx.chatMember) {
      const update = ctx.chatMember
      const oldStatus = update.old_chat_member.status
      const newStatus = update.new_chat_member.status

      const wasOut = oldStatus === 'left' || oldStatus === 'kicked'
      const isIn = newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator'

      if (wasOut && isIn && !update.new_chat_member.user.is_bot) {
        const chatId = BigInt(ctx.chat!.id)
        const userId = BigInt(update.new_chat_member.user.id)
        const username = update.new_chat_member.user.username

        // Fire-and-forget: don't block the middleware chain
        forwarder.onUserJoin(chatId, userId, username).catch((error) => {
          ctx.logger.error({ error }, 'Flow event forwarding failed for user join')
        })
      }
    }

    return next()
  }
}
