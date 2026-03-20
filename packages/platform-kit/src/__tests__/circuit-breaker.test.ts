import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitBreaker, CircuitState, CircuitOpenError } from '../circuit-breaker.js'
import type { Logger } from 'pino'

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger

describe('CircuitBreaker', () => {
  let executeFn: ReturnType<typeof vi.fn>
  let breaker: CircuitBreaker

  beforeEach(() => {
    executeFn = vi.fn().mockResolvedValue({ success: true, data: 'ok' })
    breaker = new CircuitBreaker(executeFn, { failureThreshold: 2, resetTimeoutMs: 100, windowMs: 1000 }, mockLogger)
  })

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('delegates calls to wrapped function', async () => {
    const result = await breaker.call('test_action', { key: 'val' })
    expect(executeFn).toHaveBeenCalledWith('test_action', { key: 'val' })
    expect(result).toEqual({ success: true, data: 'ok' })
  })

  it('opens after failure threshold', async () => {
    executeFn.mockRejectedValue(new Error('fail'))
    await expect(breaker.call('a', {})).rejects.toThrow('fail')
    await expect(breaker.call('b', {})).rejects.toThrow('fail')
    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('rejects calls when OPEN', async () => {
    executeFn.mockRejectedValue(new Error('fail'))
    await expect(breaker.call('a', {})).rejects.toThrow()
    await expect(breaker.call('b', {})).rejects.toThrow()
    await expect(breaker.call('c', {})).rejects.toThrow(CircuitOpenError)
    expect(executeFn).toHaveBeenCalledTimes(2)
  })

  it('transitions to HALF_OPEN after reset timeout', async () => {
    executeFn.mockRejectedValue(new Error('fail'))
    await expect(breaker.call('a', {})).rejects.toThrow()
    await expect(breaker.call('b', {})).rejects.toThrow()
    await new Promise(r => setTimeout(r, 150))
    executeFn.mockResolvedValue({ success: true })
    const result = await breaker.call('probe', {})
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect(result).toEqual({ success: true })
  })

  it('re-opens on probe failure in HALF_OPEN', async () => {
    executeFn.mockRejectedValue(new Error('fail'))
    await expect(breaker.call('a', {})).rejects.toThrow()
    await expect(breaker.call('b', {})).rejects.toThrow()
    await new Promise(r => setTimeout(r, 150))
    await expect(breaker.call('probe', {})).rejects.toThrow('fail')
    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('does not count successes as failures', async () => {
    await breaker.call('ok1', {})
    await breaker.call('ok2', {})
    await breaker.call('ok3', {})
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })
})
