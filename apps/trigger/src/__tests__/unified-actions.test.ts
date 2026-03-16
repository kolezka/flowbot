import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => ({
    botInstance: { findUnique: vi.fn() },
  })),
}))

import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

function createContext(): FlowContext {
  return {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: { chatId: '12345' },
    nodeResults: new Map(),
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('unified action executors', () => {
  it('unified_send_message returns correct action output', async () => {
    const node = createNode('unified_send_message', {
      text: 'Hello!',
      targetChatId: '123',
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('unified_send_message')
    expect(result.text).toBe('Hello!')
    expect(result.targetChatId).toBe('123')
    expect(result.executed).toBe(true)
  })

  it('unified_ban_user returns correct action output', async () => {
    const node = createNode('unified_ban_user', {
      targetUserId: 'user-456',
      targetChatId: 'chat-789',
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('unified_ban_user')
    expect(result.targetUserId).toBe('user-456')
    expect(result.executed).toBe(true)
  })

  it('unified_send_dm returns correct action output', async () => {
    const node = createNode('unified_send_dm', {
      text: 'Private message',
      targetUserId: 'user-123',
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('unified_send_dm')
    expect(result.text).toBe('Private message')
    expect(result.executed).toBe(true)
  })

  it('interpolates variables in unified actions', async () => {
    const ctx = createContext()
    const node = createNode('unified_send_message', {
      text: 'Hello from chat {{trigger.chatId}}',
      targetChatId: '{{trigger.chatId}}',
    })
    const result = (await executeAction(node, ctx)) as Record<string, unknown>
    expect(result.text).toBe('Hello from chat 12345')
    expect(result.targetChatId).toBe('12345')
  })

  it('all 8 unified types are handled', async () => {
    const types = [
      'unified_send_message', 'unified_send_media', 'unified_delete_message',
      'unified_ban_user', 'unified_kick_user', 'unified_pin_message',
      'unified_send_dm', 'unified_set_role',
    ]
    for (const type of types) {
      const node = createNode(type, { targetChatId: '123' })
      const result = (await executeAction(node, createContext())) as Record<string, unknown>
      expect(result.action).toBe(type)
      expect(result.executed).toBe(true)
    }
  })
})
