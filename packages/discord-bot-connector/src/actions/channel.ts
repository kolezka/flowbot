import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IDiscordBotTransport } from '../sdk/types.js'
import type { DiscordChannelType } from '../sdk/types.js'
import {
  createChannelSchema,
  deleteChannelSchema,
  createThreadSchema,
  createRoleSchema,
  createInviteSchema,
  moveMemberSchema,
  createScheduledEventSchema,
} from './schemas.js'

export function registerChannelActions(registry: ActionRegistry, transport: IDiscordBotTransport): void {
  registry.register('discord_create_channel', {
    schema: createChannelSchema,
    handler: async (params) =>
      transport.createChannel(
        params.guildId,
        params.name,
        (params.type ?? 'text') as DiscordChannelType,
        {
          topic: params.topic,
          nsfw: params.nsfw,
          parentId: params.parentId,
          rateLimitPerUser: params.rateLimitPerUser,
          bitrate: params.bitrate,
          userLimit: params.userLimit,
          position: params.position,
        },
      ),
  })

  registry.register('discord_delete_channel', {
    schema: deleteChannelSchema,
    handler: async (params) =>
      transport.deleteChannel(params.channelId),
  })

  registry.register('discord_create_thread', {
    schema: createThreadSchema,
    handler: async (params) =>
      transport.createThread(params.channelId, params.name, {
        autoArchiveDuration: params.autoArchiveDuration,
        rateLimitPerUser: params.rateLimitPerUser,
        reason: params.reason,
      }),
  })

  registry.register('discord_create_role', {
    schema: createRoleSchema,
    handler: async (params) =>
      transport.createRole(params.guildId, params.name, {
        color: params.color,
        hoist: params.hoist,
        mentionable: params.mentionable,
        reason: params.reason,
      }),
  })

  registry.register('discord_create_invite', {
    schema: createInviteSchema,
    handler: async (params) =>
      transport.createInvite(params.channelId, {
        maxAge: params.maxAge,
        maxUses: params.maxUses,
        temporary: params.temporary,
        unique: params.unique,
        reason: params.reason,
      }),
  })

  registry.register('discord_move_member', {
    schema: moveMemberSchema,
    handler: async (params) =>
      transport.moveMember(params.guildId, params.userId, params.channelId),
  })

  registry.register('discord_create_scheduled_event', {
    schema: createScheduledEventSchema,
    handler: async (params) =>
      transport.createScheduledEvent(params.guildId, params.name, {
        scheduledStartTime: new Date(params.scheduledStartTime),
        scheduledEndTime: params.scheduledEndTime ? new Date(params.scheduledEndTime) : undefined,
        entityType: params.entityType,
        channelId: params.channelId,
        location: params.location,
        description: params.description,
      }),
  })
}
