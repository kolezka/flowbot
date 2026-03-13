import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRunner } from '../../actions/runner.js'
import { ActionType } from '../../actions/types.js'
import type { Action } from '../../actions/types.js'
import { CircuitBreaker, CircuitOpenError, CircuitState } from '../../transport/CircuitBreaker.js'
import { FakeTelegramTransport } from '../../transport/FakeTelegramTransport.js'

// Mock the backoff sleep to avoid real delays
vi.mock('../../errors/backoff.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../errors/backoff.js')>()
  return {
    ...actual,
    sleep: vi.fn().mockResolvedValue(undefined),
  }
})

// Mock the classifier to control error categories in tests
vi.mock('../../errors/classifier.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../errors/classifier.js')>()
  return {
    ...actual,
    classifyError: vi.fn().mockReturnValue(actual.ErrorCategory.RETRYABLE),
  }
})

import { classifyError, ErrorCategory } from '../../errors/classifier.js'
import { sleep } from '../../errors/backoff.js'

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

describe('Integration: FakeTransport -> CircuitBreaker -> ActionRunner', () => {
  let transport: FakeTelegramTransport
  let breaker: CircuitBreaker
  let runner: ActionRunner
  let logger: ReturnType<typeof createTestLogger>

  const circuitConfig = {
    failureThreshold: 5,
    resetTimeoutMs: 5000,
    windowMs: 60000,
  }

  const runnerConfig = {
    maxRetries: 3,
    backoffBaseMs: 100,
    backoffMaxMs: 5000,
  }

  const sendAction: Action = {
    type: ActionType.SEND_MESSAGE,
    payload: { peer: 'test-peer', text: 'Hello integration' },
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    transport = new FakeTelegramTransport()
    logger = createTestLogger()
    breaker = new CircuitBreaker(transport, circuitConfig, logger)
    runner = new ActionRunner(breaker, logger, runnerConfig)
    vi.mocked(classifyError).mockReturnValue(ErrorCategory.RETRYABLE)
    vi.mocked(sleep).mockClear()
    vi.mocked(sleep).mockResolvedValue(undefined)
  })

  it('happy path: executes SEND_MESSAGE and message arrives in FakeTransport', async () => {
    const result = await runner.execute(sendAction)

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(1)
    expect(result.data).toBeDefined()

    const sent = transport.getSentMessages()
    expect(sent).toHaveLength(1)
    expect(sent[0].peer).toBe('test-peer')
    expect(sent[0].text).toBe('Hello integration')
  })

  it('retry through full stack: transport fails twice then succeeds', async () => {
    const sendSpy = vi.spyOn(transport, 'sendMessage')
    sendSpy
      .mockRejectedValueOnce(new Error('transient-1'))
      .mockRejectedValueOnce(new Error('transient-2'))

    // After two rejections, spy is exhausted and calls fall through to the original
    // but spyOn replaces the method, so we need to provide the success case explicitly
    const originalSendMessage = FakeTelegramTransport.prototype.sendMessage
    sendSpy.mockImplementationOnce(function (this: FakeTelegramTransport, ...args) {
      return originalSendMessage.apply(transport, args)
    })

    const result = await runner.execute(sendAction)

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(3)
    expect(sendSpy).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)

    const sent = transport.getSentMessages()
    expect(sent).toHaveLength(1)
    expect(sent[0].text).toBe('Hello integration')
  })

  it('circuit breaker trips after enough failures, subsequent actions fail with CircuitOpenError', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('persistent'))

    // Each runner.execute will attempt 1 + maxRetries = 4 calls through the circuit breaker.
    // We need 5 failures to trip the circuit (failureThreshold = 5).
    // First execute: 4 failures recorded in circuit breaker -> still CLOSED.
    const result1 = await runner.execute(sendAction)
    expect(result1.success).toBe(false)
    expect(breaker.getState()).toBe(CircuitState.CLOSED)

    // Second execute: on the first attempt (5th overall failure), circuit trips to OPEN.
    // Remaining retries hit CircuitOpenError immediately.
    const result2 = await runner.execute(sendAction)
    expect(result2.success).toBe(false)
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Now a fresh action should fail immediately with CircuitOpenError
    // (the runner classifies CircuitOpenError as RETRYABLE by default via mock,
    //  but the circuit stays open so all retries also get CircuitOpenError)
    const result3 = await runner.execute(sendAction)
    expect(result3.success).toBe(false)
    expect(result3.error).toContain('Circuit breaker is OPEN')
  })

  it('idempotency dedup: same idempotency key only calls transport once', async () => {
    const sendSpy = vi.spyOn(transport, 'sendMessage')

    const action: Action = {
      ...sendAction,
      idempotencyKey: 'dedup-key-1',
    }

    const result1 = await runner.execute(action)
    expect(result1.success).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(1)

    const result2 = await runner.execute(action)
    expect(result2.success).toBe(true)
    expect(result2).toBe(result1)
    // Transport should NOT have been called a second time
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(transport.getSentMessages()).toHaveLength(1)
  })

  it('circuit recovery: trip circuit, advance time past resetTimeout, action succeeds', async () => {
    const sendSpy = vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    // Trip the circuit: need 5 failures
    for (let i = 0; i < circuitConfig.failureThreshold; i++) {
      try {
        await breaker.sendMessage('peer', 'hi')
      }
      catch {
        // expected
      }
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Advance time past the resetTimeout
    const realDateNow = Date.now
    Date.now = vi.fn(() => realDateNow() + circuitConfig.resetTimeoutMs + 100)

    // Restore transport so the probe succeeds
    sendSpy.mockRestore()

    const result = await runner.execute(sendAction)

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(1)
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect(transport.getSentMessages()).toHaveLength(1)

    Date.now = realDateNow
  })
})
