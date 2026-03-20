import type { Logger } from 'pino'

export interface FlowTriggerEvent {
  platform: string
  communityId?: string | null
  accountId?: string
  eventType: string
  data?: Record<string, unknown>
  timestamp?: string
  botInstanceId?: string
}

export interface EventForwarderConfig {
  apiUrl: string
  logger: Logger
  timeoutMs?: number
  webhookPath?: string
}

export class EventForwarder {
  private readonly apiUrl: string
  private readonly logger: Logger
  private readonly timeoutMs: number
  private readonly webhookPath: string

  constructor(config: EventForwarderConfig) {
    this.apiUrl = config.apiUrl
    this.logger = config.logger.child?.({ component: 'EventForwarder' }) ?? config.logger
    this.timeoutMs = config.timeoutMs ?? 10_000
    this.webhookPath = config.webhookPath ?? '/api/flow/webhook'
  }

  async send(event: FlowTriggerEvent): Promise<void> {
    const url = `${this.apiUrl}${this.webhookPath}`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!response.ok) {
        this.logger.warn({ status: response.status, eventType: event.eventType }, 'Event forwarding failed')
      }
    } catch (err) {
      this.logger.error({ err, eventType: event.eventType }, 'Failed to forward event')
    }
  }
}
