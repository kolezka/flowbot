import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => ({
    botInstance: { findUnique: vi.fn() },
  })),
}))

import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'parent-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: { _chainDepth: 0 },
    nodeResults: new Map(),
    ...overrides,
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('run_flow action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls triggerAndWait when waitForResult is true', async () => {
    const mockTriggerAndWait = vi.fn().mockResolvedValue({ ok: true, output: { result: 'done' } })
    const ctx = createContext()
    ;(ctx as any)._taskCallbacks = {
      triggerAndWait: mockTriggerAndWait,
      trigger: vi.fn(),
    }

    const node = createNode('run_flow', {
      flowId: 'child-flow',
      waitForResult: true,
      inputVariables: { greeting: 'hello' },
    })

    const result = await executeAction(node, ctx)

    expect(mockTriggerAndWait).toHaveBeenCalledWith('flow-execution', {
      flowId: 'child-flow',
      triggerData: { greeting: 'hello', _chainDepth: 1 },
    })
    expect(result).toEqual({
      action: 'run_flow',
      flowId: 'child-flow',
      waitForResult: true,
      output: { result: 'done' },
    })
  })

  it('calls trigger (fire-and-forget) when waitForResult is false', async () => {
    const mockTrigger = vi.fn().mockResolvedValue(undefined)
    const ctx = createContext()
    ;(ctx as any)._taskCallbacks = {
      triggerAndWait: vi.fn(),
      trigger: mockTrigger,
    }

    const node = createNode('run_flow', {
      flowId: 'child-flow',
      waitForResult: false,
    })

    const result = await executeAction(node, ctx)

    expect(mockTrigger).toHaveBeenCalledWith('flow-execution', {
      flowId: 'child-flow',
      triggerData: { _chainDepth: 1 },
    })
    expect(result).toEqual({
      action: 'run_flow',
      flowId: 'child-flow',
      waitForResult: false,
      fired: true,
    })
  })

  it('throws when chain depth exceeds max (5)', async () => {
    const ctx = createContext({
      triggerData: { _chainDepth: 5 },
    })
    ;(ctx as any)._taskCallbacks = {
      triggerAndWait: vi.fn(),
      trigger: vi.fn(),
    }

    const node = createNode('run_flow', { flowId: 'child-flow', waitForResult: true })

    await expect(executeAction(node, ctx)).rejects.toThrow('Maximum chain depth')
  })

  it('throws when taskCallbacks not available', async () => {
    const ctx = createContext()
    const node = createNode('run_flow', { flowId: 'child-flow', waitForResult: true })

    await expect(executeAction(node, ctx)).rejects.toThrow('taskCallbacks')
  })
})
