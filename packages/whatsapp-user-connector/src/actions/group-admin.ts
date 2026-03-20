import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IWhatsAppTransport } from '../sdk/types.js'
import { kickUserSchema, promoteUserSchema, demoteUserSchema, getGroupInfoSchema, getInviteLinkSchema } from './schemas.js'

export function registerGroupAdminActions(registry: ActionRegistry, transport: IWhatsAppTransport): void {
  registry.register('kick_user', {
    schema: kickUserSchema,
    handler: async (params) => transport.kickParticipant(params.chatId, params.userId),
  })

  registry.register('promote_user', {
    schema: promoteUserSchema,
    handler: async (params) => transport.promoteParticipant(params.chatId, params.userId),
  })

  registry.register('demote_user', {
    schema: demoteUserSchema,
    handler: async (params) => transport.demoteParticipant(params.chatId, params.userId),
  })

  registry.register('get_group_info', {
    schema: getGroupInfoSchema,
    handler: async (params) => transport.getGroupMetadata(params.chatId),
  })

  registry.register('get_invite_link', {
    schema: getInviteLinkSchema,
    handler: async (params) => transport.getGroupInviteLink(params.chatId),
  })
}
