import type { Logger } from '../logger.js'
import type { ITelegramTransport, MessageResult } from '../transport/ITelegramTransport.js'
import type { SendMessagePayload } from './types.js'

import * as v from 'valibot'

import { SendMessagePayloadSchema } from './types.js'

export async function executeSendMessage(
  transport: ITelegramTransport,
  payload: SendMessagePayload,
  logger: Logger,
): Promise<MessageResult> {
  const validated = v.parse(SendMessagePayloadSchema, payload)

  logger.info({ peer: validated.peer }, 'Sending message')
  logger.debug({ payload: validated }, 'Send message payload')

  const result = await transport.sendMessage(validated.peer, validated.text, {
    parseMode: validated.parseMode as 'html' | 'markdown' | undefined,
    replyToMsgId: validated.replyToMsgId,
    silent: validated.silent,
  })

  logger.info({ peer: validated.peer, messageId: result.id }, 'Message sent successfully')

  return result
}
