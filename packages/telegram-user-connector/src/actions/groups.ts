import * as v from 'valibot'
import type { TelegramClient, Chat } from '@mtcute/node'
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

function isChat(peer: unknown): peer is Chat {
  return peer !== null && typeof peer === 'object' && 'chatType' in peer
}

export function registerGroupsActions(registry: ActionRegistry, transport: ITelegramUserTransport): void {
  registry.register('user_list_groups', {
    schema: v.object({
      limit: v.optional(v.number(), 200),
    }),
    handler: async (params): Promise<ListGroupsResult> => {
      const client = transport.getClient() as TelegramClient
      const groups: GroupInfo[] = []

      for await (const dialog of client.iterDialogs({ limit: params.limit })) {
        const peer = dialog.peer
        if (!isChat(peer)) continue

        // Include basic groups, supergroups, and channels
        const chatType = peer.chatType
        if (chatType !== 'group' && chatType !== 'supergroup' && chatType !== 'channel') continue

        const id = String(peer.id)
        const name = peer.title
        const memberCount = peer.membersCount ?? 0

        groups.push({ id, name, memberCount })
      }

      return { groups }
    },
  })
}
