import type { Logger } from '../../logger.js'
import type { ITelegramTransport, MessageResult } from '../../transport/ITelegramTransport.js'
import type { ForwardMessagePayload } from '../types.js'

import * as v from 'valibot'

import { ForwardMessagePayloadSchema } from '../types.js'

export async function executeForwardMessage(
  transport: ITelegramTransport,
  payload: ForwardMessagePayload,
  logger: Logger,
): Promise<MessageResult[]> {
  const validated = v.parse(ForwardMessagePayloadSchema, payload)

  logger.info(
    { fromPeer: validated.fromPeer, toPeer: validated.toPeer, count: validated.messageIds.length },
    'Forwarding messages',
  )
  logger.debug({ payload: validated }, 'Forward message payload')

  const results = await transport.forwardMessage(
    validated.fromPeer,
    validated.toPeer,
    validated.messageIds,
    {
      silent: validated.silent,
      dropAuthor: validated.dropAuthor,
    },
  )

  logger.info(
    { fromPeer: validated.fromPeer, toPeer: validated.toPeer, forwarded: results.length },
    'Messages forwarded successfully',
  )

  return results
}
