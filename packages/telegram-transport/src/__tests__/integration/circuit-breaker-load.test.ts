import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CircuitBreaker, CircuitOpenError, CircuitState } from '../../transport/CircuitBreaker.js'
import { FakeTelegramTransport } from '../../transport/FakeTelegramTransport.js'

function createTestLogger(): any {
  const logger: any = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
  logger.child = vi.fn().mockReturnValue(logger)
  return logger
}

describe('Integration: CircuitBreaker load scenarios', () => {
  let transport: FakeTelegramTransport
  let breaker: CircuitBreaker
  let logger: ReturnType<typeof createTestLogger>

  const config = {
    failureThreshold: 5,
    resetTimeoutMs: 5000,
    windowMs: 60000,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    transport = new FakeTelegramTransport()
    logger = createTestLogger()
    breaker = new CircuitBreaker(transport, config, logger)
  })

  it('concurrent requests in CLOSED state: 10 parallel calls all succeed', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      breaker.sendMessage('peer', `message-${i}`),
    )

    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)
    results.forEach((result, i) => {
      expect(result).toBeDefined()
      expect(result.peerId).toBe('peer')
    })
    expect(transport.getSentMessages()).toHaveLength(10)
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('concurrent requests in OPEN state: 5 parallel calls all reject', async () => {
    // Trip the circuit
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    for (let i = 0; i < config.failureThreshold; i++) {
      try {
        await breaker.sendMessage('peer', 'hi')
      }
      catch {
        // expected
      }
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Fire 5 parallel calls - all should reject with CircuitOpenError
    const promises = Array.from({ length: 5 }, (_, i) =>
      breaker.sendMessage('peer', `message-${i}`).catch(err => err),
    )

    const errors = await Promise.all(promises)

    expect(errors).toHaveLength(5)
    errors.forEach((err) => {
      expect(err).toBeInstanceOf(CircuitOpenError)
    })
    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('rapid failure/recovery cycles: alternate failure bursts and successful probes 3 times', async () => {
    const realDateNow = Date.now
    let currentTime = realDateNow()
    Date.now = vi.fn(() => currentTime)

    for (let cycle = 0; cycle < 3; cycle++) {
      // --- Failure burst: trip the circuit ---
      const failSpy = vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error(`fail-cycle-${cycle}`))

      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.sendMessage('peer', 'hi')
        }
        catch {
          // expected
        }
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN)

      // --- Recovery: advance time past resetTimeout ---
      currentTime += config.resetTimeoutMs + 100

      // Restore transport for successful probe
      failSpy.mockRestore()

      const result = await breaker.sendMessage('peer', `recovered-${cycle}`)
      expect(result).toBeDefined()
      expect(result.peerId).toBe('peer')
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    }

    Date.now = realDateNow

    // Verify transport received the recovery messages
    const sent = transport.getSentMessages()
    const recoveryMessages = sent.filter(m => m.text.startsWith('recovered-'))
    expect(recoveryMessages).toHaveLength(3)
  })
})
