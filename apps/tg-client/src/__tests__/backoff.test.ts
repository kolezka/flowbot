import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateBackoff, sleep } from '../errors/backoff.js'

describe('calculateBackoff', () => {
  it('returns increasing delays for successive attempts', () => {
    // Use fixed random to test base exponential growth
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const delay0 = calculateBackoff(0, 1000, 60000)
    const delay1 = calculateBackoff(1, 1000, 60000)
    const delay2 = calculateBackoff(2, 1000, 60000)

    expect(delay0).toBe(1000) // 1000 * 2^0 = 1000, jitter=0
    expect(delay1).toBe(2000) // 1000 * 2^1 = 2000, jitter=0
    expect(delay2).toBe(4000) // 1000 * 2^2 = 4000, jitter=0
    expect(delay1).toBeGreaterThan(delay0)
    expect(delay2).toBeGreaterThan(delay1)

    vi.restoreAllMocks()
  })

  it('adds jitter within 0-25% range', () => {
    // With random = 1, jitter = capped * 0.25 * 1 = 25% of base
    vi.spyOn(Math, 'random').mockReturnValue(1)

    const delay = calculateBackoff(0, 1000, 60000)
    // exponential = 1000, capped = 1000, jitter = 1000 * 0.25 * 1 = 250
    expect(delay).toBe(1250)

    vi.restoreAllMocks()
  })

  it('jitter is between 0% and 25% of capped value', () => {
    const baseMs = 1000
    const maxMs = 60000
    const attempt = 3
    const exponential = Math.min(baseMs * 2 ** attempt, maxMs) // 8000

    // Run multiple times with real random
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoff(attempt, baseMs, maxMs)
      expect(delay).toBeGreaterThanOrEqual(exponential)
      expect(delay).toBeLessThanOrEqual(Math.floor(exponential * 1.25))
    }
  })

  it('caps delay at maxMs (plus jitter)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    // attempt=10 -> 1000 * 2^10 = 1024000, but capped at 60000
    const delay = calculateBackoff(10, 1000, 60000)
    expect(delay).toBe(60000)

    vi.restoreAllMocks()
  })

  it('caps delay at maxMs with max jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)

    const delay = calculateBackoff(10, 1000, 60000)
    // capped = 60000, jitter = 60000 * 0.25 * 1 = 15000
    expect(delay).toBe(75000)

    vi.restoreAllMocks()
  })

  it('uses default baseMs and maxMs when not provided', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const delay = calculateBackoff(0)
    expect(delay).toBe(1000) // default base 1000, 2^0 = 1

    const delayHigh = calculateBackoff(20)
    expect(delayHigh).toBe(60000) // default max 60000

    vi.restoreAllMocks()
  })
})

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves after the specified delay', async () => {
    let resolved = false
    const promise = sleep(1000).then(() => { resolved = true })

    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(999)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await promise
    expect(resolved).toBe(true)
  })

  it('resolves immediately for 0ms', async () => {
    let resolved = false
    const promise = sleep(0).then(() => { resolved = true })

    await vi.advanceTimersByTimeAsync(0)
    await promise
    expect(resolved).toBe(true)
  })
})
