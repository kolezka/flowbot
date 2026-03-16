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

describe('new Telegram action executors (SP2)', () => {
  it('answer_inline_query returns correct output', async () => {
    const node = createNode('answer_inline_query', {
      queryId: 'q-123',
      results: [{ type: 'article', id: '1', title: 'Result 1' }],
      cacheTime: 300,
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('answer_inline_query')
    expect(result.queryId).toBe('q-123')
    expect(result.executed).toBe(true)
  })

  it('send_invoice returns correct output', async () => {
    const node = createNode('send_invoice', {
      chatId: '123',
      title: 'Product',
      description: 'A product',
      payload: 'product_1',
      currency: 'PLN',
      prices: [{ label: 'Price', amount: 1000 }],
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('send_invoice')
    expect(result.title).toBe('Product')
    expect(result.executed).toBe(true)
  })

  it('answer_pre_checkout returns correct output', async () => {
    const node = createNode('answer_pre_checkout', {
      queryId: 'pq-456',
      ok: true,
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('answer_pre_checkout')
    expect(result.ok).toBe(true)
    expect(result.executed).toBe(true)
  })

  it('set_chat_menu_button returns correct output', async () => {
    const node = createNode('set_chat_menu_button', {
      chatId: '123',
      menuButton: { type: 'web_app', text: 'Open', url: 'https://example.com' },
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('set_chat_menu_button')
    expect(result.executed).toBe(true)
  })

  it('send_media_group returns correct output', async () => {
    const node = createNode('send_media_group', {
      chatId: '123',
      media: [
        { type: 'photo', url: 'https://example.com/1.jpg', caption: 'Photo 1' },
        { type: 'photo', url: 'https://example.com/2.jpg' },
      ],
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('send_media_group')
    expect(result.executed).toBe(true)
  })

  it('create_forum_topic returns correct output', async () => {
    const node = createNode('create_forum_topic', {
      chatId: '123',
      name: 'New Topic',
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('create_forum_topic')
    expect(result.name).toBe('New Topic')
    expect(result.executed).toBe(true)
  })

  it('set_my_commands returns correct output', async () => {
    const node = createNode('set_my_commands', {
      commands: [
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'Get help' },
      ],
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('set_my_commands')
    expect(result.executed).toBe(true)
  })
})
