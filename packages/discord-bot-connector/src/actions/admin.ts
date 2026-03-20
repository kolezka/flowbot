import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IDiscordBotTransport } from '../sdk/types.js'
import {
  banMemberSchema,
  kickMemberSchema,
  timeoutMemberSchema,
  addRoleSchema,
  removeRoleSchema,
  setNicknameSchema,
} from './schemas.js'

export function registerAdminActions(registry: ActionRegistry, transport: IDiscordBotTransport): void {
  registry.register('discord_ban_member', {
    schema: banMemberSchema,
    handler: async (params) =>
      transport.banMember(params.guildId, params.userId, params.reason, params.deleteMessageDays),
  })

  registry.register('discord_kick_member', {
    schema: kickMemberSchema,
    handler: async (params) =>
      transport.kickMember(params.guildId, params.userId, params.reason),
  })

  registry.register('discord_timeout_member', {
    schema: timeoutMemberSchema,
    handler: async (params) =>
      transport.timeoutMember(params.guildId, params.userId, params.durationMs, params.reason),
  })

  registry.register('discord_add_role', {
    schema: addRoleSchema,
    handler: async (params) =>
      transport.addRole(params.guildId, params.userId, params.roleId),
  })

  registry.register('discord_remove_role', {
    schema: removeRoleSchema,
    handler: async (params) =>
      transport.removeRole(params.guildId, params.userId, params.roleId),
  })

  registry.register('discord_set_nickname', {
    schema: setNicknameSchema,
    handler: async (params) =>
      transport.setNickname(params.guildId, params.userId, params.nickname),
  })
}
