import { describe, it, expect, vi } from 'vitest'

// Mock prisma dependency used by actions.ts (executeBotAction)
vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => ({
    botInstance: {
      findUnique: vi.fn(),
    },
  })),
}))

import { executeFlow } from '../lib/flow-engine/executor.js'
import { interpolate, setVariable, getVariable } from '../lib/flow-engine/variables.js'
import { evaluateCondition } from '../lib/flow-engine/conditions.js'
import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode, FlowEdge } from '../lib/flow-engine/types.js'

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: {},
    nodeResults: new Map(),
    ...overrides,
  }
}

// --- Variable Interpolation ---
describe('interpolate', () => {
  it('should replace trigger data variables', () => {
    const ctx = createContext({ triggerData: { chatId: '12345', userName: 'Alice' } })
    const result = interpolate('Hello {{trigger.userName}} in chat {{trigger.chatId}}', ctx)
    expect(result).toBe('Hello Alice in chat 12345')
  })

  it('should replace context variables', () => {
    const ctx = createContext()
    ctx.variables.set('greeting', 'Hi')
    const result = interpolate('{{greeting}} there', ctx)
    expect(result).toBe('Hi there')
  })

  it('should replace node result references', () => {
    const ctx = createContext()
    ctx.nodeResults.set('node1', {
      nodeId: 'node1',
      status: 'success',
      output: { message: 'done' },
      startedAt: new Date(),
      completedAt: new Date(),
    })
    const result = interpolate('Result: {{node.node1.message}}', ctx)
    expect(result).toBe('Result: done')
  })

  it('should leave unresolved variables as-is', () => {
    const ctx = createContext()
    const result = interpolate('{{missing}} stays', ctx)
    expect(result).toBe('{{missing}} stays')
  })

  it('should handle nested trigger data', () => {
    const ctx = createContext({ triggerData: { user: { name: 'Bob' } } })
    const result = interpolate('{{trigger.user.name}}', ctx)
    expect(result).toBe('Bob')
  })

  it('should leave unresolved node references as-is', () => {
    const ctx = createContext()
    const result = interpolate('{{node.missing.value}}', ctx)
    expect(result).toBe('{{node.missing.value}}')
  })
})

describe('setVariable / getVariable', () => {
  it('should set and get variables', () => {
    const ctx = createContext()
    setVariable(ctx, 'key', 'value')
    expect(getVariable(ctx, 'key')).toBe('value')
  })

  it('should return undefined for missing variables', () => {
    const ctx = createContext()
    expect(getVariable(ctx, 'missing')).toBeUndefined()
  })
})

