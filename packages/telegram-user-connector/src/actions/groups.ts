import * as v from 'valibot'
import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramUserTransport } from '../sdk/types.js'

export interface GroupInfo {
  id: string
  name: string
  memberCount: number
}

export interface ListGroupsResult {
  groups: GroupInfo[]
}

export function registerGroupsActions(registry: ActionRegistry, transport: ITelegramUserTransport): void {
  registry.register('user_list_groups', {
    schema: v.object({
      limit: v.optional(v.number(), 200),
    }),
    handler: async (params): Promise<ListGroupsResult> => {
      const client = transport.getClient() as import('telegram').TelegramClient
      const dialogs = await client.getDialogs({ limit: params.limit })

      const groups: GroupInfo[] = []
      for (const dialog of dialogs) {
        const entity = dialog.entity
        if (entity === undefined || entity === null) continue

        // Include basic groups, supergroups, and channels
        const isChat = 'className' in entity && entity.className === 'Chat'
        const isChannel = 'className' in entity && entity.className === 'Channel'
        if (!isChat && !isChannel) continue

        const id = String('id' in entity ? entity.id : '')
        const name = 'title' in entity ? String(entity.title ?? '') : ''
        const memberCount =
          'participantsCount' in entity
            ? Number(entity.participantsCount ?? 0)
            : 'migratedTo' in entity
              ? 0
              : 0

        groups.push({ id, name, memberCount })
      }

      return { groups }
    },
  })
}
