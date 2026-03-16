import type { Logger } from '../logger.js'
import type { AdminPrivileges, ChatMemberInfo, ChatPermissions, ForwardOptions, ITelegramTransport, MediaOptions, MessageResult, PeerInfo, SendOptions } from './ITelegramTransport.js'

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Number of failures within windowMs to trip the circuit (default: 5) */
  failureThreshold: number
  /** Time in ms to wait before probing after opening (default: 30000) */
  resetTimeoutMs: number
  /** Sliding window in ms for counting failures (default: 60000) */
  windowMs: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  windowMs: 60_000,
}

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is OPEN — requests are being rejected') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

export class CircuitBreaker implements ITelegramTransport {
  private readonly transport: ITelegramTransport
  private readonly config: CircuitBreakerConfig
  private readonly logger: Logger

  private state: CircuitState = CircuitState.CLOSED
  private failures: number[] = []
  private openedAt: number | null = null

  constructor(transport: ITelegramTransport, config: Partial<CircuitBreakerConfig> = {}, logger: Logger) {
    this.transport = transport
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = logger.child({ component: 'CircuitBreaker' })
  }

  getState(): CircuitState {
    return this.state
  }

  connect(): Promise<void> {
    return this.transport.connect()
  }

  disconnect(): Promise<void> {
    return this.transport.disconnect()
  }

  isConnected(): boolean {
    return this.transport.isConnected()
  }

  async sendMessage(peer: string | bigint, text: string, options?: SendOptions): Promise<MessageResult> {
    return this.execute(() => this.transport.sendMessage(peer, text, options))
  }

  async forwardMessage(
    fromPeer: string | bigint,
    toPeer: string | bigint,
    messageIds: number[],
    options?: ForwardOptions,
  ): Promise<MessageResult[]> {
    return this.execute(() => this.transport.forwardMessage(fromPeer, toPeer, messageIds, options))
  }

  async resolveUsername(username: string): Promise<PeerInfo> {
    return this.execute(() => this.transport.resolveUsername(username))
  }

  // Media messaging
  async sendPhoto(peer: string | bigint, photoUrl: string, options?: MediaOptions): Promise<MessageResult> {
    return this.execute(() => this.transport.sendPhoto(peer, photoUrl, options))
  }

  async sendVideo(peer: string | bigint, videoUrl: string, options?: MediaOptions): Promise<MessageResult> {
    return this.execute(() => this.transport.sendVideo(peer, videoUrl, options))
  }

  async sendDocument(peer: string | bigint, documentUrl: string, options?: MediaOptions): Promise<MessageResult> {
    return this.execute(() => this.transport.sendDocument(peer, documentUrl, options))
  }

  async sendSticker(peer: string | bigint, sticker: string, options?: { silent?: boolean }): Promise<MessageResult> {
    return this.execute(() => this.transport.sendSticker(peer, sticker, options))
  }

  async sendVoice(peer: string | bigint, voiceUrl: string, options?: MediaOptions): Promise<MessageResult> {
    return this.execute(() => this.transport.sendVoice(peer, voiceUrl, options))
  }

  async sendAudio(peer: string | bigint, audioUrl: string, options?: MediaOptions): Promise<MessageResult> {
    return this.execute(() => this.transport.sendAudio(peer, audioUrl, options))
  }

  async sendAnimation(peer: string | bigint, animationUrl: string, options?: MediaOptions): Promise<MessageResult> {
    return this.execute(() => this.transport.sendAnimation(peer, animationUrl, options))
  }

  async sendLocation(peer: string | bigint, latitude: number, longitude: number, options?: { livePeriod?: number, silent?: boolean }): Promise<MessageResult> {
    return this.execute(() => this.transport.sendLocation(peer, latitude, longitude, options))
  }

  async sendContact(peer: string | bigint, phoneNumber: string, firstName: string, lastName?: string): Promise<MessageResult> {
    return this.execute(() => this.transport.sendContact(peer, phoneNumber, firstName, lastName))
  }

  async sendVenue(peer: string | bigint, latitude: number, longitude: number, title: string, address: string): Promise<MessageResult> {
    return this.execute(() => this.transport.sendVenue(peer, latitude, longitude, title, address))
  }

  async sendDice(peer: string | bigint, emoji?: string): Promise<MessageResult> {
    return this.execute(() => this.transport.sendDice(peer, emoji))
  }

  // Message management
  async copyMessage(fromPeer: string | bigint, toPeer: string | bigint, messageId: number): Promise<MessageResult[]> {
    return this.execute(() => this.transport.copyMessage(fromPeer, toPeer, messageId))
  }

  async editMessage(peer: string | bigint, messageId: number, text: string, options?: SendOptions): Promise<MessageResult> {
    return this.execute(() => this.transport.editMessage(peer, messageId, text, options))
  }

  async deleteMessages(peer: string | bigint, messageIds: number[]): Promise<boolean> {
    return this.execute(() => this.transport.deleteMessages(peer, messageIds))
  }

  async pinMessage(peer: string | bigint, messageId: number, silent?: boolean): Promise<boolean> {
    return this.execute(() => this.transport.pinMessage(peer, messageId, silent))
  }

