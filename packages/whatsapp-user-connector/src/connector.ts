import { ActionRegistry, EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import type { IWhatsAppTransport } from './sdk/types.js'
import { registerMessagingActions } from './actions/messaging.js'
import { registerGroupAdminActions } from './actions/group-admin.js'
import { registerMessageMgmtActions } from './actions/message-mgmt.js'
import { registerPresenceActions } from './actions/presence.js'
import { registerEventListeners } from './events/listeners.js'
import { setupQrAuth } from './auth.js'

export interface WhatsAppUserConnectorConfig {
  connectionId: string
  botInstanceId: string
  prisma: unknown
  logger: Logger
  apiUrl: string
  /** Optional transport override — used in tests to inject FakeWhatsAppTransport. */
  transport?: IWhatsAppTransport
}

export class WhatsAppUserConnector {
  readonly registry = new ActionRegistry()
  private transport: IWhatsAppTransport | null = null
  private readonly forwarder: EventForwarder
  private readonly logger: Logger
  private readonly config: WhatsAppUserConnectorConfig

  constructor(config: WhatsAppUserConnectorConfig) {
    this.config = config
    this.logger = config.logger
    this.forwarder = new EventForwarder({ apiUrl: config.apiUrl, logger: config.logger })
  }

  async connect(): Promise<void> {
    if (this.config.transport !== undefined) {
      // Injected transport (e.g. FakeWhatsAppTransport in tests)
      this.transport = this.config.transport
    } else {
      // Dynamic import keeps Baileys out of the require graph in test environments
      const { BaileysClient } = await import('./sdk/baileys-client.js')
      this.transport = new BaileysClient({
        connectionId: this.config.connectionId,
        prisma: this.config.prisma,
        logger: this.config.logger,
      })
    }

    // Register all action handlers before connecting so the registry is ready
    this.registerActions()

    // Set up QR auth push before connect so callbacks are in place
    setupQrAuth(this.transport, this.config.apiUrl, this.config.connectionId, this.logger)

    await this.transport.connect()

    registerEventListeners(this.transport, this.forwarder, this.config.botInstanceId, this.logger)

    this.logger.info({ connectionId: this.config.connectionId }, 'WhatsApp user connector connected')
  }

  async disconnect(): Promise<void> {
    if (this.transport !== null) {
      await this.transport.disconnect()
    }
    this.logger.info({ connectionId: this.config.connectionId }, 'WhatsApp user connector disconnected')
  }

  isConnected(): boolean {
    return this.transport?.isConnected() ?? false
  }

  getTransport(): IWhatsAppTransport | null {
    return this.transport
  }

  private registerActions(): void {
    if (this.transport === null) return
    registerMessagingActions(this.registry, this.transport)
    registerGroupAdminActions(this.registry, this.transport)
    registerMessageMgmtActions(this.registry, this.transport)
    registerPresenceActions(this.registry, this.transport)
  }
}
