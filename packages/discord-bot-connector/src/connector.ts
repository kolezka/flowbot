import { ActionRegistry, EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import type { IDiscordBotTransport } from './sdk/types.js'
import { registerMessagingActions } from './actions/messaging.js'
import { registerAdminActions } from './actions/admin.js'
import { registerChannelActions } from './actions/channel.js'
import { registerEventListeners } from './events/listeners.js'

export interface DiscordBotConnectorConfig {
  botToken: string
  botInstanceId: string
  logger: Logger
  apiUrl: string
  /** Optional transport override — used in tests to inject FakeDiscordClient. */
  transport?: IDiscordBotTransport
}

export class DiscordBotConnector {
  readonly registry = new ActionRegistry()
  private transport: IDiscordBotTransport | null = null
  private readonly forwarder: EventForwarder
  private readonly logger: Logger
  private readonly config: DiscordBotConnectorConfig

  constructor(config: DiscordBotConnectorConfig) {
    this.config = config
    this.logger = config.logger
    this.forwarder = new EventForwarder({ apiUrl: config.apiUrl, logger: config.logger })
  }

  async connect(): Promise<void> {
    if (this.config.transport !== undefined) {
      // Injected transport (e.g. FakeDiscordClient in tests)
      this.transport = this.config.transport
    } else {
      // Dynamic import keeps discord.js out of the require graph in test environments
      const { DiscordClient } = await import('./sdk/discord-client.js')
      this.transport = new DiscordClient({ token: this.config.botToken })
    }

    // Register all action handlers before connecting so the registry is ready
    this.registerActions()

    // Register event listeners to forward incoming Discord events to the flow engine
    registerEventListeners(
      this.transport.getClient(),
      this.forwarder,
      this.config.botInstanceId,
      this.logger,
    )

    await this.transport.connect()

    this.logger.info({ botInstanceId: this.config.botInstanceId }, 'Discord bot connector connected')
  }

  async disconnect(): Promise<void> {
    if (this.transport !== null) {
      await this.transport.disconnect()
    }
    this.logger.info({ botInstanceId: this.config.botInstanceId }, 'Discord bot connector disconnected')
  }

  isConnected(): boolean {
    return this.transport?.isConnected() ?? false
  }

  getTransport(): IDiscordBotTransport | null {
    return this.transport
  }

  private registerActions(): void {
    if (this.transport === null) return
    registerMessagingActions(this.registry, this.transport)
    registerAdminActions(this.registry, this.transport)
    registerChannelActions(this.registry, this.transport)
  }
}
