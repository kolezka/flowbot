import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CircuitBreaker, CircuitOpenError, CircuitState } from '../transport/CircuitBreaker.js'
import { FakeTelegramTransport } from '../transport/FakeTelegramTransport.js'

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

describe('CircuitBreaker', () => {
  let transport: FakeTelegramTransport
  let logger: ReturnType<typeof createTestLogger>
  let breaker: CircuitBreaker

  const fastConfig = {
    failureThreshold: 3,
    resetTimeoutMs: 1000,
    windowMs: 5000,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    transport = new FakeTelegramTransport()
    logger = createTestLogger()
    breaker = new CircuitBreaker(transport, fastConfig, logger)
  })

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('passes calls through to underlying transport in CLOSED state', async () => {
    await transport.connect()
    const result = await breaker.sendMessage('test-peer', 'Hello')

    expect(result).toBeDefined()
    expect(result.id).toBe(1)
    expect(result.peerId).toBe('test-peer')
    expect(transport.getSentMessages()).toHaveLength(1)
  })

  it('counts failures within window', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    // 2 failures should keep circuit CLOSED (threshold is 3)
    await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')
    await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')

    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect(transport.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('transitions to OPEN after failure threshold reached', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('rejects calls immediately when OPEN (throws CircuitOpenError)', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    // Trip the circuit
    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Now calls should be rejected immediately with CircuitOpenError
    await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow(CircuitOpenError)

    // The underlying transport should not have been called again
    expect(transport.sendMessage).toHaveBeenCalledTimes(fastConfig.failureThreshold)
  })

  it('transitions to HALF_OPEN after reset timeout', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    // Trip the circuit
    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Advance time past the reset timeout
    const realDateNow = Date.now
    Date.now = vi.fn(() => realDateNow() + fastConfig.resetTimeoutMs + 100)

    // Restore sendMessage so the probe succeeds
    vi.spyOn(transport, 'sendMessage').mockRestore()

    // The next call should trigger a transition to HALF_OPEN then succeed
    const result = await breaker.sendMessage('peer', 'probe')

    // After successful probe, should transition back to CLOSED
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect(result).toBeDefined()

    Date.now = realDateNow
  })

  it('transitions back to CLOSED on successful probe in HALF_OPEN', async () => {
    const sendSpy = vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    // Trip the circuit
    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Advance time past the reset timeout
    const realDateNow = Date.now
    Date.now = vi.fn(() => realDateNow() + fastConfig.resetTimeoutMs + 100)

    // Restore sendMessage for successful probe
    sendSpy.mockRestore()

    await breaker.sendMessage('peer', 'probe')
    expect(breaker.getState()).toBe(CircuitState.CLOSED)

    Date.now = realDateNow
  })

  it('transitions back to OPEN on failed probe in HALF_OPEN', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    // Trip the circuit
    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Advance time past the reset timeout
    const realDateNow = Date.now
    Date.now = vi.fn(() => realDateNow() + fastConfig.resetTimeoutMs + 100)

    // Probe should fail and circuit should go back to OPEN
    await expect(breaker.sendMessage('peer', 'probe')).rejects.toThrow('fail')
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    Date.now = realDateNow
  })

  it('clears failure count on state transitions', async () => {
    const sendSpy = vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    // Trip the circuit
    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Advance time and do a successful probe to transition to CLOSED
    const realDateNow = Date.now
    Date.now = vi.fn(() => realDateNow() + fastConfig.resetTimeoutMs + 100)
    sendSpy.mockRestore()
    await breaker.sendMessage('peer', 'probe')
    expect(breaker.getState()).toBe(CircuitState.CLOSED)

    Date.now = realDateNow

    // Now cause failures again - should need full threshold to trip again
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail again'))

    // Only 2 failures (less than threshold) should keep CLOSED
    await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow()
    await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow()
    expect(breaker.getState()).toBe(CircuitState.CLOSED)

    // Third failure trips it
    await expect(breaker.sendMessage('peer', 'hi')).rejects.toThrow()
    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('failures outside window do not count toward threshold', async () => {
    const shortWindowConfig = {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      windowMs: 100, // 100ms window
    }

    const shortWindowBreaker = new CircuitBreaker(transport, shortWindowConfig, logger)
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    const realDateNow = Date.now
    let currentTime = realDateNow()
    Date.now = vi.fn(() => currentTime)

    // Record 2 failures at time 0
    await expect(shortWindowBreaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')
    await expect(shortWindowBreaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')

    // Advance time past the window
    currentTime += 200

    // This failure should only count as 1 within the new window
    await expect(shortWindowBreaker.sendMessage('peer', 'hi')).rejects.toThrow('fail')

    // Circuit should still be CLOSED because only 1 failure is within the window
    expect(shortWindowBreaker.getState()).toBe(CircuitState.CLOSED)

    Date.now = realDateNow
  })
})