// --- Condition Evaluators ---
describe('evaluateCondition', () => {
  describe('keyword_match', () => {
    it('should match any keyword (default mode)', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'keyword_match', category: 'condition', label: 'KW',
        config: { keywords: ['hello', 'world'] },
      }
      const ctx = createContext({ triggerData: { text: 'say hello' } })
      expect(await evaluateCondition(node, ctx)).toBe(true)
    })

    it('should not match when no keywords found', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'keyword_match', category: 'condition', label: 'KW',
        config: { keywords: ['foo', 'bar'] },
      }
      const ctx = createContext({ triggerData: { text: 'hello world' } })
      expect(await evaluateCondition(node, ctx)).toBe(false)
    })

    it('should match all keywords when mode is "all"', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'keyword_match', category: 'condition', label: 'KW',
        config: { keywords: ['hello', 'world'], mode: 'all' },
      }
      const ctx = createContext({ triggerData: { text: 'hello beautiful world' } })
      expect(await evaluateCondition(node, ctx)).toBe(true)
    })

    it('should fail "all" mode if one keyword missing', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'keyword_match', category: 'condition', label: 'KW',
        config: { keywords: ['hello', 'world'], mode: 'all' },
      }
      const ctx = createContext({ triggerData: { text: 'hello there' } })
      expect(await evaluateCondition(node, ctx)).toBe(false)
    })

    it('should be case-insensitive', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'keyword_match', category: 'condition', label: 'KW',
        config: { keywords: ['HELLO'] },
      }
      const ctx = createContext({ triggerData: { text: 'hello World' } })
      expect(await evaluateCondition(node, ctx)).toBe(true)
    })

    it('should handle empty text', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'keyword_match', category: 'condition', label: 'KW',
        config: { keywords: ['hello'] },
      }
      const ctx = createContext({ triggerData: {} })
      expect(await evaluateCondition(node, ctx)).toBe(false)
    })
  })

  describe('user_role', () => {
    it('should match when user has required role', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'user_role', category: 'condition', label: 'Role',
        config: { roles: ['admin', 'moderator'] },
      }
      const ctx = createContext({ triggerData: { userRole: 'admin' } })
      expect(await evaluateCondition(node, ctx)).toBe(true)
    })

    it('should not match when user lacks required role', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'user_role', category: 'condition', label: 'Role',
        config: { roles: ['admin'] },
      }
      const ctx = createContext({ triggerData: { userRole: 'member' } })
      expect(await evaluateCondition(node, ctx)).toBe(false)
    })

    it('should default to "member" when no userRole in trigger data', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'user_role', category: 'condition', label: 'Role',
        config: { roles: ['member'] },
      }
      const ctx = createContext({ triggerData: {} })
      expect(await evaluateCondition(node, ctx)).toBe(true)
    })
  })

  describe('time_based', () => {
    it('should return true when current hour is within range', async () => {
      const currentHour = new Date().getHours()
      const node: FlowNode = {
        id: 'c1', type: 'time_based', category: 'condition', label: 'Time',
        config: { startHour: currentHour, endHour: currentHour + 1 },
      }
      const ctx = createContext()
      expect(await evaluateCondition(node, ctx)).toBe(true)
    })

    it('should return false when current hour is outside range', async () => {
      const currentHour = new Date().getHours()
      // Pick a range that definitely excludes the current hour
      const startHour = (currentHour + 2) % 24
      const endHour = (currentHour + 3) % 24
      const node: FlowNode = {
        id: 'c1', type: 'time_based', category: 'condition', label: 'Time',
        config: { startHour, endHour },
      }
      const ctx = createContext()
      // This may or may not pass depending on edge cases with hour wrap, but the logic is straightforward
      expect(await evaluateCondition(node, ctx)).toBe(false)
    })
  })

  describe('unknown type', () => {
    it('should default to true for unknown condition types', async () => {
      const node: FlowNode = {
        id: 'c1', type: 'unknown_type', category: 'condition', label: 'Unknown',
        config: {},
      }
      const ctx = createContext()
      expect(await evaluateCondition(node, ctx)).toBe(true)
    })
  })
})

