import type { WhatsAppMessageResult } from '../../transport/IWhatsAppTransport.js'
import type { IWhatsAppTransport } from '../../transport/IWhatsAppTransport.js'
import type {
  SendAudioPayload,
  SendDocumentPayload,
  SendPhotoPayload,
  SendStickerPayload,
  SendVideoPayload,
  SendVoicePayload,
} from '../types.js'

export async function executeSendPhoto(
  transport: IWhatsAppTransport,
  payload: SendPhotoPayload,
): Promise<WhatsAppMessageResult> {
  return transport.sendMedia(payload.jid, 'image', payload.url, {
    caption: payload.caption,
    ...payload.options,
  })
}

export async function executeSendVideo(
  transport: IWhatsAppTransport,
  payload: SendVideoPayload,
): Promise<WhatsAppMessageResult> {
  return transport.sendMedia(payload.jid, 'video', payload.url, {
    caption: payload.caption,
    ...payload.options,
  })
}

export async function executeSendAudio(
  transport: IWhatsAppTransport,
  payload: SendAudioPayload,
): Promise<WhatsAppMessageResult> {
  return transport.sendMedia(payload.jid, 'audio', payload.url, payload.options)
}

export async function executeSendVoice(
  transport: IWhatsAppTransport,
  payload: SendVoicePayload,
): Promise<WhatsAppMessageResult> {
  return transport.sendMedia(payload.jid, 'audio', payload.url, { ptt: true })
}

export async function executeSendSticker(
  transport: IWhatsAppTransport,
  payload: SendStickerPayload,
): Promise<WhatsAppMessageResult> {
  return transport.sendMedia(payload.jid, 'sticker', payload.url)
}

export async function executeSendDocument(
  transport: IWhatsAppTransport,
  payload: SendDocumentPayload,
): Promise<WhatsAppMessageResult> {
  return transport.sendDocument(payload.jid, payload.url, {
    fileName: payload.fileName,
    mimetype: payload.mimetype,
    caption: payload.caption,
  })
}
