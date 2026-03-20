import type { IWhatsAppTransport } from '../sdk/types.js'
import type { EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import { mapMessageUpsert, mapGroupParticipantsUpdate, mapGroupsUpdate, mapPresenceUpdate } from './mapper.js'

export function registerEventListeners(
  transport: IWhatsAppTransport,
  forwarder: EventForwarder,
  botInstanceId: string,
  logger: Logger,
): void {
  const sock = transport.getClient() as any
  if (!sock?.ev) {
    logger.warn('Transport client has no event emitter — events will not be forwarded')
    return
  }

  sock.ev.on('messages.upsert', async (upsert: any) => {
    try {
      const events = mapMessageUpsert(upsert, botInstanceId)
      for (const event of events) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle messages.upsert')
    }
  })

  sock.ev.on('group-participants.update', async (update: any) => {
    try {
      const events = mapGroupParticipantsUpdate(update, botInstanceId)
      for (const event of events) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle group-participants.update')
    }
  })

  sock.ev.on('groups.update', async (updates: any) => {
    try {
      const events = mapGroupsUpdate(updates, botInstanceId)
      for (const event of events) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle groups.update')
    }
  })

  sock.ev.on('presence.update', async (update: any) => {
    try {
      const events = mapPresenceUpdate(update, botInstanceId)
      for (const event of events) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle presence.update')
    }
  })

  logger.info('WhatsApp event listeners registered')
}
