import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => ({
    botInstance: { findUnique: vi.fn() },
  })),
}))

import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

const mockPrisma = {
  userFlowContext: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: {
      platformUserId: 'user-123',
      platform: 'telegram',
    },
    nodeResults: new Map(),
    ...overrides,
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('context action nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('get_context', () => {
    it('reads value and sets it as node output', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'pl' })
      const ctx = createContext()
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('get_context', { key: 'language', defaultValue: 'en' })
      const result = await executeAction(node, ctx)

      expect(result).toEqual({ action: 'get_context', key: 'language', value: 'pl' })
    })

    it('returns defaultValue when key missing', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)
      const ctx = createContext()
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('get_context', { key: 'language', defaultValue: 'en' })
      const result = await executeAction(node, ctx)

      expect(result).toEqual({ action: 'get_context', key: 'language', value: 'en' })
    })

    it('populates context cache after reading', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'pl' })
      const ctx = createContext()
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('get_context', { key: 'language' })
      await executeAction(node, ctx)

      expect((ctx as any)._contextCache.get('language')).toBe('pl')
    })
  })

  describe('set_context', () => {
    it('writes interpolated value', async () => {
      mockPrisma.userFlowContext.upsert.mockResolvedValue({})
      const ctx = createContext({
        triggerData: { platformUserId: 'user-123', platform: 'telegram', language: 'pl' },
      })
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('set_context', { key: 'user_lang', value: '{{trigger.language}}' })
      const result = await executeAction(node, ctx)

      expect(result).toEqual({ action: 'set_context', key: 'user_lang', value: 'pl', executed: true })
      expect(mockPrisma.userFlowContext.upsert).toHaveBeenCalled()
    })
  })

  describe('delete_context', () => {
    it('deletes key', async () => {
      mockPrisma.userFlowContext.delete.mockResolvedValue({})
      const ctx = createContext()
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('delete_context', { key: 'language' })
      const result = await executeAction(node, ctx)

      expect(result).toEqual({ action: 'delete_context', key: 'language', executed: true })
    })
  })
})
