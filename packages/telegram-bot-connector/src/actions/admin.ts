import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramBotTransport } from '../sdk/types.js'
import { banUserSchema, unbanUserSchema, restrictUserSchema, promoteUserSchema } from './schemas.js'

export function registerAdminActions(registry: ActionRegistry, transport: ITelegramBotTransport): void {
  registry.register('ban_user', {
    schema: banUserSchema,
    handler: async (params) => transport.banUser(params.chatId, params.userId),
  })

  registry.register('unban_user', {
    schema: unbanUserSchema,
    handler: async (params) => transport.unbanUser(params.chatId, params.userId),
  })

  registry.register('restrict_user', {
    schema: restrictUserSchema,
    handler: async (params) =>
      transport.restrictUser(params.chatId, params.userId, {
        canSendMessages: params.canSendMessages,
        canSendOther: params.canSendOther,
        canAddWebPagePreviews: params.canAddWebPagePreviews,
        canChangeInfo: params.canChangeInfo,
        canInviteUsers: params.canInviteUsers,
        canPinMessages: params.canPinMessages,
        untilDate: params.untilDate,
      }),
  })

  registry.register('promote_user', {
    schema: promoteUserSchema,
    handler: async (params) =>
      transport.promoteUser(params.chatId, params.userId, {
        canManageChat: params.canManageChat,
        canDeleteMessages: params.canDeleteMessages,
        canManageVideoChats: params.canManageVideoChats,
        canRestrictMembers: params.canRestrictMembers,
        canPromoteMembers: params.canPromoteMembers,
        canChangeInfo: params.canChangeInfo,
        canInviteUsers: params.canInviteUsers,
        canPinMessages: params.canPinMessages,
      }),
  })
}
