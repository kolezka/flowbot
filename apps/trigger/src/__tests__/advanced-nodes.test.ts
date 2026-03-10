import { describe, it, expect, vi } from 'vitest'
import {
  executeLoop,
  evaluateSwitch,
  executeTransform,
  executeNotification,
} from '../lib/flow-engine/advanced-nodes.js'
import { getTemplate, FLOW_TEMPLATES } from '../lib/flow-engine/templates.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

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

// --- Loop Node ---
describe('executeLoop', () => {
  it('should iterate over array variable and call children for each item', async () => {
    const node: FlowNode = {
      id: 'loop1', type: 'loop', category: 'control', label: 'Loop',
      config: { arrayVariable: 'items' },
    }
    const ctx = createContext()
    ctx.variables.set('items', ['a', 'b', 'c'])

    const calls: Array<{ item: unknown; index: number }> = []
    const executeChildren = vi.fn(async (item: unknown, index: number) => {
      calls.push({ item, index })
    })

    const result = await executeLoop(node, ctx, executeChildren) as any

    expect(result.loopCount).toBe(3)
    expect(calls).toEqual([
      { item: 'a', index: 0 },
      { item: 'b', index: 1 },
      { item: 'c', index: 2 },
    ])
    expect(executeChildren).toHaveBeenCalledTimes(3)
  })

  it('should set loop.index and loop.item during iteration', async () => {
    const node: FlowNode = {
      id: 'loop1', type: 'loop', category: 'control', label: 'Loop',
      config: { arrayVariable: 'items' },
    }
    const ctx = createContext()
    ctx.variables.set('items', ['x', 'y'])

    const capturedVars: Array<{ index: unknown; item: unknown }> = []
    await executeLoop(node, ctx, async () => {
      capturedVars.push({
        index: ctx.variables.get('loop.index'),
        item: ctx.variables.get('loop.item'),
      })
    })

    expect(capturedVars).toEqual([
      { index: 0, item: 'x' },
      { index: 1, item: 'y' },
    ])
  })

  it('should clean up loop variables after execution', async () => {
    const node: FlowNode = {
      id: 'loop1', type: 'loop', category: 'control', label: 'Loop',
      config: { arrayVariable: 'items' },
    }
    const ctx = createContext()
    ctx.variables.set('items', ['a'])

    await executeLoop(node, ctx, async () => {})

    expect(ctx.variables.has('loop.index')).toBe(false)
    expect(ctx.variables.has('loop.item')).toBe(false)
  })

  it('should return error info when variable is not an array', async () => {
    const node: FlowNode = {
      id: 'loop1', type: 'loop', category: 'control', label: 'Loop',
      config: { arrayVariable: 'notAnArray' },
    }
    const ctx = createContext()
    ctx.variables.set('notAnArray', 'string value')

    const result = await executeLoop(node, ctx, vi.fn()) as any

    expect(result.loopCount).toBe(0)
    expect(result.error).toContain('not an array')
  })

  it('should return error when variable does not exist', async () => {
    const node: FlowNode = {
      id: 'loop1', type: 'loop', category: 'control', label: 'Loop',
      config: { arrayVariable: 'missing' },
    }
    const ctx = createContext()

    const result = await executeLoop(node, ctx, vi.fn()) as any

    expect(result.loopCount).toBe(0)
    expect(result.error).toContain('not an array')
  })

  it('should handle empty array', async () => {
    const node: FlowNode = {
      id: 'loop1', type: 'loop', category: 'control', label: 'Loop',
      config: { arrayVariable: 'items' },
    }
    const ctx = createContext()
    ctx.variables.set('items', [])

    const executeChildren = vi.fn()
    const result = await executeLoop(node, ctx, executeChildren) as any

    expect(result.loopCount).toBe(0)
    expect(executeChildren).not.toHaveBeenCalled()
  })
})

// --- Switch Node ---
describe('evaluateSwitch', () => {
  it('should match a case and return its output', () => {
    const node: FlowNode = {
      id: 'sw1', type: 'switch', category: 'control', label: 'Switch',
      config: {
        switchValue: '{{trigger.action}}',
        cases: [
          { value: 'buy', output: 'handle-buy' },
          { value: 'sell', output: 'handle-sell' },
        ],
        defaultOutput: 'handle-default',
      },
    }
    const ctx = createContext({ triggerData: { action: 'buy' } })

    const result = evaluateSwitch(node, ctx)

    expect(result).toBe('handle-buy')
  })

  it('should return defaultOutput when no case matches', () => {
    const node: FlowNode = {
      id: 'sw1', type: 'switch', category: 'control', label: 'Switch',
      config: {
        switchValue: '{{trigger.action}}',
        cases: [
          { value: 'buy', output: 'handle-buy' },
        ],
        defaultOutput: 'handle-default',
      },
    }
    const ctx = createContext({ triggerData: { action: 'unknown' } })

    const result = evaluateSwitch(node, ctx)

    expect(result).toBe('handle-default')
  })

  it('should return "default" when no defaultOutput configured', () => {
    const node: FlowNode = {
      id: 'sw1', type: 'switch', category: 'control', label: 'Switch',
      config: {
        switchValue: 'static',
        cases: [{ value: 'other', output: 'x' }],
      },
    }
    const ctx = createContext()

    const result = evaluateSwitch(node, ctx)

    expect(result).toBe('default')
  })

  it('should match the first matching case', () => {
    const node: FlowNode = {
      id: 'sw1', type: 'switch', category: 'control', label: 'Switch',
      config: {
        switchValue: 'val',
        cases: [
          { value: 'val', output: 'first' },
          { value: 'val', output: 'second' },
        ],
      },
    }
    const ctx = createContext()

    expect(evaluateSwitch(node, ctx)).toBe('first')
  })
})

