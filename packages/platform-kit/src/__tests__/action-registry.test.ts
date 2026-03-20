import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import { ActionRegistry } from '../action-registry.js'

describe('ActionRegistry', () => {
  it('registers and executes an action', async () => {
    const registry = new ActionRegistry()
    registry.register('greet', {
      schema: v.object({ name: v.string() }),
      handler: async (params) => ({ greeting: `hello ${params.name}` }),
    })
    const result = await registry.execute('greet', { name: 'world' })
    expect(result).toEqual({ success: true, data: { greeting: 'hello world' } })
  })

  it('validates params against schema', async () => {
    const registry = new ActionRegistry()
    registry.register('greet', {
      schema: v.object({ name: v.string() }),
      handler: async (params) => ({ greeting: `hello ${params.name}` }),
    })
    const result = await registry.execute('greet', { name: 123 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid')
  })

  it('returns error for unknown action', async () => {
    const registry = new ActionRegistry()
    const result = await registry.execute('unknown', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('unknown')
  })

  it('catches handler errors', async () => {
    const registry = new ActionRegistry()
    registry.register('fail', {
      schema: v.object({}),
      handler: async () => { throw new Error('boom') },
    })
    const result = await registry.execute('fail', {})
    expect(result.success).toBe(false)
    expect(result.error).toBe('boom')
  })

  it('lists registered actions', () => {
    const registry = new ActionRegistry()
    registry.register('a', { schema: v.object({}), handler: async () => ({}) })
    registry.register('b', { schema: v.object({}), handler: async () => ({}) })
    expect(registry.getActions()).toEqual(['a', 'b'])
  })

  it('checks if action is supported', () => {
    const registry = new ActionRegistry()
    registry.register('a', { schema: v.object({}), handler: async () => ({}) })
    expect(registry.supports('a')).toBe(true)
    expect(registry.supports('b')).toBe(false)
  })

  it('calls onExecute hook with timing', async () => {
    const onExecute = vi.fn()
    const registry = new ActionRegistry({ onExecute })
    registry.register('test', { schema: v.object({}), handler: async () => ({ ok: true }) })
    await registry.execute('test', {})
    expect(onExecute).toHaveBeenCalledWith('test', expect.any(Number), true)
  })

  it('calls onError hook on failure', async () => {
    const onError = vi.fn()
    const registry = new ActionRegistry({ onError })
    registry.register('fail', { schema: v.object({}), handler: async () => { throw new Error('boom') } })
    await registry.execute('fail', {})
    expect(onError).toHaveBeenCalledWith('fail', expect.any(Error))
  })

  it('prevents duplicate registration', () => {
    const registry = new ActionRegistry()
    registry.register('a', { schema: v.object({}), handler: async () => ({}) })
    expect(() => registry.register('a', { schema: v.object({}), handler: async () => ({}) })).toThrow('already registered')
  })
})
