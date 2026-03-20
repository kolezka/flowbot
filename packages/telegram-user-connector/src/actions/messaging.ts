import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramUserTransport } from '../sdk/types.js'
import {
  sendMessageSchema,
  sendPhotoSchema,
  sendVideoSchema,
  sendDocumentSchema,
  sendStickerSchema,
  sendVoiceSchema,
  sendAudioSchema,
  sendAnimationSchema,
  sendLocationSchema,
  sendContactSchema,
  sendVenueSchema,
  sendDiceSchema,
  forwardMessageSchema,
  sendMediaGroupSchema,
  resolveUsernameSchema,
} from './schemas.js'

export function registerMessagingActions(registry: ActionRegistry, transport: ITelegramUserTransport): void {
  registry.register('send_message', {
    schema: sendMessageSchema,
    handler: async (params) => transport.sendMessage(params.peer, params.text, params.options),
  })

  registry.register('send_photo', {
    schema: sendPhotoSchema,
    handler: async (params) => transport.sendPhoto(params.peer, params.photoUrl, params.options),
  })

  registry.register('send_video', {
    schema: sendVideoSchema,
    handler: async (params) => transport.sendVideo(params.peer, params.videoUrl, params.options),
  })

  registry.register('send_document', {
    schema: sendDocumentSchema,
    handler: async (params) => transport.sendDocument(params.peer, params.documentUrl, params.options),
  })

  registry.register('send_sticker', {
    schema: sendStickerSchema,
    handler: async (params) => transport.sendSticker(params.peer, params.sticker, { silent: params.silent }),
  })

  registry.register('send_voice', {
    schema: sendVoiceSchema,
    handler: async (params) => transport.sendVoice(params.peer, params.voiceUrl, params.options),
  })

  registry.register('send_audio', {
    schema: sendAudioSchema,
    handler: async (params) => transport.sendAudio(params.peer, params.audioUrl, params.options),
  })

  registry.register('send_animation', {
    schema: sendAnimationSchema,
    handler: async (params) => transport.sendAnimation(params.peer, params.animationUrl, params.options),
  })

  registry.register('send_location', {
    schema: sendLocationSchema,
    handler: async (params) =>
      transport.sendLocation(params.peer, params.latitude, params.longitude, {
        livePeriod: params.livePeriod,
        silent: params.silent,
      }),
  })

  registry.register('send_contact', {
    schema: sendContactSchema,
    handler: async (params) =>
      transport.sendContact(params.peer, params.phoneNumber, params.firstName, params.lastName),
  })

  registry.register('send_venue', {
    schema: sendVenueSchema,
    handler: async (params) =>
      transport.sendVenue(params.peer, params.latitude, params.longitude, params.title, params.address),
  })

  registry.register('send_dice', {
    schema: sendDiceSchema,
    handler: async (params) => transport.sendDice(params.peer, params.emoji),
  })

  registry.register('forward_message', {
    schema: forwardMessageSchema,
    handler: async (params) =>
      transport.forwardMessage(params.fromPeer, params.toPeer, params.messageIds, {
        silent: params.silent,
        dropAuthor: params.dropAuthor,
      }),
  })

  registry.register('send_media_group', {
    schema: sendMediaGroupSchema,
    handler: async (params) => transport.sendMediaGroup(params.peer, params.media),
  })

  registry.register('resolve_username', {
    schema: resolveUsernameSchema,
    handler: async (params) => transport.resolveUsername(params.username),
  })
}
