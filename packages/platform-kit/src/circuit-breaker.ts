import type { Logger } from 'pino'

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

export type ExecuteFn = (action: string, params: unknown) => Promise<unknown>

export class CircuitBreaker {
  private readonly fn: ExecuteFn
  private readonly config: CircuitBreakerConfig
  private readonly logger: Logger

  private state: CircuitState = CircuitState.CLOSED
  private failures: number[] = []
  private openedAt: number | null = null

  constructor(fn: ExecuteFn, config: Partial<CircuitBreakerConfig> = {}, logger: Logger) {
    this.fn = fn
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = logger.child({ component: 'CircuitBreaker' })
  }

  getState(): CircuitState {
    return this.state
  }

  async call(action: string, params: unknown): Promise<unknown> {
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
        const result = await this.fn(action, params)
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
      return await this.fn(action, params)
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

    this.logger.warn({ failureCount: this.failures.length, threshold: this.config.failureThreshold }, 'Execute call failed')

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
