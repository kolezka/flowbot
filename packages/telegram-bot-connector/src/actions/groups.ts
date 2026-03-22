import * as v from 'valibot'
import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ITelegramBotTransport } from '../sdk/types.js'

// The Telegram Bot API does not expose a "list my chats" endpoint.
// Bots discover chats reactively when users add them or send messages.
// This action returns an empty list and documents that limitation clearly.
export function registerGroupsActions(registry: ActionRegistry, _transport: ITelegramBotTransport): void {
  registry.register('list_groups', {
    schema: v.object({}),
    handler: async () => ({
      groups: [] as Array<{ id: string; name: string; memberCount: number }>,
      note: 'Telegram Bot API does not provide a method to list all chats a bot belongs to. Groups are discovered through incoming updates.',
    }),
  })
}
