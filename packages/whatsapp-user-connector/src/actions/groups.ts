import * as v from 'valibot'
import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IWhatsAppTransport } from '../sdk/types.js'

export interface GroupInfo {
  id: string
  name: string
  memberCount: number
}

export interface ListGroupsResult {
  groups: GroupInfo[]
}

/** Minimal duck-typed interface for the Baileys WASocket methods we need. */
interface WASocketLike {
  groupFetchAllParticipating(): Promise<Record<string, { subject: string; participants: unknown[] }>>
}

export function registerGroupsActions(registry: ActionRegistry, transport: IWhatsAppTransport): void {
  registry.register('list_groups', {
    schema: v.object({}),
    handler: async (): Promise<ListGroupsResult> => {
      const sock = transport.getClient() as WASocketLike | null
      if (sock === null) {
        return { groups: [] }
      }

      const participating = await sock.groupFetchAllParticipating()
      const groups: GroupInfo[] = Object.entries(participating).map(([jid, meta]) => ({
        id: jid,
        name: meta.subject,
        memberCount: meta.participants.length,
      }))

      return { groups }
    },
  })
}
