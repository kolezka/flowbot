import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramUserTransport } from '../sdk/types.js'
import {
  editMessageSchema,
  deleteMessageSchema,
  pinMessageSchema,
  unpinMessageSchema,
  copyMessageSchema,
  banUserSchema,
  restrictUserSchema,
  promoteUserSchema,
  setChatTitleSchema,
  setChatDescriptionSchema,
  exportInviteLinkSchema,
  getChatMemberSchema,
  leaveChatSchema,
  createPollSchema,
  createForumTopicSchema,
} from './schemas.js'

export function registerUserActions(registry: ActionRegistry, transport: ITelegramUserTransport): void {
  // --- Message management ---
  registry.register('edit_message', {
    schema: editMessageSchema,
    handler: async (params) => transport.editMessage(params.peer, params.messageId, params.text, params.options),
  })

  registry.register('delete_message', {
    schema: deleteMessageSchema,
    handler: async (params) => transport.deleteMessages(params.peer, params.messageIds),
  })

  registry.register('pin_message', {
    schema: pinMessageSchema,
    handler: async (params) => transport.pinMessage(params.peer, params.messageId, params.silent),
  })

  registry.register('unpin_message', {
    schema: unpinMessageSchema,
    handler: async (params) => transport.unpinMessage(params.peer, params.messageId),
  })

  registry.register('copy_message', {
    schema: copyMessageSchema,
    handler: async (params) => transport.copyMessage(params.fromPeer, params.toPeer, params.messageId),
  })

  // --- User management ---
  registry.register('ban_user', {
    schema: banUserSchema,
    handler: async (params) => transport.banUser(params.peer, params.userId),
  })

  registry.register('restrict_user', {
    schema: restrictUserSchema,
    handler: async (params) => transport.restrictUser(params.peer, params.userId, params.permissions, params.untilDate),
  })

  registry.register('promote_user', {
    schema: promoteUserSchema,
    handler: async (params) => transport.promoteUser(params.peer, params.userId, params.privileges),
  })

  // --- Chat management ---
  registry.register('set_chat_title', {
    schema: setChatTitleSchema,
    handler: async (params) => transport.setChatTitle(params.peer, params.title),
  })

  registry.register('set_chat_description', {
    schema: setChatDescriptionSchema,
    handler: async (params) => transport.setChatDescription(params.peer, params.description),
  })

  registry.register('export_invite_link', {
    schema: exportInviteLinkSchema,
    handler: async (params) => transport.exportInviteLink(params.peer),
  })

  registry.register('get_chat_member', {
    schema: getChatMemberSchema,
    handler: async (params) => transport.getChatMember(params.peer, params.userId),
  })

  registry.register('leave_chat', {
    schema: leaveChatSchema,
    handler: async (params) => transport.leaveChat(params.peer),
  })

  // --- Interactive ---
  registry.register('create_poll', {
    schema: createPollSchema,
    handler: async (params) =>
      transport.createPoll(params.peer, params.question, params.answers, {
        isAnonymous: params.isAnonymous,
        multipleChoice: params.multipleChoice,
      }),
  })

  // --- Forum ---
  registry.register('create_forum_topic', {
    schema: createForumTopicSchema,
    handler: async (params) =>
      transport.createForumTopic(params.peer, params.name, {
        iconColor: params.iconColor,
        iconEmojiId: params.iconEmojiId,
      }),
  })
}