// --- Action Executors ---
describe('executeAction', () => {
  describe('send_message', () => {
    it('should interpolate chatId and text', async () => {
      const node: FlowNode = {
        id: 'a1', type: 'send_message', category: 'action', label: 'Send',
        config: { chatId: '{{trigger.chatId}}', text: 'Hello {{trigger.userName}}!' },
      }
      const ctx = createContext({ triggerData: { chatId: '123', userName: 'Alice' } })
      const result = await executeAction(node, ctx) as any
      expect(result.chatId).toBe('123')
      expect(result.text).toBe('Hello Alice!')
      expect(result.executed).toBe(true)
    })
  })

  describe('forward_message', () => {
    it('should interpolate from/to chat IDs', async () => {
      const node: FlowNode = {
        id: 'a1', type: 'forward_message', category: 'action', label: 'Forward',
        config: { fromChatId: '{{trigger.chatId}}', toChatId: '999' },
      }
      const ctx = createContext({ triggerData: { chatId: '111', messageId: 42 } })
      const result = await executeAction(node, ctx) as any
      expect(result.fromChatId).toBe('111')
      expect(result.toChatId).toBe('999')
      expect(result.messageId).toBe(42)
    })
  })

  describe('ban_user', () => {
    it('should interpolate userId and chatId', async () => {
      const node: FlowNode = {
        id: 'a1', type: 'ban_user', category: 'action', label: 'Ban',
        config: { reason: 'Spam' },
      }
      const ctx = createContext({ triggerData: { chatId: '111', userId: '222' } })
      const result = await executeAction(node, ctx) as any
      expect(result.chatId).toBe('111')
      expect(result.userId).toBe('222')
      expect(result.reason).toBe('Spam')
    })
  })

  describe('mute_user', () => {
    it('should use default duration of 3600', async () => {
      const node: FlowNode = {
        id: 'a1', type: 'mute_user', category: 'action', label: 'Mute',
        config: {},
      }
      const ctx = createContext({ triggerData: { chatId: '111', userId: '222' } })
      const result = await executeAction(node, ctx) as any
      expect(result.duration).toBe(3600)
    })

    it('should use configured duration', async () => {
      const node: FlowNode = {
        id: 'a1', type: 'mute_user', category: 'action', label: 'Mute',
        config: { durationSeconds: 7200 },
      }
      const ctx = createContext({ triggerData: { chatId: '111', userId: '222' } })
      const result = await executeAction(node, ctx) as any
      expect(result.duration).toBe(7200)
    })
  })

  describe('delay', () => {
    it('should return delay info', async () => {
      const node: FlowNode = {
        id: 'a1', type: 'delay', category: 'action', label: 'Delay',
        config: { delayMs: 500 },
      }
      const ctx = createContext()
      const result = await executeAction(node, ctx) as any
      expect(result.action).toBe('delay')
      expect(result.ms).toBe(500)
    })
  })

  describe('unknown action', () => {
    it('should throw for unknown action types', async () => {
      const node: FlowNode = {
        id: 'a1', type: 'totally_unknown', category: 'action', label: 'Unknown',
        config: {},
      }
      const ctx = createContext()
      await expect(executeAction(node, ctx)).rejects.toThrow('Unknown action type: totally_unknown')
    })
  })
})

