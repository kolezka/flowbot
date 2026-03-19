import type { WhatsAppMessageResult } from '../../transport/IWhatsAppTransport.js'
import type { IWhatsAppTransport } from '../../transport/IWhatsAppTransport.js'
import type { SendMessagePayload } from '../types.js'

export async function executeSendMessage(
  transport: IWhatsAppTransport,
  payload: SendMessagePayload,
): Promise<WhatsAppMessageResult> {
  return transport.sendMessage(payload.jid, payload.text, payload.options)
}
