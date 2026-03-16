import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => ({
    botInstance: { findUnique: vi.fn() },
  })),
}))

import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

const mockPrisma = {
  flowEvent: { create: vi.fn() },
  flowDefinition: { findMany: vi.fn() },
  userFlowContext: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
}

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'source-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: {},
    nodeResults: new Map(),
    ...overrides,
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('emit_event action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes FlowEvent record and triggers matching flows', async () => {
    mockPrisma.flowEvent.create.mockResolvedValue({ id: 'event-1' })
    mockPrisma.flowDefinition.findMany.mockResolvedValue([
      {
        id: 'listener-flow-1',
        nodesJson: [
          { id: 'n1', type: 'custom_event', category: 'trigger', config: { eventName: 'user.verified' } },
        ],
      },
    ])

    const mockTrigger = vi.fn().mockResolvedValue(undefined)
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma
    ;(ctx as any)._taskCallbacks = { trigger: mockTrigger, triggerAndWait: vi.fn() }

    const node = createNode('emit_event', {
      eventName: 'user.verified',
      payload: { userId: 'u-123' },
    })

    const result = await executeAction(node, ctx)

    expect(mockPrisma.flowEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'user.verified',
        sourceFlowId: 'source-flow',
        sourceExecutionId: 'exec-1',
      }),
    })

    expect(mockTrigger).toHaveBeenCalledWith('flow-execution', {
      flowId: 'listener-flow-1',
      triggerData: expect.objectContaining({
        event: 'user.verified',
        userId: 'u-123',
      }),
    })

    expect(result).toEqual({
      action: 'emit_event',
      eventName: 'user.verified',
      listenersTriggered: 1,
    })
  })

  it('writes event even when no listeners exist', async () => {
    mockPrisma.flowEvent.create.mockResolvedValue({ id: 'event-2' })
    mockPrisma.flowDefinition.findMany.mockResolvedValue([])

    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma
    ;(ctx as any)._taskCallbacks = { trigger: vi.fn(), triggerAndWait: vi.fn() }

    const node = createNode('emit_event', { eventName: 'no.listeners' })
    const result = await executeAction(node, ctx)

    expect(result).toEqual({
      action: 'emit_event',
      eventName: 'no.listeners',
      listenersTriggered: 0,
    })
  })
})
