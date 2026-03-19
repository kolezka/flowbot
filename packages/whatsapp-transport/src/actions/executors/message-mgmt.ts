import type { WhatsAppMessageResult } from '../../transport/IWhatsAppTransport.js'
import type { IWhatsAppTransport } from '../../transport/IWhatsAppTransport.js'
import type {
  DeleteMessagePayload,
  EditMessagePayload,
  ForwardMessagePayload,
  ReadHistoryPayload,
} from '../types.js'

export async function executeForward(
  transport: IWhatsAppTransport,
  payload: ForwardMessagePayload,
): Promise<WhatsAppMessageResult> {
  return transport.forwardMessage(payload.fromJid, payload.toJid, payload.key)
}

export async function executeEdit(
  transport: IWhatsAppTransport,
  payload: EditMessagePayload,
): Promise<WhatsAppMessageResult> {
  return transport.editMessage(payload.jid, payload.key, payload.text)
}

export async function executeDelete(
  transport: IWhatsAppTransport,
  payload: DeleteMessagePayload,
): Promise<boolean> {
  return transport.deleteMessage(payload.jid, payload.key)
}

export async function executeReadHistory(
  transport: IWhatsAppTransport,
  payload: ReadHistoryPayload,
): Promise<void> {
  return transport.readHistory(payload.jid, payload.count)
}
