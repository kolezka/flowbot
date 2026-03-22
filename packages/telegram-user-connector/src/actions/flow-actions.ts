/**
 * Flow engine user_* actions.
 *
 * These are registered with the `user_` prefix so the flow engine's dispatcher
 * can route them through the pool's POST /execute endpoint.
 * Actions that map directly to transport methods delegate to them.
 * Actions that need raw GramJS access use transport.getClient().
 */

import * as v from 'valibot'
import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramUserTransport } from '../sdk/types.js'

export function registerFlowActions(registry: ActionRegistry, transport: ITelegramUserTransport): void {
  // --- Read Operations (raw GramJS) ---

  registry.register('user_get_chat_history', {
    schema: v.object({
      chatId: v.string(),
      limit: v.optional(v.number(), 50),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const entity = await client.getEntity(params.chatId)
      return client.getMessages(entity, { limit: params.limit })
    },
  })

  registry.register('user_search_messages', {
    schema: v.object({
      chatId: v.string(),
      query: v.optional(v.string(), ''),
      limit: v.optional(v.number(), 50),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const entity = await client.getEntity(params.chatId)
      return client.getMessages(entity, { search: params.query, limit: params.limit })
    },
  })

  registry.register('user_get_all_members', {
    schema: v.object({
      chatId: v.string(),
      limit: v.optional(v.number(), 200),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const entity = await client.getEntity(params.chatId)
      return client.getParticipants(entity, { limit: params.limit })
    },
  })

  registry.register('user_get_chat_info', {
    schema: v.object({
      chatId: v.string(),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      return client.getEntity(params.chatId)
    },
  })

  registry.register('user_get_contacts', {
    schema: v.object({}),
    handler: async () => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const { Api } = await import('telegram')
      return client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) }))
    },
  })

  registry.register('user_get_dialogs', {
    schema: v.object({
      limit: v.optional(v.number(), 100),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      return client.getDialogs({ limit: params.limit })
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

  // --- Chat Operations (raw GramJS) ---

  registry.register('user_join_chat', {
    schema: v.object({
      invite: v.optional(v.string()),
      username: v.optional(v.string()),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const { Api } = await import('telegram')
      const link = params.invite ?? params.username ?? ''
      if (link.includes('+') || link.includes('joinchat')) {
        const hash = link.split('+').pop() || link.split('joinchat/').pop() || ''
        return client.invoke(new Api.messages.ImportChatInvite({ hash }))
      }
      const entity = await client.getEntity(link)
      return client.invoke(new Api.channels.JoinChannel({ channel: entity }))
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
      const client = transport.getClient() as import('telegram').TelegramClient
      const { Api } = await import('telegram')
      const entities = await Promise.all(params.users.map((u) => client.getEntity(u)))
      return client.invoke(new Api.messages.CreateChat({
        title: params.title,
        users: entities,
      }))
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
      const client = transport.getClient() as import('telegram').TelegramClient
      const { Api } = await import('telegram')
      return client.invoke(new Api.channels.CreateChannel({
        title: params.title,
        about: params.about,
        broadcast: params.broadcast,
        megagroup: params.megagroup,
      }))
    },
  })

  registry.register('user_invite_users', {
    schema: v.object({
      chatId: v.string(),
      users: v.optional(v.array(v.string()), []),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const { Api } = await import('telegram')
      const entity = await client.getEntity(params.chatId)
      const userEntities = await Promise.all(params.users.map((u) => client.getEntity(u)))
      return client.invoke(new Api.channels.InviteToChannel({
        channel: entity,
        users: userEntities,
      }))
    },
  })

  // --- Account Operations (raw GramJS) ---

  registry.register('user_update_profile', {
    schema: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      bio: v.optional(v.string()),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const { Api } = await import('telegram')
      return client.invoke(new Api.account.UpdateProfile({
        firstName: params.firstName,
        lastName: params.lastName,
        about: params.bio,
      }))
    },
  })

  registry.register('user_set_status', {
    schema: v.object({
      offline: v.optional(v.boolean(), false),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const { Api } = await import('telegram')
      return client.invoke(new Api.account.UpdateStatus({ offline: params.offline }))
    },
  })

  registry.register('user_get_profile_photos', {
    schema: v.object({
      userId: v.optional(v.string()),
      chatId: v.optional(v.string()),
      limit: v.optional(v.number(), 10),
    }),
    handler: async (params) => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const { Api } = await import('telegram')
      const entity = await client.getEntity(params.userId ?? params.chatId ?? '')
      return client.invoke(new Api.photos.GetUserPhotos({
        userId: entity,
        offset: 0,
        maxId: BigInt(0),
        limit: params.limit,
      }))
    },
  })
}

function mapParseMode(mode: unknown): 'html' | 'markdown' | undefined {
  const str = String(mode ?? '').toLowerCase()
  if (str === 'html') return 'html'
  if (str === 'markdownv2' || str === 'markdown') return 'markdown'
  return undefined
}
