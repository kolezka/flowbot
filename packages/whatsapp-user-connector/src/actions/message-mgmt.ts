import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IWhatsAppTransport } from '../sdk/types.js'
import { forwardMessageSchema, editMessageSchema, deleteMessageSchema, readHistorySchema } from './schemas.js'

export function registerMessageMgmtActions(registry: ActionRegistry, transport: IWhatsAppTransport): void {
  registry.register('forward_message', {
    schema: forwardMessageSchema,
    handler: async (params) => transport.forwardMessage(params.fromChatId, params.toChatId, params.messageKey),
  })

  registry.register('edit_message', {
    schema: editMessageSchema,
    handler: async (params) => transport.editMessage(params.chatId, params.messageKey, params.text),
  })

  registry.register('delete_message', {
    schema: deleteMessageSchema,
    handler: async (params) => transport.deleteMessage(params.chatId, params.messageKey),
  })

  registry.register('read_history', {
    schema: readHistorySchema,
    handler: async (params) => transport.readHistory(params.chatId, params.count),
  })
}