  async unpinMessage(peer: string | bigint, messageId?: number): Promise<boolean> {
    return this.execute(() => this.transport.unpinMessage(peer, messageId))
  }

  // User management
  async banUser(peer: string | bigint, userId: string | bigint): Promise<boolean> {
    return this.execute(() => this.transport.banUser(peer, userId))
  }

  async restrictUser(peer: string | bigint, userId: string | bigint, permissions: ChatPermissions, untilDate?: number): Promise<boolean> {
    return this.execute(() => this.transport.restrictUser(peer, userId, permissions, untilDate))
  }

  async promoteUser(peer: string | bigint, userId: string | bigint, privileges: AdminPrivileges): Promise<boolean> {
    return this.execute(() => this.transport.promoteUser(peer, userId, privileges))
  }

  // Chat management
  async setChatTitle(peer: string | bigint, title: string): Promise<boolean> {
    return this.execute(() => this.transport.setChatTitle(peer, title))
  }

  async setChatDescription(peer: string | bigint, description: string): Promise<boolean> {
    return this.execute(() => this.transport.setChatDescription(peer, description))
  }

  async exportInviteLink(peer: string | bigint): Promise<string> {
    return this.execute(() => this.transport.exportInviteLink(peer))
  }

  async getChatMember(peer: string | bigint, userId: string | bigint): Promise<ChatMemberInfo> {
    return this.execute(() => this.transport.getChatMember(peer, userId))
  }

  async leaveChat(peer: string | bigint): Promise<boolean> {
    return this.execute(() => this.transport.leaveChat(peer))
  }

  // Interactive
  async createPoll(peer: string | bigint, question: string, answers: string[], options?: { isAnonymous?: boolean, multipleChoice?: boolean }): Promise<MessageResult> {
    return this.execute(() => this.transport.createPoll(peer, question, answers, options))
  }

  async answerCallbackQuery(queryId: string, options?: { text?: string, showAlert?: boolean, url?: string }): Promise<boolean> {
    return this.execute(() => this.transport.answerCallbackQuery(queryId, options))
  }

  // SP2: Inline & Payments
  async answerInlineQuery(queryId: string, results: unknown[], options?: { cacheTime?: number }): Promise<boolean> {
    return this.execute(() => this.transport.answerInlineQuery(queryId, results, options))
  }

  async sendInvoice(peer: string | bigint, params: { title: string, description: string, payload: string, currency: string, prices: Array<{ label: string, amount: number }> }): Promise<MessageResult> {
    return this.execute(() => this.transport.sendInvoice(peer, params))
  }

  async answerPreCheckoutQuery(queryId: string, ok: boolean, errorMessage?: string): Promise<boolean> {
    return this.execute(() => this.transport.answerPreCheckoutQuery(queryId, ok, errorMessage))
  }

  // SP2: Bot configuration
  async setChatMenuButton(peer: string | bigint, menuButton: { type: string, text?: string, url?: string }): Promise<boolean> {
    return this.execute(() => this.transport.setChatMenuButton(peer, menuButton))
  }

  async setMyCommands(commands: Array<{ command: string, description: string }>, scope?: unknown): Promise<boolean> {
    return this.execute(() => this.transport.setMyCommands(commands, scope))
  }

  // SP2: Media & Forum
  async sendMediaGroup(peer: string | bigint, media: Array<{ type: string, url: string, caption?: string }>): Promise<MessageResult[]> {
    return this.execute(() => this.transport.sendMediaGroup(peer, media))
  }

  async createForumTopic(peer: string | bigint, name: string, options?: { iconColor?: number, iconEmojiId?: string }): Promise<number> {
    return this.execute(() => this.transport.createForumTopic(peer, name, options))
  }

  private async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now()

    if (this.state === CircuitState.OPEN) {
      if (this.openedAt !== null && now - this.openedAt >= this.config.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN)
      }
      else {
        throw new CircuitOpenError()
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Allow one probe call
      try {
        const result = await fn()
        this.onSuccess()
        return result
      }
      catch (error) {
        this.onFailure()
        throw error
      }
    }

    // CLOSED state
    try {
      const result = await fn()
      return result
    }
    catch (error) {
      this.recordFailure(now)
      throw error
    }
  }

  private recordFailure(now: number): void {
    const windowStart = now - this.config.windowMs
    this.failures.push(now)
    this.failures = this.failures.filter(t => t > windowStart)

    this.logger.warn({ failureCount: this.failures.length, threshold: this.config.failureThreshold }, 'Transport call failed')

    if (this.failures.length >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN)
    }
  }

  private onSuccess(): void {
    this.logger.info('Probe call succeeded, closing circuit')
    this.failures = []
    this.openedAt = null
    this.transitionTo(CircuitState.CLOSED)
  }

  private onFailure(): void {
    this.logger.warn('Probe call failed, re-opening circuit')
    this.transitionTo(CircuitState.OPEN)
  }

  private transitionTo(newState: CircuitState): void {
    const prev = this.state
    this.state = newState
    this.logger.info({ from: prev, to: newState }, 'Circuit state transition')

    if (newState === CircuitState.OPEN) {
      this.openedAt = Date.now()
    }

    if (newState === CircuitState.CLOSED) {
      this.failures = []
      this.openedAt = null
    }
  }
}
