import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramBotTransport } from '../sdk/types.js'
import {
  getChatSchema,
  getChatMemberSchema,
  getChatMembersCountSchema,
  setChatTitleSchema,
  setChatDescriptionSchema,
} from './schemas.js'

export function registerChatActions(registry: ActionRegistry, transport: ITelegramBotTransport): void {
  registry.register('get_chat', {
    schema: getChatSchema,
    handler: async (params) => transport.getChat(params.chatId),
  })

  registry.register('get_chat_member', {
    schema: getChatMemberSchema,
    handler: async (params) => transport.getChatMember(params.chatId, params.userId),
  })

  registry.register('get_chat_members_count', {
    schema: getChatMembersCountSchema,
    handler: async (params) => transport.getChatMembersCount(params.chatId),
  })

  registry.register('set_chat_title', {
    schema: setChatTitleSchema,
    handler: async (params) => transport.setChatTitle(params.chatId, params.title),
  })

  registry.register('set_chat_description', {
    schema: setChatDescriptionSchema,
    handler: async (params) => transport.setChatDescription(params.chatId, params.description),
  })
}
