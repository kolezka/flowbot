import { describe, it, expect } from 'vitest'
import { interpolate } from '../lib/flow-engine/variables.js'
import type { FlowContext } from '../lib/flow-engine/types.js'

function createContext(): FlowContext {
  const ctx: FlowContext = {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: { platformUserId: 'user-123', platform: 'telegram' },
    nodeResults: new Map(),
  }
  ;(ctx as any)._contextCache = new Map<string, unknown>()
  return ctx
}

describe('context.* variable interpolation', () => {
  it('resolves {{context.language}} from cache', () => {
    const ctx = createContext()
    ;(ctx as any)._contextCache.set('language', 'pl')

    const result = interpolate('Language: {{context.language}}', ctx)
    expect(result).toBe('Language: pl')
  })

  it('leaves {{context.missing}} as-is when not in cache', () => {
    const ctx = createContext()

    const result = interpolate('Val: {{context.missing}}', ctx)
    expect(result).toBe('Val: {{context.missing}}')
  })

  it('handles multiple context variables in one template', () => {
    const ctx = createContext()
    ;(ctx as any)._contextCache.set('name', 'Jan')
    ;(ctx as any)._contextCache.set('lang', 'pl')

    const result = interpolate('Hello {{context.name}}, lang={{context.lang}}', ctx)
    expect(result).toBe('Hello Jan, lang=pl')
  })

  it('mixes context.* with trigger.* in same template', () => {
    const ctx = createContext()
    ;(ctx as any)._contextCache.set('step', '3')

    const result = interpolate('User {{trigger.platformUserId}} at step {{context.step}}', ctx)
    expect(result).toBe('User user-123 at step 3')
  })
})
