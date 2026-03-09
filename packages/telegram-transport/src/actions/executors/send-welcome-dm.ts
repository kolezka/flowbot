import type { Logger } from '../../logger.js'
import type { ITelegramTransport, MessageResult } from '../../transport/ITelegramTransport.js'
import type { SendWelcomeDmPayload } from '../types.js'

/**
 * Send a welcome DM to a new group member as part of the member→customer pipeline.
 *
 * TODO: Trigger.dev integration — this action will be dispatched by a Trigger.dev
 * job instead of being called directly. The job will handle scheduling, rate
 * limiting, and retry logic. For now this is a placeholder that delegates to
 * the transport layer like a normal SEND_MESSAGE.
 */
export async function executeSendWelcomeDm(
  transport: ITelegramTransport,
  payload: SendWelcomeDmPayload,
  logger: Logger,
): Promise<MessageResult> {
  // TODO: Trigger.dev will handle this action. For now, send via transport directly.
  logger.info({ peer: payload.peer, deeplink: payload.deeplink }, 'Sending welcome DM')

  const text = payload.deeplink
    ? `${payload.text}\n\n${payload.deeplink}`
    : payload.text

  const result = await transport.sendMessage(payload.peer, text, {
    parseMode: 'html',
  })

  logger.info({ peer: payload.peer, messageId: result.id }, 'Welcome DM sent')

  return result
}
