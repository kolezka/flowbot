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
    triggerData: { interactionId: 'int-123', channelId: 'ch-456', guildId: 'g-789' },
    nodeResults: new Map(),
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('new Discord action executors (SP2)', () => {
  it('discord_reply_interaction returns correct output', async () => {
    const node = createNode('discord_reply_interaction', {
      content: 'Hello!',
      ephemeral: true,
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('discord_reply_interaction')
    expect(result.content).toBe('Hello!')
    expect(result.ephemeral).toBe(true)
    expect(result.platform).toBe('discord')
    expect(result.executed).toBe(true)
  })

  it('discord_show_modal returns correct output', async () => {
    const node = createNode('discord_show_modal', {
      customId: 'feedback-modal',
      title: 'Feedback',
      components: [{ type: 'text_input', customId: 'input-1', label: 'Your feedback' }],
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('discord_show_modal')
    expect(result.customId).toBe('feedback-modal')
    expect(result.executed).toBe(true)
  })

  it('discord_defer_reply returns correct output', async () => {
    const node = createNode('discord_defer_reply', { ephemeral: false })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('discord_defer_reply')
    expect(result.ephemeral).toBe(false)
    expect(result.executed).toBe(true)
  })

  it('discord_create_forum_post returns correct output', async () => {
    const node = createNode('discord_create_forum_post', {
      name: 'New Discussion',
      content: 'Let\'s talk',
      tags: ['general'],
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('discord_create_forum_post')
    expect(result.name).toBe('New Discussion')
    expect(result.executed).toBe(true)
  })

  it('discord_register_commands returns correct output', async () => {
    const node = createNode('discord_register_commands', {
      commands: [{ name: 'ping', description: 'Pong!' }],
    })
    const result = (await executeAction(node, createContext())) as Record<string, unknown>
    expect(result.action).toBe('discord_register_commands')
    expect(result.guildId).toBe('g-789')
    expect(result.executed).toBe(true)
  })

  it('all 8 new Discord types are handled', async () => {
    const types = [
      'discord_reply_interaction', 'discord_show_modal', 'discord_send_components',
      'discord_edit_interaction', 'discord_defer_reply', 'discord_set_channel_permissions',
      'discord_create_forum_post', 'discord_register_commands',
    ]
    for (const type of types) {
      const node = createNode(type, {})
      const result = (await executeAction(node, createContext())) as Record<string, unknown>
      expect(result.action).toBe(type)
      expect(result.platform).toBe('discord')
      expect(result.executed).toBe(true)
    }
  })
})
