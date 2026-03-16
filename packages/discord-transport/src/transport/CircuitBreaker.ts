import type { DiscordChannelOptions, DiscordChannelType, DiscordEmbedData, DiscordInviteOptions, DiscordMessageOptions, DiscordMessageResult, DiscordRoleOptions, DiscordScheduledEventOptions, DiscordThreadOptions, IDiscordTransport } from './IDiscordTransport.js'

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

export class CircuitBreaker implements IDiscordTransport {
  private readonly transport: IDiscordTransport
  private readonly config: CircuitBreakerConfig

  private state: CircuitState = CircuitState.CLOSED
  private failures: number[] = []
  private openedAt: number | null = null

  constructor(transport: IDiscordTransport, config: Partial<CircuitBreakerConfig> = {}) {
    this.transport = transport
    this.config = { ...DEFAULT_CONFIG, ...config }
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

  // --- Messaging ---

  async sendMessage(channelId: string, content: string, options?: DiscordMessageOptions): Promise<DiscordMessageResult> {
    return this.execute(() => this.transport.sendMessage(channelId, content, options))
  }

  async sendEmbed(channelId: string, embed: DiscordEmbedData, content?: string): Promise<DiscordMessageResult> {
    return this.execute(() => this.transport.sendEmbed(channelId, embed, content))
  }

  async sendDM(userId: string, content: string, options?: DiscordMessageOptions): Promise<DiscordMessageResult> {
    return this.execute(() => this.transport.sendDM(userId, content, options))
  }

  // --- Message management ---

  async editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessageResult> {
    return this.execute(() => this.transport.editMessage(channelId, messageId, content))
  }

  async deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    return this.execute(() => this.transport.deleteMessage(channelId, messageId))
  }

  async pinMessage(channelId: string, messageId: string): Promise<boolean> {
    return this.execute(() => this.transport.pinMessage(channelId, messageId))
  }

  async unpinMessage(channelId: string, messageId: string): Promise<boolean> {
    return this.execute(() => this.transport.unpinMessage(channelId, messageId))
  }

  // --- Reactions ---

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
    return this.execute(() => this.transport.addReaction(channelId, messageId, emoji))
  }

  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
    return this.execute(() => this.transport.removeReaction(channelId, messageId, emoji))
  }

  // --- Member management ---

  async banMember(guildId: string, userId: string, reason?: string, deleteMessageDays?: number): Promise<boolean> {
    return this.execute(() => this.transport.banMember(guildId, userId, reason, deleteMessageDays))
  }

  async kickMember(guildId: string, userId: string, reason?: string): Promise<boolean> {
    return this.execute(() => this.transport.kickMember(guildId, userId, reason))
  }

  async timeoutMember(guildId: string, userId: string, durationMs: number, reason?: string): Promise<boolean> {
    return this.execute(() => this.transport.timeoutMember(guildId, userId, durationMs, reason))
  }

  async addRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    return this.execute(() => this.transport.addRole(guildId, userId, roleId))
  }

  async removeRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    return this.execute(() => this.transport.removeRole(guildId, userId, roleId))
  }

  async setNickname(guildId: string, userId: string, nickname: string): Promise<boolean> {
    return this.execute(() => this.transport.setNickname(guildId, userId, nickname))
  }

  // --- Channel management ---

  async createChannel(guildId: string, name: string, type: DiscordChannelType, options?: DiscordChannelOptions): Promise<string> {
    return this.execute(() => this.transport.createChannel(guildId, name, type, options))
  }

  async deleteChannel(channelId: string): Promise<boolean> {
    return this.execute(() => this.transport.deleteChannel(channelId))
  }

  async createThread(channelId: string, name: string, options?: DiscordThreadOptions): Promise<string> {
    return this.execute(() => this.transport.createThread(channelId, name, options))
  }

  async sendThreadMessage(threadId: string, content: string): Promise<DiscordMessageResult> {
    return this.execute(() => this.transport.sendThreadMessage(threadId, content))
  }

  // --- Guild management ---

  async createRole(guildId: string, name: string, options?: DiscordRoleOptions): Promise<string> {
    return this.execute(() => this.transport.createRole(guildId, name, options))
  }

  async createInvite(channelId: string, options?: DiscordInviteOptions): Promise<string> {
    return this.execute(() => this.transport.createInvite(channelId, options))
  }

  async moveMember(guildId: string, userId: string, channelId: string): Promise<boolean> {
    return this.execute(() => this.transport.moveMember(guildId, userId, channelId))
  }

  async createScheduledEvent(guildId: string, name: string, options: DiscordScheduledEventOptions): Promise<string> {
    return this.execute(() => this.transport.createScheduledEvent(guildId, name, options))
  }

  // SP2: Interactions
  async replyInteraction(interactionId: string, params: { content?: string, embeds?: unknown[], components?: unknown[], ephemeral?: boolean }): Promise<void> {
    return this.execute(() => this.transport.replyInteraction(interactionId, params))
  }

  async showModal(interactionId: string, params: { customId: string, title: string, components: unknown[] }): Promise<void> {
    return this.execute(() => this.transport.showModal(interactionId, params))
  }

  async sendComponents(channelId: string, params: { content?: string, components: unknown[] }): Promise<DiscordMessageResult> {
    return this.execute(() => this.transport.sendComponents(channelId, params))
  }

  async editInteraction(interactionId: string, params: { content?: string, embeds?: unknown[], components?: unknown[] }): Promise<void> {
    return this.execute(() => this.transport.editInteraction(interactionId, params))
  }

  async deferReply(interactionId: string, ephemeral?: boolean): Promise<void> {
    return this.execute(() => this.transport.deferReply(interactionId, ephemeral))
  }

  // SP2: Channel permissions & Forums
  async setChannelPermissions(channelId: string, targetId: string, allow?: string, deny?: string): Promise<void> {
    return this.execute(() => this.transport.setChannelPermissions(channelId, targetId, allow, deny))
  }

  async createForumPost(channelId: string, params: { name: string, content: string, tags?: string[] }): Promise<string> {
    return this.execute(() => this.transport.createForumPost(channelId, params))
  }

  async registerCommands(guildId: string, commands: unknown[]): Promise<void> {
    return this.execute(() => this.transport.registerCommands(guildId, commands))
  }

  // --- Circuit breaker logic ---

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

    if (this.failures.length >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN)
    }
  }

  private onSuccess(): void {
    this.failures = []
    this.openedAt = null
    this.transitionTo(CircuitState.CLOSED)
  }

  private onFailure(): void {
    this.transitionTo(CircuitState.OPEN)
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState

    if (newState === CircuitState.OPEN) {
      this.openedAt = Date.now()
    }

    if (newState === CircuitState.CLOSED) {
      this.failures = []
      this.openedAt = null
    }
  }
}
