import type { ActionRegistry } from '@flowbot/platform-kit'
import type { IWhatsAppTransport, WhatsAppPresenceType } from '../sdk/types.js'
import { sendPresenceSchema } from './schemas.js'

export function registerPresenceActions(registry: ActionRegistry, transport: IWhatsAppTransport): void {
  registry.register('send_presence', {
    schema: sendPresenceSchema,
    handler: async (params) => transport.sendPresenceUpdate(params.chatId, params.type as WhatsAppPresenceType),
  })
}
