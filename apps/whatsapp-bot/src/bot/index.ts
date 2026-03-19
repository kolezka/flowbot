import type { IWhatsAppTransport } from '@flowbot/whatsapp-transport'
import type { Config } from '../config.js'
import type { Logger } from '../logger.js'
import { registerEventListeners } from './events.js'

export interface WhatsAppBot {
  start(): Promise<void>
  stop(): Promise<void>
  transport: IWhatsAppTransport
}

export function createWhatsAppBot(
  transport: IWhatsAppTransport,
  config: Config,
  logger: Logger,
): WhatsAppBot {
  return {
    async start() {
      await transport.connect()
      registerEventListeners(transport, {
        apiUrl: config.apiUrl,
        botInstanceId: config.waBotInstanceId,
      }, logger)
      logger.info('WhatsApp bot started')
    },
    async stop() {
      await transport.disconnect()
      logger.info('WhatsApp bot stopped')
    },
    transport,
  }
}
