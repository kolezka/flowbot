import { ActionRegistry, EventForwarder } from '@flowbot/platform-kit'
import type { BotScope } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import type { ITelegramBotTransport } from './sdk/types.js'
import { registerMessagingActions } from './actions/messaging.js'
import { registerAdminActions } from './actions/admin.js'
import { registerChatActions } from './actions/chat.js'
import { registerMessageMgmtActions } from './actions/message-mgmt.js'
import { registerEventListeners } from './events/listeners.js'
import { registerFeatures } from './features/index.js'
import { shouldProcessMessage } from './scope-filter.js'

export interface TelegramBotConnectorConfig {
  botToken: string
  botInstanceId: string
  logger: Logger
  apiUrl: string
  /** Optional scope to restrict which chats/users this bot instance processes. */
  scope?: BotScope
  /** Optional transport override — used in tests to inject FakeTelegramBot. */
  transport?: ITelegramBotTransport
}

export class TelegramBotConnector {
  readonly registry = new ActionRegistry()
  private transport: ITelegramBotTransport | null = null
  private readonly forwarder: EventForwarder
  private readonly logger: Logger
  private readonly config: TelegramBotConnectorConfig

  constructor(config: TelegramBotConnectorConfig) {
    this.config = config
    this.logger = config.logger
    this.forwarder = new EventForwarder({ apiUrl: config.apiUrl, logger: config.logger })
  }

  async connect(): Promise<void> {
    if (this.config.transport !== undefined) {
      // Injected transport (e.g. FakeTelegramBot in tests)
      this.transport = this.config.transport
    } else {
      // Dynamic import keeps grammY out of the require graph in test environments
      const { GrammyBot } = await import('./sdk/grammy-bot.js')
      this.transport = new GrammyBot({
        botToken: this.config.botToken,
        logger: this.logger,
      })
    }

    // Install scope filter middleware before any other handlers
    if (this.config.scope) {
      const scope = this.config.scope
      this.transport.getBot().use(async (ctx, next) => {
        const chatId = String(ctx.chat?.id ?? '')
        const userId = String(ctx.from?.id ?? '')
        if (!shouldProcessMessage(scope, chatId, userId)) {
          return
        }
        await next()
      })
    }

    // Register all action handlers before starting so the registry is ready
    this.registerActions()

    // Register built-in command features (/start, /help, etc.)
    registerFeatures(this.transport.getBot())

    // Register event listeners to forward incoming updates to the flow engine
    registerEventListeners(this.transport.getBot(), this.forwarder, this.config.botInstanceId, this.logger)

    await this.transport.start()

    this.logger.info({ botInstanceId: this.config.botInstanceId }, 'Telegram bot connector connected')
  }

  async disconnect(): Promise<void> {
    if (this.transport !== null) {
      await this.transport.stop()
    }
    this.logger.info({ botInstanceId: this.config.botInstanceId }, 'Telegram bot connector disconnected')
  }

  isConnected(): boolean {
    return this.transport?.isRunning() ?? false
  }

  getTransport(): ITelegramBotTransport | null {
    return this.transport
  }

  private registerActions(): void {
    if (this.transport === null) return
    registerMessagingActions(this.registry, this.transport)
    registerAdminActions(this.registry, this.transport)
    registerChatActions(this.registry, this.transport)
    registerMessageMgmtActions(this.registry, this.transport)
  }
}