// --- Executor (graph walking) ---
describe('executeFlow', () => {
  it('should execute a simple trigger -> action flow', async () => {
    const nodes: FlowNode[] = [
      { id: 't1', type: 'message_received', category: 'trigger', label: 'Trigger', config: {} },
      { id: 'a1', type: 'send_message', category: 'action', label: 'Send', config: { text: 'hello' } },
    ]
    const edges: FlowEdge[] = [{ id: 'e1', source: 't1', target: 'a1' }]

    const ctx = await executeFlow(nodes, edges, { chatId: '123' })

    expect(ctx.nodeResults.get('t1')?.status).toBe('success')
    expect(ctx.nodeResults.get('a1')?.status).toBe('success')
  })

  it('should stop at failing condition', async () => {
    const nodes: FlowNode[] = [
      { id: 't1', type: 'message_received', category: 'trigger', label: 'Trigger', config: {} },
      { id: 'c1', type: 'keyword_match', category: 'condition', label: 'Check', config: { keywords: ['secret'] } },
      { id: 'a1', type: 'send_message', category: 'action', label: 'Send', config: { text: 'matched' } },
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'c1' },
      { id: 'e2', source: 'c1', target: 'a1' },
    ]

    const ctx = await executeFlow(nodes, edges, { text: 'no match here' })

    expect(ctx.nodeResults.get('c1')?.status).toBe('success')
    expect(ctx.nodeResults.get('c1')?.output).toBe(false)
    // Action should NOT have been executed since condition failed
    expect(ctx.nodeResults.has('a1')).toBe(false)
  })

  it('should continue past condition when it passes', async () => {
    const nodes: FlowNode[] = [
      { id: 't1', type: 'message_received', category: 'trigger', label: 'Trigger', config: {} },
      { id: 'c1', type: 'keyword_match', category: 'condition', label: 'Check', config: { keywords: ['hello'] } },
      { id: 'a1', type: 'send_message', category: 'action', label: 'Send', config: { text: 'matched!' } },
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'c1' },
      { id: 'e2', source: 'c1', target: 'a1' },
    ]

    const ctx = await executeFlow(nodes, edges, { text: 'hello world' })

    expect(ctx.nodeResults.get('a1')?.status).toBe('success')
  })

  it('should respect maxNodes limit', async () => {
    const nodes: FlowNode[] = [
      { id: 't1', type: 'trigger', category: 'trigger', label: 'Trigger', config: {} },
      { id: 'a1', type: 'send_message', category: 'action', label: 'A1', config: { text: '1' } },
      { id: 'a2', type: 'send_message', category: 'action', label: 'A2', config: { text: '2' } },
      { id: 'a3', type: 'send_message', category: 'action', label: 'A3', config: { text: '3' } },
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'a1' },
      { id: 'e2', source: 'a1', target: 'a2' },
      { id: 'e3', source: 'a2', target: 'a3' },
    ]

    const ctx = await executeFlow(nodes, edges, {}, { maxNodes: 2 })

    // Should only execute 2 nodes (trigger + a1)
    expect(ctx.nodeResults.size).toBe(2)
    expect(ctx.nodeResults.has('a3')).toBe(false)
  })

  it('should stop execution on error with default error handling', async () => {
    const nodes: FlowNode[] = [
      { id: 't1', type: 'trigger', category: 'trigger', label: 'Trigger', config: {} },
      { id: 'a1', type: 'totally_unknown', category: 'action', label: 'Bad', config: {} },
      { id: 'a2', type: 'send_message', category: 'action', label: 'After', config: { text: 'x' } },
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'a1' },
      { id: 'e2', source: 'a1', target: 'a2' },
    ]

    const ctx = await executeFlow(nodes, edges, {})

    expect(ctx.nodeResults.get('a1')?.status).toBe('error')
    expect(ctx.nodeResults.has('a2')).toBe(false)
  })

  it('should skip errored node and continue with "skip" error handling', async () => {
    const nodes: FlowNode[] = [
      { id: 't1', type: 'trigger', category: 'trigger', label: 'Trigger', config: {} },
      { id: 'a1', type: 'totally_unknown', category: 'action', label: 'Bad', config: { errorHandling: 'skip' } },
      { id: 'a2', type: 'send_message', category: 'action', label: 'After', config: { text: 'continued' } },
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'a1' },
      { id: 'e2', source: 'a1', target: 'a2' },
    ]

    const ctx = await executeFlow(nodes, edges, {})

    expect(ctx.nodeResults.get('a1')?.status).toBe('error')
    expect(ctx.nodeResults.get('a2')?.status).toBe('success')
  })

  it('should not visit same node twice', async () => {
    // Diamond graph: t1 -> a1, t1 -> a2, a1 -> a3, a2 -> a3
    const nodes: FlowNode[] = [
      { id: 't1', type: 'trigger', category: 'trigger', label: 'Trigger', config: {} },
      { id: 'a1', type: 'send_message', category: 'action', label: 'A1', config: { text: '1' } },
      { id: 'a2', type: 'send_message', category: 'action', label: 'A2', config: { text: '2' } },
      { id: 'a3', type: 'send_message', category: 'action', label: 'A3', config: { text: '3' } },
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'a1' },
      { id: 'e2', source: 't1', target: 'a2' },
      { id: 'e3', source: 'a1', target: 'a3' },
      { id: 'e4', source: 'a2', target: 'a3' },
    ]

    const ctx = await executeFlow(nodes, edges, {})

    // a3 should be executed exactly once
    expect(ctx.nodeResults.get('a3')?.status).toBe('success')
    expect(ctx.nodeResults.size).toBe(4)
  })

  it('should handle empty flow gracefully', async () => {
    const ctx = await executeFlow([], [], {})
    expect(ctx.nodeResults.size).toBe(0)
  })
})
