import { ActionRegistry } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import type { ITelegramUserTransport } from './sdk/types.js'
import { registerMessagingActions } from './actions/messaging.js'
import { registerUserActions } from './actions/user-actions.js'
import { registerFlowActions } from './actions/flow-actions.js'
import { registerGroupsActions } from './actions/groups.js'

export interface TelegramUserConnectorConfig {
  sessionString: string
  apiId: number
  apiHash: string
  logger: Logger
  /** Optional transport override — used in tests to inject FakeTelegramUserTransport. */
  transport?: ITelegramUserTransport
}

export class TelegramUserConnector {
  readonly registry = new ActionRegistry()
  private transport: ITelegramUserTransport | null = null
  private readonly logger: Logger
  private readonly config: TelegramUserConnectorConfig

  constructor(config: TelegramUserConnectorConfig) {
    this.config = config
    this.logger = config.logger
  }

  async connect(): Promise<void> {
    if (this.config.transport !== undefined) {
      // Injected transport (e.g. FakeTelegramUserTransport in tests)
      this.transport = this.config.transport
    } else {
      // Dynamic import keeps mtcute out of the require graph in test environments
      const { MtcuteClient } = await import('./sdk/mtcute-client.js')
      this.transport = new MtcuteClient({
        sessionString: this.config.sessionString,
        apiId: this.config.apiId,
        apiHash: this.config.apiHash,
        logger: this.logger,
      })
    }

    // Register all action handlers before connecting so the registry is ready
    this.registerActions()

    await this.transport.connect()

    this.logger.info('Telegram user connector connected')
  }

  async disconnect(): Promise<void> {
    if (this.transport !== null) {
      await this.transport.disconnect()
    }
    this.logger.info('Telegram user connector disconnected')
  }

  isConnected(): boolean {
    return this.transport?.isConnected() ?? false
  }

  getTransport(): ITelegramUserTransport | null {
    return this.transport
  }

  private registerActions(): void {
    if (this.transport === null) return
    registerMessagingActions(this.registry, this.transport)
    registerUserActions(this.registry, this.transport)
    registerFlowActions(this.registry, this.transport)
    registerGroupsActions(this.registry, this.transport)
  }
}
