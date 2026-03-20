import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IWhatsAppTransport } from '../sdk/types.js'
import {
  sendMessageSchema,
  sendPhotoSchema,
  sendVideoSchema,
  sendDocumentSchema,
  sendAudioSchema,
  sendVoiceSchema,
  sendStickerSchema,
  sendLocationSchema,
  sendContactSchema,
} from './schemas.js'

export function registerMessagingActions(registry: ActionRegistry, transport: IWhatsAppTransport): void {
  registry.register('send_message', {
    schema: sendMessageSchema,
    handler: async (params) => transport.sendMessage(params.chatId, params.text),
  })

  registry.register('send_photo', {
    schema: sendPhotoSchema,
    handler: async (params) => transport.sendMedia(params.chatId, 'image', params.photoUrl, { caption: params.caption }),
  })

  registry.register('send_video', {
    schema: sendVideoSchema,
    handler: async (params) => transport.sendMedia(params.chatId, 'video', params.videoUrl, { caption: params.caption }),
  })

  registry.register('send_document', {
    schema: sendDocumentSchema,
    handler: async (params) =>
      transport.sendDocument(params.chatId, params.documentUrl, {
        fileName: params.fileName,
        caption: params.caption,
      }),
  })

  registry.register('send_audio', {
    schema: sendAudioSchema,
    handler: async (params) => transport.sendMedia(params.chatId, 'audio', params.audioUrl),
  })

  registry.register('send_voice', {
    schema: sendVoiceSchema,
    handler: async (params) => transport.sendMedia(params.chatId, 'audio', params.voiceUrl, { ptt: true }),
  })

  registry.register('send_sticker', {
    schema: sendStickerSchema,
    handler: async (params) => transport.sendMedia(params.chatId, 'sticker', params.sticker),
  })

  registry.register('send_location', {
    schema: sendLocationSchema,
    handler: async (params) => transport.sendLocation(params.chatId, params.latitude, params.longitude),
  })

  registry.register('send_contact', {
    schema: sendContactSchema,
    handler: async (params) =>
      transport.sendContact(params.chatId, {
        fullName: params.fullName,
        phoneNumber: params.phoneNumber,
        organization: params.organization,
      }),
  })
}