// --- Transform Node ---
describe('executeTransform', () => {
  it('should convert to uppercase', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'uppercase', input: 'hello world' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toBe('HELLO WORLD')
  })

  it('should convert to lowercase', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'lowercase', input: 'HELLO WORLD' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toBe('hello world')
  })

  it('should trim whitespace', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'trim', input: '  hello  ' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toBe('hello')
  })

  it('should parse JSON', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'json_parse', input: '{"key":"value"}' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toEqual({ key: 'value' })
  })

  it('should stringify to JSON', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'json_stringify', input: 'test' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toBe('"test"')
  })

  it('should split by delimiter', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'split', input: 'a,b,c', delimiter: ',' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toEqual(['a', 'b', 'c'])
  })

  it('should split by custom delimiter', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'split', input: 'a|b|c', delimiter: '|' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toEqual(['a', 'b', 'c'])
  })

  it('should extract regex match', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'regex_extract', input: 'Order #12345 confirmed', pattern: '#\\d+' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toBe('#12345')
  })

  it('should return null when regex does not match', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'regex_extract', input: 'no numbers here', pattern: '\\d+' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toBeNull()
  })

  it('should passthrough for unknown operation', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'unknown_op', input: 'hello' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toBe('hello')
  })

  it('should default to passthrough when no operation specified', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { input: 'raw' },
    }
    const ctx = createContext()
    expect(executeTransform(node, ctx)).toBe('raw')
  })

  it('should interpolate variables in input', () => {
    const node: FlowNode = {
      id: 'tr1', type: 'transform', category: 'control', label: 'Transform',
      config: { operation: 'uppercase', input: '{{trigger.name}}' },
    }
    const ctx = createContext({ triggerData: { name: 'alice' } })
    expect(executeTransform(node, ctx)).toBe('ALICE')
  })
})

// --- Notification Node ---
describe('executeNotification', () => {
  it('should return notification with default websocket channel', async () => {
    const node: FlowNode = {
      id: 'n1', type: 'notification', category: 'action', label: 'Notify',
      config: { message: 'Alert: {{trigger.event}}' },
    }
    const ctx = createContext({ triggerData: { event: 'spam detected' } })

    const result = await executeNotification(node, ctx) as any

    expect(result.action).toBe('notification')
    expect(result.channel).toBe('websocket')
    expect(result.message).toBe('Alert: spam detected')
    expect(result.executed).toBe(true)
    expect(result.timestamp).toBeDefined()
  })

  it('should use configured channel', async () => {
    const node: FlowNode = {
      id: 'n1', type: 'notification', category: 'action', label: 'Notify',
      config: { channel: 'email', message: 'Hello' },
    }
    const ctx = createContext()

    const result = await executeNotification(node, ctx) as any

    expect(result.channel).toBe('email')
  })
})

// --- Templates ---
describe('getTemplate', () => {
  it('should return a template by ID', () => {
    const template = getTemplate('welcome-flow')
    expect(template).toBeDefined()
    expect(template!.name).toBe('Welcome New Members')
    expect(template!.category).toBe('community')
  })

  it('should return undefined for unknown template ID', () => {
    expect(getTemplate('nonexistent')).toBeUndefined()
  })

  it('should return the spam-escalation template', () => {
    const template = getTemplate('spam-escalation')
    expect(template).toBeDefined()
    expect(template!.category).toBe('moderation')
    expect(template!.nodes).toHaveLength(3)
    expect(template!.edges).toHaveLength(2)
  })

  it('should return the broadcast-flow template', () => {
    const template = getTemplate('broadcast-flow')
    expect(template).toBeDefined()
    expect(template!.category).toBe('automation')
  })

  it('should return the cross-post-flow template', () => {
    const template = getTemplate('cross-post-flow')
    expect(template).toBeDefined()
    expect(template!.nodes.some((n) => n.type === 'user_role')).toBe(true)
  })
})

describe('FLOW_TEMPLATES', () => {
  it('should contain 4 templates', () => {
    expect(FLOW_TEMPLATES).toHaveLength(4)
  })

  it('should have unique IDs', () => {
    const ids = FLOW_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should have valid node references in edges', () => {
    for (const template of FLOW_TEMPLATES) {
      const nodeIds = new Set(template.nodes.map((n) => n.id))
      for (const edge of template.edges) {
        expect(nodeIds.has(edge.source)).toBe(true)
        expect(nodeIds.has(edge.target)).toBe(true)
      }
    }
  })
})
