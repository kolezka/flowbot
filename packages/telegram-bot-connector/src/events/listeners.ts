import type { EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import type { Bot, Context } from 'grammy'
import { mapMessageEvent, mapMemberJoinEvent, mapMemberLeaveEvent, mapCallbackQueryEvent } from './mapper.js'

export function registerEventListeners(
  bot: Bot<Context>,
  forwarder: EventForwarder,
  botInstanceId: string,
  logger: Logger,
): void {
  // --- Incoming messages ---
  bot.on('message', async (ctx) => {
    try {
      const event = mapMessageEvent(ctx, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward message event')
    }
  })

  // --- Chat member updates: join and leave ---
  bot.on('chat_member', async (ctx) => {
    try {
      const joinEvent = mapMemberJoinEvent(ctx, botInstanceId)
      if (joinEvent) {
        await forwarder.send(joinEvent)
      }

      const leaveEvent = mapMemberLeaveEvent(ctx, botInstanceId)
      if (leaveEvent) {
        await forwarder.send(leaveEvent)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward chat_member event')
    }
  })

  // --- Callback queries ---
  bot.on('callback_query', async (ctx) => {
    try {
      const event = mapCallbackQueryEvent(ctx, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward callback_query event')
    }
  })

  logger.info('Telegram event listeners registered')
}
