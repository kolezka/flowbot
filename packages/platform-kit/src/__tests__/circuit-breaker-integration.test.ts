import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import { CircuitBreaker, CircuitState, CircuitOpenError } from '../circuit-breaker.js'
import { ActionRegistry } from '../action-registry.js'
import type { Logger } from 'pino'

const makeLogger = (): Logger => {
  const logger = {
    child: () => logger,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger
  return logger
}

function wrapRegistryWithBreaker(
  registry: ActionRegistry,
  config: Parameters<typeof CircuitBreaker>[1],
): CircuitBreaker {
  const logger = makeLogger()
  return new CircuitBreaker(
    (action, params) => {
      // Propagate the ActionRegistry error for failure actions so the breaker
      // counts them. Successful registry results are returned as-is.
      return registry.execute(action, params).then((result) => {
        if (!result.success) throw new Error(result.error ?? 'Action failed')
        return result
      })
    },
    config,
    logger,
  )
}

describe('CircuitBreaker + ActionRegistry integration', () => {
  it('successful actions do not affect circuit state', async () => {
    const registry = new ActionRegistry()
    registry.register('greet', {
      schema: v.object({ name: v.string() }),
      handler: async ({ name }) => `Hello, ${name}!`,
    })

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 3,
      resetTimeoutMs: 100,
      windowMs: 5000,
    })

    const r1 = await breaker.call('greet', { name: 'Alice' })
    const r2 = await breaker.call('greet', { name: 'Bob' })
    const r3 = await breaker.call('greet', { name: 'Carol' })

    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect((r1 as any).data).toBe('Hello, Alice!')
    expect((r2 as any).data).toBe('Hello, Bob!')
    expect((r3 as any).data).toBe('Hello, Carol!')
  })

  it('opens circuit after failure threshold is reached', async () => {
    const registry = new ActionRegistry()
    registry.register('explode', {
      schema: v.object({}),
      handler: async () => { throw new Error('boom') },
    })

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      windowMs: 10000,
    })

    // First 3 calls should throw the underlying error and count as failures
    await expect(breaker.call('explode', {})).rejects.toThrow('boom')
    await expect(breaker.call('explode', {})).rejects.toThrow('boom')
    await expect(breaker.call('explode', {})).rejects.toThrow('boom')

    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // 4th call is rejected by the circuit breaker itself — underlying fn never called
    await expect(breaker.call('explode', {})).rejects.toThrow(CircuitOpenError)
  })

  it('rejects all calls with CircuitOpenError when OPEN', async () => {
    const registry = new ActionRegistry()
    let callCount = 0
    registry.register('count', {
      schema: v.object({}),
      handler: async () => { callCount++; throw new Error('fail') },
    })

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 2,
      resetTimeoutMs: 5000,
      windowMs: 10000,
    })

    await expect(breaker.call('count', {})).rejects.toThrow('fail')
    await expect(breaker.call('count', {})).rejects.toThrow('fail')
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    const callsBefore = callCount

    // These should be short-circuited — registry handler must NOT be invoked
    await expect(breaker.call('count', {})).rejects.toThrow(CircuitOpenError)
    await expect(breaker.call('count', {})).rejects.toThrow(CircuitOpenError)

    expect(callCount).toBe(callsBefore)
  })

  it('transitions to HALF_OPEN after reset timeout and closes on probe success', async () => {
    const registry = new ActionRegistry()
    let shouldFail = true

    registry.register('flaky', {
      schema: v.object({}),
      handler: async () => {
        if (shouldFail) throw new Error('still broken')
        return { recovered: true }
      },
    })

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 2,
      resetTimeoutMs: 80,
      windowMs: 10000,
    })

    // Trip the circuit
    await expect(breaker.call('flaky', {})).rejects.toThrow()
    await expect(breaker.call('flaky', {})).rejects.toThrow()
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 100))

    // Now fix the underlying service
    shouldFail = false

    // Probe call should succeed and close the circuit
    const probeResult = await breaker.call('flaky', {})
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect((probeResult as any).data).toEqual({ recovered: true })
  })

  it('re-opens circuit when half-open probe fails', async () => {
    const registry = new ActionRegistry()
    registry.register('always-fail', {
      schema: v.object({}),
      handler: async () => { throw new Error('still down') },
    })

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 2,
      resetTimeoutMs: 80,
      windowMs: 10000,
    })

    // Trip the circuit
    await expect(breaker.call('always-fail', {})).rejects.toThrow()
    await expect(breaker.call('always-fail', {})).rejects.toThrow()
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 100))

    // Probe call fails → back to OPEN
    await expect(breaker.call('always-fail', {})).rejects.toThrow('still down')
    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('mixed success/failure: only counts failures toward threshold', async () => {
    const registry = new ActionRegistry()
    let callIndex = 0
    // Pattern: success, fail, success, fail — 2 failures within window, threshold=3
    registry.register('mixed', {
      schema: v.object({}),
      handler: async () => {
        const idx = callIndex++
        if (idx % 2 === 1) throw new Error('intermittent failure')
        return { idx }
      },
    })

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 3,
      resetTimeoutMs: 100,
      windowMs: 10000,
    })

    await expect(breaker.call('mixed', {})).resolves.toBeDefined()  // idx=0 success
    await expect(breaker.call('mixed', {})).rejects.toThrow()       // idx=1 fail (1)
    await expect(breaker.call('mixed', {})).resolves.toBeDefined()  // idx=2 success
    await expect(breaker.call('mixed', {})).rejects.toThrow()       // idx=3 fail (2)

    // Only 2 failures, threshold is 3 → still CLOSED
    expect(breaker.getState()).toBe(CircuitState.CLOSED)

    await expect(breaker.call('mixed', {})).resolves.toBeDefined()  // idx=4 success
    await expect(breaker.call('mixed', {})).rejects.toThrow()       // idx=5 fail (3) → OPEN

    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('circuit resets after sliding window expires', async () => {
    const registry = new ActionRegistry()
    registry.register('slow-recover', {
      schema: v.object({}),
      handler: async () => { throw new Error('temporary failure') },
    })

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      windowMs: 100, // very short window
    })

    // Two failures — not enough to open
    await expect(breaker.call('slow-recover', {})).rejects.toThrow()
    await expect(breaker.call('slow-recover', {})).rejects.toThrow()
    expect(breaker.getState()).toBe(CircuitState.CLOSED)

    // Wait for the failure window to expire
    await new Promise(r => setTimeout(r, 150))

    // Two more failures after window expired — old failures no longer counted
    await expect(breaker.call('slow-recover', {})).rejects.toThrow()
    await expect(breaker.call('slow-recover', {})).rejects.toThrow()

    // Should still be CLOSED since window rolled over (threshold=3, only 2 in current window)
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('validation errors from ActionRegistry count as failures', async () => {
    const registry = new ActionRegistry()
    registry.register('strict', {
      schema: v.object({ id: v.number() }),
      handler: async ({ id }) => ({ id }),
    })

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 2,
      resetTimeoutMs: 5000,
      windowMs: 10000,
    })

    // Send wrong type — registry returns { success: false } which breaker treats as failure
    await expect(breaker.call('strict', { id: 'not-a-number' })).rejects.toThrow()
    await expect(breaker.call('strict', { id: 'not-a-number' })).rejects.toThrow()

    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('unregistered action errors count as failures', async () => {
    const registry = new ActionRegistry()
    // No actions registered

    const breaker = wrapRegistryWithBreaker(registry, {
      failureThreshold: 2,
      resetTimeoutMs: 5000,
      windowMs: 10000,
    })

    await expect(breaker.call('ghost', {})).rejects.toThrow()
    await expect(breaker.call('ghost', {})).rejects.toThrow()

    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })
})
