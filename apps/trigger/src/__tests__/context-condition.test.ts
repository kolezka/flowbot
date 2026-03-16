import { describe, it, expect, vi, beforeEach } from 'vitest'
import { evaluateCondition } from '../lib/flow-engine/conditions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

const mockPrisma = {
  userFlowContext: {
    findUnique: vi.fn(),
  },
}

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: { platformUserId: 'user-123', platform: 'telegram' },
    nodeResults: new Map(),
    ...overrides,
  }
}

function createNode(config: Record<string, unknown>): FlowNode {
  return { id: 'cond-1', type: 'context_condition', category: 'condition', label: 'Context Condition', config }
}

describe('context_condition evaluator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when key exists and operator is "exists"', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'anything' })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const result = await evaluateCondition(createNode({ key: 'language', operator: 'exists' }), ctx)
    expect(result).toBe(true)
  })

  it('returns false when key does not exist and operator is "exists"', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const result = await evaluateCondition(createNode({ key: 'language', operator: 'exists' }), ctx)
    expect(result).toBe(false)
  })

  it('returns true when value equals expected', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'pl' })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const result = await evaluateCondition(createNode({ key: 'language', operator: 'equals', value: 'pl' }), ctx)
    expect(result).toBe(true)
  })

  it('returns false when value does not equal expected', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'en' })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const result = await evaluateCondition(createNode({ key: 'language', operator: 'equals', value: 'pl' }), ctx)
    expect(result).toBe(false)
  })

  it('returns true when numeric value is greater than threshold', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 5 })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const result = await evaluateCondition(createNode({ key: 'score', operator: 'gt', value: 3 }), ctx)
    expect(result).toBe(true)
  })

  it('returns true when string value contains substring', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'hello world' })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const result = await evaluateCondition(createNode({ key: 'greeting', operator: 'contains', value: 'world' }), ctx)
    expect(result).toBe(true)
  })

  it('returns false when prisma not available', async () => {
    const ctx = createContext()
    const result = await evaluateCondition(createNode({ key: 'language', operator: 'exists' }), ctx)
    expect(result).toBe(false)
  })
})
