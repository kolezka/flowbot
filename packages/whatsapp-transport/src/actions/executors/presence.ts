import type { IWhatsAppTransport } from '../../transport/IWhatsAppTransport.js'
import type { SendPresencePayload } from '../types.js'

export async function executeSendPresence(
  transport: IWhatsAppTransport,
  payload: SendPresencePayload,
): Promise<void> {
  return transport.sendPresenceUpdate(payload.jid, payload.presence)
}
