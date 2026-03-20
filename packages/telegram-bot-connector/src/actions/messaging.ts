import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramBotTransport } from '../sdk/types.js'
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
  sendPollSchema,
} from './schemas.js'

export function registerMessagingActions(registry: ActionRegistry, transport: ITelegramBotTransport): void {
  registry.register('send_message', {
    schema: sendMessageSchema,
    handler: async (params) =>
      transport.sendMessage(params.chatId, params.text, {
        parseMode: params.parseMode,
        disableNotification: params.disableNotification,
        replyToMessageId: params.replyToMessageId,
      }),
  })

  registry.register('send_photo', {
    schema: sendPhotoSchema,
    handler: async (params) =>
      transport.sendPhoto(params.chatId, params.photoUrl, {
        caption: params.caption,
        parseMode: params.parseMode,
      }),
  })

  registry.register('send_video', {
    schema: sendVideoSchema,
    handler: async (params) =>
      transport.sendVideo(params.chatId, params.videoUrl, {
        caption: params.caption,
        parseMode: params.parseMode,
      }),
  })

  registry.register('send_document', {
    schema: sendDocumentSchema,
    handler: async (params) =>
      transport.sendDocument(params.chatId, params.documentUrl, {
        caption: params.caption,
        parseMode: params.parseMode,
      }),
  })

  registry.register('send_audio', {
    schema: sendAudioSchema,
    handler: async (params) =>
      transport.sendAudio(params.chatId, params.audioUrl, {
        caption: params.caption,
        parseMode: params.parseMode,
      }),
  })

  registry.register('send_voice', {
    schema: sendVoiceSchema,
    handler: async (params) =>
      transport.sendVoice(params.chatId, params.voiceUrl, {
        caption: params.caption,
      }),
  })

  registry.register('send_sticker', {
    schema: sendStickerSchema,
    handler: async (params) => transport.sendSticker(params.chatId, params.sticker),
  })

  registry.register('send_location', {
    schema: sendLocationSchema,
    handler: async (params) => transport.sendLocation(params.chatId, params.latitude, params.longitude),
  })

  registry.register('send_contact', {
    schema: sendContactSchema,
    handler: async (params) =>
      transport.sendContact(params.chatId, params.phoneNumber, params.firstName, params.lastName),
  })

  registry.register('send_poll', {
    schema: sendPollSchema,
    handler: async (params) =>
      transport.sendPoll(params.chatId, params.question, params.options, {
        isAnonymous: params.isAnonymous,
        allowsMultipleAnswers: params.allowsMultipleAnswers,
        pollType: params.pollType,
      }),
  })
}
