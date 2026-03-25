/**
 * Flow engine user_* actions.
 *
 * These are registered with the `user_` prefix so the flow engine's dispatcher
 * can route them through the pool's POST /execute endpoint.
 * Actions that map directly to transport methods delegate to them.
 * Actions that need raw mtcute access use transport.getClient().
 */

import * as v from 'valibot'
import type { TelegramClient } from '@mtcute/node'
import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramUserTransport } from '../sdk/types.js'

function getMtcuteClient(transport: ITelegramUserTransport): TelegramClient {
  return transport.getClient() as TelegramClient
}

export function registerFlowActions(registry: ActionRegistry, transport: ITelegramUserTransport): void {
  // --- Read Operations (raw mtcute) ---

  registry.register('user_get_chat_history', {
    schema: v.object({
      chatId: v.string(),
      limit: v.optional(v.number(), 50),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      return client.getHistory(params.chatId, { limit: params.limit })
    },
  })

  registry.register('user_search_messages', {
    schema: v.object({
      chatId: v.string(),
      query: v.optional(v.string(), ''),
      limit: v.optional(v.number(), 50),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      return client.searchMessages({
        chatId: params.chatId,
        query: params.query,
        limit: params.limit,
      })
    },
  })

  registry.register('user_get_all_members', {
    schema: v.object({
      chatId: v.string(),
      limit: v.optional(v.number(), 200),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      return client.getChatMembers(params.chatId, { limit: params.limit })
    },
  })

  registry.register('user_get_chat_info', {
    schema: v.object({
      chatId: v.string(),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      return client.getChat(params.chatId)
    },
  })

  registry.register('user_get_contacts', {
    schema: v.object({}),
    handler: async () => {
      const client = getMtcuteClient(transport)
      return client.getContacts()
    },
  })

  registry.register('user_get_dialogs', {
    schema: v.object({
      limit: v.optional(v.number(), 100),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      const dialogs = []
      for await (const dialog of client.iterDialogs({ limit: params.limit })) {
        dialogs.push(dialog)
      }
      return dialogs
    },
  })

  // --- Write Operations (delegate to transport where possible) ---

  registry.register('user_send_message', {
    schema: v.object({
      chatId: v.string(),
      text: v.optional(v.string(), ''),
      parseMode: v.optional(v.string()),
      disableNotification: v.optional(v.boolean(), false),
      replyToMessageId: v.optional(v.number()),
    }),
    handler: async (params) => {
      return transport.sendMessage(params.chatId, params.text, {
        parseMode: mapParseMode(params.parseMode),
        silent: params.disableNotification,
        replyToMsgId: params.replyToMessageId,
      })
    },
  })

  registry.register('user_send_media', {
    schema: v.object({
      chatId: v.string(),
      mediaType: v.optional(v.string(), 'photo'),
      url: v.optional(v.string(), ''),
      caption: v.optional(v.string()),
    }),
    handler: async (params) => {
      if (params.mediaType === 'video') {
        return transport.sendVideo(params.chatId, params.url, { caption: params.caption })
      }
      if (params.mediaType === 'document') {
        return transport.sendDocument(params.chatId, params.url, { caption: params.caption })
      }
      return transport.sendPhoto(params.chatId, params.url, { caption: params.caption })
    },
  })

  registry.register('user_forward_message', {
    schema: v.object({
      chatId: v.optional(v.string(), ''),
      fromChatId: v.optional(v.string(), ''),
      toChatId: v.optional(v.string(), ''),
      messageId: v.optional(v.number()),
      messageIds: v.optional(v.array(v.number())),
    }),
    handler: async (params) => {
      const fromChatId = params.fromChatId || params.chatId
      const toChatId = params.toChatId || params.chatId
      const messageIds = params.messageIds ?? (params.messageId ? [params.messageId] : [0])
      return transport.forwardMessage(fromChatId, toChatId, messageIds)
    },
  })

  registry.register('user_delete_messages', {
    schema: v.object({
      chatId: v.string(),
      messageId: v.optional(v.number()),
      messageIds: v.optional(v.array(v.number())),
    }),
    handler: async (params) => {
      const messageIds = params.messageIds ?? (params.messageId ? [params.messageId] : [0])
      return transport.deleteMessages(params.chatId, messageIds)
    },
  })

  // --- Chat Operations (raw mtcute) ---

  registry.register('user_join_chat', {
    schema: v.object({
      invite: v.optional(v.string()),
      username: v.optional(v.string()),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      const link = params.invite ?? params.username ?? ''
      return client.joinChat(link)
    },
  })

  registry.register('user_leave_chat', {
    schema: v.object({
      chatId: v.string(),
    }),
    handler: async (params) => {
      return transport.leaveChat(params.chatId)
    },
  })

  registry.register('user_create_group', {
    schema: v.object({
      title: v.optional(v.string(), 'New Group'),
      users: v.optional(v.array(v.string()), []),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      return client.createGroup({
        title: params.title,
        users: params.users,
      })
    },
  })

  registry.register('user_create_channel', {
    schema: v.object({
      title: v.optional(v.string(), 'New Channel'),
      about: v.optional(v.string(), ''),
      broadcast: v.optional(v.boolean(), true),
      megagroup: v.optional(v.boolean(), false),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      if (params.megagroup) {
        return client.createSupergroup({
          title: params.title,
          description: params.about,
        })
      }
      return client.createChannel({
        title: params.title,
        description: params.about,
      })
    },
  })

  registry.register('user_invite_users', {
    schema: v.object({
      chatId: v.string(),
      users: v.optional(v.array(v.string()), []),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      return client.addChatMembers(params.chatId, params.users, {})
    },
  })

  // --- Account Operations (raw mtcute) ---

  registry.register('user_update_profile', {
    schema: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      bio: v.optional(v.string()),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      return client.updateProfile({
        firstName: params.firstName,
        lastName: params.lastName,
        bio: params.bio,
      })
    },
  })

  registry.register('user_set_status', {
    schema: v.object({
      offline: v.optional(v.boolean(), false),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      // mtcute uses sendOnline(bool) where true = online, false = offline
      return client.sendOnline(!params.offline)
    },
  })

  registry.register('user_get_profile_photos', {
    schema: v.object({
      userId: v.optional(v.string()),
      chatId: v.optional(v.string()),
      limit: v.optional(v.number(), 10),
    }),
    handler: async (params) => {
      const client = getMtcuteClient(transport)
      const target = params.userId ?? params.chatId ?? ''
      return client.getProfilePhotos(target, { limit: params.limit })
    },
  })
}

function mapParseMode(mode: unknown): 'html' | 'markdown' | undefined {
  const str = String(mode ?? '').toLowerCase()
  if (str === 'html') return 'html'
  if (str === 'markdownv2' || str === 'markdown') return 'markdown'
  return undefined
}
