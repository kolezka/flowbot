import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramBotTransport } from '../sdk/types.js'
import {
  editMessageSchema,
  deleteMessageSchema,
  pinMessageSchema,
  unpinMessageSchema,
  replyToMessageSchema,
} from './schemas.js'

export function registerMessageMgmtActions(registry: ActionRegistry, transport: ITelegramBotTransport): void {
  registry.register('edit_message', {
    schema: editMessageSchema,
    handler: async (params) =>
      transport.editMessage(params.chatId, params.messageId, params.text, {
        parseMode: params.parseMode,
      }),
  })

  registry.register('delete_message', {
    schema: deleteMessageSchema,
    handler: async (params) => transport.deleteMessage(params.chatId, params.messageId),
  })

  registry.register('pin_message', {
    schema: pinMessageSchema,
    handler: async (params) => transport.pinMessage(params.chatId, params.messageId, params.disableNotification),
  })

  registry.register('unpin_message', {
    schema: unpinMessageSchema,
    handler: async (params) => transport.unpinMessage(params.chatId, params.messageId),
  })

  registry.register('reply_to_message', {
    schema: replyToMessageSchema,
    handler: async (params) =>
      transport.replyToMessage(params.chatId, params.messageId, params.text, {
        parseMode: params.parseMode,
        disableNotification: params.disableNotification,
      }),
  })
}
