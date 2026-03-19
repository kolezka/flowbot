import type { IWhatsAppTransport } from '@flowbot/whatsapp-transport'
import type { Logger } from '../logger.js'
import { mapGroupParticipantsUpdate, mapGroupsUpdate, mapMessageUpsert, mapPresenceUpdate } from './event-mapper.js'

export interface EventListenerConfig {
  apiUrl: string
  botInstanceId: string
}

export function registerEventListeners(
  transport: IWhatsAppTransport,
  config: EventListenerConfig,
  logger: Logger,
): void {
  // The transport is a BaileysTransport which uses Baileys' ev.on() internally.
  // Since we only have the IWhatsAppTransport interface, access the underlying socket
  // via getClient() which returns the WASocket.
  const sock = transport.getClient() as any
  if (!sock?.ev) {
    logger.warn('Transport client has no event emitter — events will not be forwarded')
    return
  }

  sock.ev.on('messages.upsert', async (upsert: any) => {
    try {
      const events = mapMessageUpsert(upsert, config.botInstanceId)
      for (const event of events) {
        await forwardEvent(event, config.apiUrl, logger)
      }
    }
    catch (err) {
      logger.error({ err }, 'Failed to handle messages.upsert')
    }
  })

  sock.ev.on('group-participants.update', async (update: any) => {
    try {
      const events = mapGroupParticipantsUpdate(update, config.botInstanceId)
      for (const event of events) {
        await forwardEvent(event, config.apiUrl, logger)
      }
    }
    catch (err) {
      logger.error({ err }, 'Failed to handle group-participants.update')
    }
  })

  sock.ev.on('groups.update', async (updates: any) => {
    try {
      const events = mapGroupsUpdate(updates, config.botInstanceId)
      for (const event of events) {
        await forwardEvent(event, config.apiUrl, logger)
      }
    }
    catch (err) {
      logger.error({ err }, 'Failed to handle groups.update')
    }
  })

  sock.ev.on('presence.update', async (update: any) => {
    try {
      const events = mapPresenceUpdate(update, config.botInstanceId)
      for (const event of events) {
        await forwardEvent(event, config.apiUrl, logger)
      }
    }
    catch (err) {
      logger.error({ err }, 'Failed to handle presence.update')
    }
  })

  logger.info('WhatsApp event listeners registered')
}

async function forwardEvent(event: unknown, apiUrl: string, logger: Logger): Promise<void> {
  try {
    const response = await fetch(`${apiUrl}/api/flow/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      logger.warn({ status: response.status }, 'Flow webhook forwarding failed')
    }
  }
  catch (err) {
    logger.error({ err }, 'Failed to forward event to flow engine')
  }
}
