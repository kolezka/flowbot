import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IDiscordBotTransport } from '../sdk/types.js'
import {
  sendMessageSchema,
  sendEmbedSchema,
  sendDMSchema,
  editMessageSchema,
  deleteMessageSchema,
  pinMessageSchema,
  unpinMessageSchema,
  addReactionSchema,
  removeReactionSchema,
  sendThreadMessageSchema,
} from './schemas.js'

export function registerMessagingActions(registry: ActionRegistry, transport: IDiscordBotTransport): void {
  registry.register('discord_send_message', {
    schema: sendMessageSchema,
    handler: async (params) =>
      transport.sendMessage(params.channelId, params.content, {
        replyToMessageId: params.replyToMessageId,
        tts: params.tts,
        suppressEmbeds: params.suppressEmbeds,
      }),
  })

  registry.register('discord_send_embed', {
    schema: sendEmbedSchema,
    handler: async (params) =>
      transport.sendEmbed(params.channelId, params.embed, params.content),
  })

  registry.register('discord_send_dm', {
    schema: sendDMSchema,
    handler: async (params) =>
      transport.sendDM(params.userId, params.content, { tts: params.tts }),
  })

  registry.register('discord_edit_message', {
    schema: editMessageSchema,
    handler: async (params) =>
      transport.editMessage(params.channelId, params.messageId, params.content),
  })

  registry.register('discord_delete_message', {
    schema: deleteMessageSchema,
    handler: async (params) =>
      transport.deleteMessage(params.channelId, params.messageId),
  })

  registry.register('discord_pin_message', {
    schema: pinMessageSchema,
    handler: async (params) =>
      transport.pinMessage(params.channelId, params.messageId),
  })

  registry.register('discord_unpin_message', {
    schema: unpinMessageSchema,
    handler: async (params) =>
      transport.unpinMessage(params.channelId, params.messageId),
  })

  registry.register('discord_add_reaction', {
    schema: addReactionSchema,
    handler: async (params) =>
      transport.addReaction(params.channelId, params.messageId, params.emoji),
  })

  registry.register('discord_remove_reaction', {
    schema: removeReactionSchema,
    handler: async (params) =>
      transport.removeReaction(params.channelId, params.messageId, params.emoji),
  })

  registry.register('discord_send_thread_message', {
    schema: sendThreadMessageSchema,
    handler: async (params) =>
      transport.sendThreadMessage(params.threadId, params.content),
  })
}
