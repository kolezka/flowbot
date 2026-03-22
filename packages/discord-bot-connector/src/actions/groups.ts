import * as v from 'valibot'
import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IDiscordBotTransport } from '../sdk/types.js'

export interface GroupInfo {
  id: string
  name: string
  memberCount: number
}

export interface ListGroupsResult {
  groups: GroupInfo[]
}

export function registerGroupsActions(registry: ActionRegistry, transport: IDiscordBotTransport): void {
  registry.register('discord_list_groups', {
    schema: v.object({}),
    handler: async (): Promise<ListGroupsResult> => {
      const client = transport.getClient()
      const groups: GroupInfo[] = []

      for (const [, guild] of client.guilds.cache) {
        groups.push({
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
        })
      }

      return { groups }
    },
  })
}
