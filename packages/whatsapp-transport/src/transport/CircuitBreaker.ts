import type { Logger } from '../logger.js'
import type {
  IWhatsAppTransport,
  WhatsAppContact,
  WhatsAppGroupMetadata,
  WhatsAppMediaOptions,
  WhatsAppMediaType,
  WhatsAppMessageKey,
  WhatsAppMessageResult,
  WhatsAppPresenceType,
  WhatsAppSendOptions,
} from './IWhatsAppTransport.js'

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

export class CircuitBreaker implements IWhatsAppTransport {
  private readonly transport: IWhatsAppTransport
  private readonly config: CircuitBreakerConfig
  private readonly logger: Logger

  private state: CircuitState = CircuitState.CLOSED
  private failures: number[] = []
  private openedAt: number | null = null

  constructor(transport: IWhatsAppTransport, config: Partial<CircuitBreakerConfig> = {}, logger: Logger) {
    this.transport = transport
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = logger.child({ component: 'CircuitBreaker' })
  }

  getState(): CircuitState {
    return this.state
  }

  // --- Pass-through connection methods ---

  connect(): Promise<void> {
    return this.transport.connect()
  }

  disconnect(): Promise<void> {
    return this.transport.disconnect()
  }

  isConnected(): boolean {
    return this.transport.isConnected()
  }

  onQrCode(cb: (qr: string) => void): void {
    this.transport.onQrCode(cb)
  }

  onConnectionUpdate(cb: (update: { connection?: string; lastDisconnect?: unknown }) => void): void {
    this.transport.onConnectionUpdate(cb)
  }

  getClient(): unknown {
    return this.transport.getClient()
  }

  // --- Messaging ---

  async sendMessage(jid: string, text: string, opts?: WhatsAppSendOptions): Promise<WhatsAppMessageResult> {
    return this.execute(() => this.transport.sendMessage(jid, text, opts))
  }

  async sendMedia(jid: string, type: WhatsAppMediaType, urlOrBuffer: string | Buffer, opts?: WhatsAppMediaOptions): Promise<WhatsAppMessageResult> {
    return this.execute(() => this.transport.sendMedia(jid, type, urlOrBuffer, opts))
  }

  async sendLocation(jid: string, lat: number, lng: number): Promise<WhatsAppMessageResult> {
    return this.execute(() => this.transport.sendLocation(jid, lat, lng))
  }

  async sendContact(jid: string, contact: WhatsAppContact): Promise<WhatsAppMessageResult> {
    return this.execute(() => this.transport.sendContact(jid, contact))
  }

  async sendDocument(jid: string, urlOrBuffer: string | Buffer, opts?: WhatsAppMediaOptions): Promise<WhatsAppMessageResult> {
    return this.execute(() => this.transport.sendDocument(jid, urlOrBuffer, opts))
  }

  // --- Message management ---

  async editMessage(jid: string, key: WhatsAppMessageKey, text: string): Promise<WhatsAppMessageResult> {
    return this.execute(() => this.transport.editMessage(jid, key, text))
  }

  async deleteMessage(jid: string, key: WhatsAppMessageKey): Promise<boolean> {
    return this.execute(() => this.transport.deleteMessage(jid, key))
  }

  async forwardMessage(fromJid: string, toJid: string, key: WhatsAppMessageKey): Promise<WhatsAppMessageResult> {
    return this.execute(() => this.transport.forwardMessage(fromJid, toJid, key))
  }

  async readHistory(jid: string, count?: number): Promise<void> {
    return this.execute(() => this.transport.readHistory(jid, count))
  }

  // --- Group admin ---

  async kickParticipant(groupJid: string, userJid: string): Promise<boolean> {
    return this.execute(() => this.transport.kickParticipant(groupJid, userJid))
  }

  async promoteParticipant(groupJid: string, userJid: string): Promise<boolean> {
    return this.execute(() => this.transport.promoteParticipant(groupJid, userJid))
  }

  async demoteParticipant(groupJid: string, userJid: string): Promise<boolean> {
    return this.execute(() => this.transport.demoteParticipant(groupJid, userJid))
  }

  async getGroupMetadata(groupJid: string): Promise<WhatsAppGroupMetadata> {
    return this.execute(() => this.transport.getGroupMetadata(groupJid))
  }

  async getGroupInviteLink(groupJid: string): Promise<string> {
    return this.execute(() => this.transport.getGroupInviteLink(groupJid))
  }

  // --- Presence ---

  async sendPresenceUpdate(jid: string, type: WhatsAppPresenceType): Promise<void> {
    return this.execute(() => this.transport.sendPresenceUpdate(jid, type))
  }

  async getPresence(jid: string): Promise<WhatsAppPresenceType> {
    return this.execute(() => this.transport.getPresence(jid))
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
