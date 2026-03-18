/**
 * Integration tests for the flow builder features (SP1 + SP2).
 * Tests full executeFlow pipelines with context, chaining, conditions,
 * unified actions, and new node types working together.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => ({
    botInstance: { findUnique: vi.fn() },
  })),
}))

import { executeFlow } from '../lib/flow-engine/executor.js'
import type { FlowNode, FlowEdge } from '../lib/flow-engine/types.js'

// --- Helpers ---

function node(id: string, type: string, category: string, config: Record<string, unknown> = {}): FlowNode {
  return { id, type, category, label: type, config }
}

function edge(source: string, target: string): FlowEdge {
  return { id: `${source}->${target}`, source, target }
}

function output(ctx: any, nodeId: string) {
  return ctx.nodeResults.get(nodeId)?.output as Record<string, unknown> | undefined
}

function status(ctx: any, nodeId: string) {
  return ctx.nodeResults.get(nodeId)?.status
}

// --- Mocks ---

const mockPrisma = {
  userFlowContext: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  flowEvent: {
    create: vi.fn(),
  },
  flowDefinition: {
    findMany: vi.fn(),
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)
  mockPrisma.userFlowContext.upsert.mockResolvedValue({})
  mockPrisma.userFlowContext.delete.mockResolvedValue({})
  mockPrisma.flowEvent.create.mockResolvedValue({ id: 'evt-1' })
  mockPrisma.flowDefinition.findMany.mockResolvedValue([])
})

// =============================================================================
// 1. Context Store Integration
// =============================================================================

describe('Context store in full flow execution', () => {
  it('set_context stores value and get_context retrieves it', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'set_context', 'action', { key: 'language', value: 'pl' }),
      node('a2', 'get_context', 'action', { key: 'language', defaultValue: 'en' }),
    ]
    const edges = [edge('t1', 'a1'), edge('a1', 'a2')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
    }, { prisma: mockPrisma })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.value).toBe('pl')
    expect(status(ctx, 'a2')).toBe('success')
    // get_context should have been called
    expect(mockPrisma.userFlowContext.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ key: 'language', value: 'pl' }),
      }),
    )
  })

  it('set_context interpolates trigger variables', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'set_context', 'action', { key: 'user_name', value: '{{trigger.userName}}' }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
      userName: 'Alice',
    }, { prisma: mockPrisma })

    expect(output(ctx, 'a1')?.value).toBe('Alice')
  })

  it('delete_context executes without error', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'delete_context', 'action', { key: 'temp_data' }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
    }, { prisma: mockPrisma })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.key).toBe('temp_data')
  })

  it('get_context returns defaultValue when key missing', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'get_context', 'action', { key: 'missing_key', defaultValue: 'fallback' }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
    }, { prisma: mockPrisma })

    expect(output(ctx, 'a1')?.value).toBe('fallback')
  })
})

// =============================================================================
// 2. Context Condition Integration
// =============================================================================

describe('context_condition in flow execution', () => {
  it('branches on context_condition exists=true', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'pl' })

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('c1', 'context_condition', 'condition', { key: 'language', operator: 'exists' }),
      node('a1', 'send_message', 'action', { text: 'Has language' }),
    ]
    const edges = [edge('t1', 'c1'), edge('c1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
    }, { prisma: mockPrisma })

    expect(status(ctx, 'c1')).toBe('success')
    expect(ctx.nodeResults.get('c1')?.output).toBe(true)
    expect(status(ctx, 'a1')).toBe('success')
  })

  it('blocks downstream when context_condition fails', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('c1', 'context_condition', 'condition', { key: 'language', operator: 'exists' }),
      node('a1', 'send_message', 'action', { text: 'Should not execute' }),
    ]
    const edges = [edge('t1', 'c1'), edge('c1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
    }, { prisma: mockPrisma })

    expect(ctx.nodeResults.get('c1')?.output).toBe(false)
    expect(ctx.nodeResults.has('a1')).toBe(false)
  })

  it('context_condition equals operator works', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'vip' })

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('c1', 'context_condition', 'condition', { key: 'role', operator: 'equals', value: 'vip' }),
      node('a1', 'send_message', 'action', { text: 'VIP message' }),
    ]
    const edges = [edge('t1', 'c1'), edge('c1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
    }, { prisma: mockPrisma })

    expect(ctx.nodeResults.get('c1')?.output).toBe(true)
    expect(status(ctx, 'a1')).toBe('success')
  })

  it('context_condition gt operator works', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 10 })

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('c1', 'context_condition', 'condition', { key: 'score', operator: 'gt', value: 5 }),
      node('a1', 'send_message', 'action', { text: 'High score' }),
    ]
    const edges = [edge('t1', 'c1'), edge('c1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
    }, { prisma: mockPrisma })

    expect(ctx.nodeResults.get('c1')?.output).toBe(true)
    expect(status(ctx, 'a1')).toBe('success')
  })
})

// =============================================================================
// 3. Context Variable Interpolation
// =============================================================================

describe('context.* variable interpolation in flow', () => {
  it('get_context populates cache for {{context.*}} in downstream nodes', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'pl' })

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'get_context', 'action', { key: 'language' }),
      node('a2', 'send_message', 'action', { text: 'Your language: {{context.language}}' }),
    ]
    const edges = [edge('t1', 'a1'), edge('a1', 'a2')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
    }, { prisma: mockPrisma })

    expect(status(ctx, 'a2')).toBe('success')
    expect(output(ctx, 'a2')?.text).toBe('Your language: pl')
  })

  it('mixes {{trigger.*}} and {{context.*}} in same template', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: '3' })

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'get_context', 'action', { key: 'step' }),
      node('a2', 'send_message', 'action', { text: '{{trigger.userName}} is at step {{context.step}}' }),
    ]
    const edges = [edge('t1', 'a1'), edge('a1', 'a2')]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'user-1',
      platform: 'telegram',
      userName: 'Bob',
    }, { prisma: mockPrisma })

    expect(output(ctx, 'a2')?.text).toBe('Bob is at step 3')
  })
})

// =============================================================================
// 4. Flow Chaining (run_flow)
// =============================================================================

describe('run_flow action in flow execution', () => {
  it('run_flow with waitForResult calls triggerAndWait', async () => {
    const mockTriggerAndWait = vi.fn().mockResolvedValue({ ok: true, output: { result: 'child-done' } })
    const mockTrigger = vi.fn()

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'run_flow', 'action', {
        flowId: 'child-flow-id',
        waitForResult: true,
        inputVariables: { name: 'test' },
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { _chainDepth: 0 }, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: mockTriggerAndWait, trigger: mockTrigger },
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.output).toEqual({ result: 'child-done' })
    expect(mockTriggerAndWait).toHaveBeenCalledWith('flow-execution', {
      flowId: 'child-flow-id',
      triggerData: { name: 'test', _chainDepth: 1 },
    })
    expect(mockTrigger).not.toHaveBeenCalled()
  })

  it('run_flow fire-and-forget calls trigger', async () => {
    const mockTriggerAndWait = vi.fn()
    const mockTrigger = vi.fn().mockResolvedValue(undefined)

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'run_flow', 'action', { flowId: 'bg-flow', waitForResult: false }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { _chainDepth: 0 }, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: mockTriggerAndWait, trigger: mockTrigger },
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.fired).toBe(true)
    expect(mockTrigger).toHaveBeenCalled()
    expect(mockTriggerAndWait).not.toHaveBeenCalled()
  })

  it('run_flow errors when chain depth exceeds max', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'run_flow', 'action', { flowId: 'deep-flow', waitForResult: true }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { _chainDepth: 5 }, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: vi.fn(), trigger: vi.fn() },
    })

    expect(status(ctx, 'a1')).toBe('error')
    expect(ctx.nodeResults.get('a1')?.error).toContain('Maximum chain depth')
  })

  it('run_flow increments chain depth for child', async () => {
    const mockTrigger = vi.fn().mockResolvedValue(undefined)

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'run_flow', 'action', { flowId: 'child', waitForResult: false }),
    ]
    const edges = [edge('t1', 'a1')]

    await executeFlow(nodes, edges, { _chainDepth: 2 }, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: vi.fn(), trigger: mockTrigger },
    })

    expect(mockTrigger).toHaveBeenCalledWith('flow-execution', expect.objectContaining({
      triggerData: expect.objectContaining({ _chainDepth: 3 }),
    }))
  })
})

// =============================================================================
// 5. Event-Based Chaining (emit_event / custom_event)
// =============================================================================

describe('emit_event action in flow execution', () => {
  it('emit_event writes FlowEvent and triggers matching listeners', async () => {
    mockPrisma.flowDefinition.findMany.mockResolvedValue([
      {
        id: 'listener-flow',
        nodesJson: [
          { type: 'custom_event', config: { eventName: 'order.completed' } },
        ],
      },
    ])
    const mockTrigger = vi.fn().mockResolvedValue(undefined)

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'emit_event', 'action', {
        eventName: 'order.completed',
        payload: { orderId: '{{trigger.orderId}}' },
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      orderId: 'ord-123',
      _chainDepth: 0,
    }, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: vi.fn(), trigger: mockTrigger },
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.listenersTriggered).toBe(1)

    // FlowEvent was created
    expect(mockPrisma.flowEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'order.completed',
        payload: expect.objectContaining({ orderId: 'ord-123' }),
      }),
    })

    // Listener flow was triggered
    expect(mockTrigger).toHaveBeenCalledWith('flow-execution', expect.objectContaining({
      flowId: 'listener-flow',
      triggerData: expect.objectContaining({
        event: 'order.completed',
        orderId: 'ord-123',
        _chainDepth: 1,
      }),
    }))
  })

  it('emit_event works with no listeners', async () => {
    mockPrisma.flowDefinition.findMany.mockResolvedValue([])

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'emit_event', 'action', { eventName: 'no.listeners' }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {}, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: vi.fn(), trigger: vi.fn() },
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.listenersTriggered).toBe(0)
    // Event still recorded for audit
    expect(mockPrisma.flowEvent.create).toHaveBeenCalled()
  })

  it('emit_event does not trigger the source flow (prevents self-loop)', async () => {
    // The source flow has flowId '' (default in executor)
    mockPrisma.flowDefinition.findMany.mockResolvedValue([])

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'emit_event', 'action', { eventName: 'test.event' }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {}, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: vi.fn(), trigger: vi.fn() },
    })

    // findMany should filter out current flowId
    expect(mockPrisma.flowDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: '' }, // executor default flowId
        }),
      }),
    )
  })
})

// =============================================================================
// 6. Unified Cross-Platform Actions
// =============================================================================

describe('Unified actions in flow execution', () => {
  it('unified_send_message produces correct output', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'unified_send_message', 'action', {
        text: 'Hello {{trigger.userName}}!',
        targetChatId: '{{trigger.chatId}}',
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      chatId: '12345',
      userName: 'Alice',
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.text).toBe('Hello Alice!')
    expect(output(ctx, 'a1')?.targetChatId).toBe('12345')
    expect(output(ctx, 'a1')?.executed).toBe(true)
  })

  it('unified actions use trigger.chatId as fallback targetChatId', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'unified_ban_user', 'action', { targetUserId: 'bad-user' }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { chatId: 'chat-99' })

    expect(output(ctx, 'a1')?.targetChatId).toBe('chat-99')
    expect(output(ctx, 'a1')?.targetUserId).toBe('bad-user')
  })

  it('unified actions preserve platform overrides', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'unified_send_message', 'action', {
        text: 'Hello',
        telegramOverrides: { parseMode: 'HTML' },
        discordOverrides: { embed: { title: 'Hello' } },
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { chatId: '123' })

    expect(output(ctx, 'a1')?.telegramOverrides).toEqual({ parseMode: 'HTML' })
    expect(output(ctx, 'a1')?.discordOverrides).toEqual({ embed: { title: 'Hello' } })
  })

  it('all 8 unified types execute without error', async () => {
    const types = [
      'unified_send_message', 'unified_send_media', 'unified_delete_message',
      'unified_ban_user', 'unified_kick_user', 'unified_pin_message',
      'unified_send_dm', 'unified_set_role',
    ]

    for (const type of types) {
      const nodes = [
        node('t1', 'message_received', 'trigger'),
        node('a1', type, 'action', { targetChatId: '123' }),
      ]
      const ctx = await executeFlow(nodes, [edge('t1', 'a1')], {})
      expect(status(ctx, 'a1')).toBe('success')
      expect(output(ctx, 'a1')?.action).toBe(type)
    }
  })
})

// =============================================================================
// 7. New Telegram Actions (SP2)
// =============================================================================

describe('New Telegram action nodes in flow execution', () => {
  it('send_invoice produces correct output', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'send_invoice', 'action', {
        chatId: '{{trigger.chatId}}',
        title: 'Premium Plan',
        description: 'Monthly subscription',
        payload: 'premium_monthly',
        currency: 'PLN',
        prices: [{ label: 'Premium', amount: 2999 }],
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { chatId: '12345' })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.action).toBe('send_invoice')
    expect(output(ctx, 'a1')?.title).toBe('Premium Plan')
    expect(output(ctx, 'a1')?.currency).toBe('PLN')
  })

  it('answer_pre_checkout produces correct output', async () => {
    const nodes = [
      node('t1', 'pre_checkout_query', 'trigger'),
      node('a1', 'answer_pre_checkout', 'action', { queryId: '{{trigger.queryId}}', ok: true }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { queryId: 'pq-999' })

    expect(output(ctx, 'a1')?.action).toBe('answer_pre_checkout')
    expect(output(ctx, 'a1')?.ok).toBe(true)
    expect(output(ctx, 'a1')?.queryId).toBe('pq-999')
  })

  it('create_forum_topic produces correct output', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'create_forum_topic', 'action', {
        chatId: '{{trigger.chatId}}',
        name: 'New Discussion',
        iconColor: 7322096,
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { chatId: '12345' })

    expect(output(ctx, 'a1')?.action).toBe('create_forum_topic')
    expect(output(ctx, 'a1')?.name).toBe('New Discussion')
  })

  it('set_my_commands produces correct output', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'set_my_commands', 'action', {
        commands: [
          { command: 'start', description: 'Start the bot' },
          { command: 'help', description: 'Get help' },
        ],
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {})

    expect(output(ctx, 'a1')?.action).toBe('set_my_commands')
    expect((output(ctx, 'a1')?.commands as any[])?.length).toBe(2)
  })
})

// =============================================================================
// 8. New Discord Actions (SP2)
// =============================================================================

describe('New Discord action nodes in flow execution', () => {
  it('discord_reply_interaction produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_interaction_create', 'trigger'),
      node('a1', 'discord_reply_interaction', 'action', {
        content: 'Hello from bot!',
        ephemeral: true,
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { interactionId: 'int-123' })

    expect(output(ctx, 'a1')?.action).toBe('discord_reply_interaction')
    expect(output(ctx, 'a1')?.platform).toBe('discord')
    expect(output(ctx, 'a1')?.content).toBe('Hello from bot!')
    expect(output(ctx, 'a1')?.ephemeral).toBe(true)
  })

  it('discord_show_modal produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_interaction_create', 'trigger'),
      node('a1', 'discord_show_modal', 'action', {
        customId: 'feedback-form',
        title: 'Give Feedback',
        components: [{ type: 'text_input', label: 'Message' }],
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { interactionId: 'int-456' })

    expect(output(ctx, 'a1')?.action).toBe('discord_show_modal')
    expect(output(ctx, 'a1')?.customId).toBe('feedback-form')
  })

  it('discord_create_forum_post produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_create_forum_post', 'action', {
        name: 'Bug Report',
        content: 'Found a bug in {{trigger.channelId}}',
        tags: ['bug'],
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { channelId: 'ch-789' })

    expect(output(ctx, 'a1')?.action).toBe('discord_create_forum_post')
    expect(output(ctx, 'a1')?.content).toBe('Found a bug in ch-789')
  })
})

// =============================================================================
// 9. Complex Multi-Step Flows
// =============================================================================

describe('Complex multi-step flow scenarios', () => {
  it('onboarding flow: trigger → set_context → condition → send_message → emit_event', async () => {
    // context_condition calls getContext which calls findUnique
    // After set_context upserts, the condition should find the key
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: '1' })

    const nodes = [
      node('t1', 'user_joins', 'trigger'),
      node('a1', 'set_context', 'action', { key: 'onboarding_step', value: '1' }),
      node('c1', 'context_condition', 'condition', { key: 'onboarding_step', operator: 'exists' }),
      node('a2', 'send_message', 'action', { text: 'Welcome!' }),
      node('a3', 'emit_event', 'action', { eventName: 'onboarding.started' }),
    ]
    const edges = [
      edge('t1', 'a1'),
      edge('a1', 'c1'),
      edge('c1', 'a2'),
      edge('a2', 'a3'),
    ]

    const ctx = await executeFlow(nodes, edges, {
      platformUserId: 'new-user',
      platform: 'telegram',
    }, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: vi.fn(), trigger: vi.fn() },
    })

    expect(status(ctx, 'a1')).toBe('success') // set_context
    expect(status(ctx, 'c1')).toBe('success') // condition passed
    expect(ctx.nodeResults.get('c1')?.output).toBe(true)
    expect(status(ctx, 'a2')).toBe('success') // send_message
    expect(status(ctx, 'a3')).toBe('success') // emit_event
    expect(mockPrisma.flowEvent.create).toHaveBeenCalled()
  })

  it('spam flow: trigger → keyword_match → parallel actions (delete + mute) → notify', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('c1', 'keyword_match', 'condition', { keywords: ['buy now', 'free'], mode: 'any' }),
      node('a1', 'delete_message', 'action', { messageId: '{{trigger.messageId}}' }),
      node('a2', 'mute_user', 'action', { duration: 3600 }),
      node('a3', 'send_message', 'action', { text: 'Spam detected from {{trigger.userName}}' }),
    ]
    const edges = [
      edge('t1', 'c1'),
      edge('c1', 'a1'),
      edge('c1', 'a2'),
      edge('a1', 'a3'),
      edge('a2', 'a3'),
    ]

    const ctx = await executeFlow(nodes, edges, {
      text: 'Buy now! Free money!',
      userName: 'Spammer',
      chatId: '123',
      messageId: '456',
    })

    expect(ctx.nodeResults.get('c1')?.output).toBe(true) // keyword matched
    expect(status(ctx, 'a1')).toBe('success') // delete
    expect(status(ctx, 'a2')).toBe('success') // mute
    expect(status(ctx, 'a3')).toBe('success') // notify
    expect(output(ctx, 'a3')?.text).toBe('Spam detected from Spammer')
  })

  it('branching flow: condition splits to two paths, only true path executes', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('c1', 'user_is_admin', 'condition'),
      node('a1', 'send_message', 'action', { text: 'Admin action' }),
      node('a2', 'send_message', 'action', { text: 'Post-admin action' }),
    ]
    const edges = [
      edge('t1', 'c1'),
      edge('c1', 'a1'),
      edge('a1', 'a2'),
    ]

    // Not admin
    const ctx = await executeFlow(nodes, edges, { userRole: 'member' })

    expect(ctx.nodeResults.get('c1')?.output).toBe(false)
    expect(ctx.nodeResults.has('a1')).toBe(false)
    expect(ctx.nodeResults.has('a2')).toBe(false)
  })

  it('chained flow with context: run_flow passes variables to child', async () => {
    const mockTriggerAndWait = vi.fn().mockResolvedValue({
      ok: true,
      output: { status: 'verified' },
    })

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'get_context', 'action', { key: 'user_id' }),
      node('a2', 'run_flow', 'action', {
        flowId: 'verification-flow',
        waitForResult: true,
        inputVariables: { userId: '{{trigger.userId}}' },
      }),
      node('a3', 'send_message', 'action', { text: 'Verification complete' }),
    ]
    const edges = [edge('t1', 'a1'), edge('a1', 'a2'), edge('a2', 'a3')]

    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'u-123' })

    const ctx = await executeFlow(nodes, edges, {
      userId: 'u-123',
      platformUserId: 'u-123',
      platform: 'telegram',
    }, {
      prisma: mockPrisma,
      taskCallbacks: { triggerAndWait: mockTriggerAndWait, trigger: vi.fn() },
    })

    expect(status(ctx, 'a2')).toBe('success')
    expect(output(ctx, 'a2')?.output).toEqual({ status: 'verified' })
    expect(status(ctx, 'a3')).toBe('success')
  })
})

// =============================================================================
// 10. onNodeComplete Callback
// =============================================================================

describe('onNodeComplete callback', () => {
  it('fires after each node execution', async () => {
    const completedNodes: string[] = []

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'send_message', 'action', { text: 'hello' }),
      node('a2', 'send_message', 'action', { text: 'world' }),
    ]
    const edges = [edge('t1', 'a1'), edge('a1', 'a2')]

    await executeFlow(nodes, edges, {}, {
      onNodeComplete: async (nodeId) => {
        completedNodes.push(nodeId)
      },
    })

    expect(completedNodes).toEqual(['t1', 'a1', 'a2'])
  })

  it('provides correct result data in callback', async () => {
    const results: Array<{ id: string; status: string }> = []

    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'send_message', 'action', { text: 'test' }),
    ]
    const edges = [edge('t1', 'a1')]

    await executeFlow(nodes, edges, { chatId: '123' }, {
      onNodeComplete: async (nodeId, result) => {
        results.push({ id: nodeId, status: result.status })
      },
    })

    expect(results).toEqual([
      { id: 't1', status: 'success' },
      { id: 'a1', status: 'success' },
    ])
  })
})

// =============================================================================
// 11. Performance & Edge Cases
// =============================================================================

describe('Edge cases and performance', () => {
  it('context actions fail gracefully without prisma', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'get_context', 'action', { key: 'test' }),
    ]
    const edges = [edge('t1', 'a1')]

    // No prisma provided
    const ctx = await executeFlow(nodes, edges, {})

    expect(status(ctx, 'a1')).toBe('error')
    expect(ctx.nodeResults.get('a1')?.error).toContain('prisma')
  })

  it('run_flow fails gracefully without taskCallbacks', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'run_flow', 'action', { flowId: 'x', waitForResult: true }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {})

    expect(status(ctx, 'a1')).toBe('error')
    expect(ctx.nodeResults.get('a1')?.error).toContain('taskCallbacks')
  })

  it('large flow with many nodes executes correctly', async () => {
    const nodes: FlowNode[] = [node('t1', 'message_received', 'trigger')]
    const edges: FlowEdge[] = []

    // Chain of 50 send_message actions
    for (let i = 1; i <= 50; i++) {
      const prev = i === 1 ? 't1' : `a${i - 1}`
      nodes.push(node(`a${i}`, 'send_message', 'action', { text: `msg ${i}` }))
      edges.push(edge(prev, `a${i}`))
    }

    const ctx = await executeFlow(nodes, edges, {})

    expect(ctx.nodeResults.size).toBe(51) // trigger + 50 actions
    expect(status(ctx, 'a50')).toBe('success')
    expect((ctx as any)._metrics.nodeCount).toBe(51)
  })

  it('caching works for deterministic condition nodes', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('c1', 'keyword_match', 'condition', { keywords: ['hello'] }),
      node('a1', 'send_message', 'action', { text: 'matched' }),
    ]
    const edges = [edge('t1', 'c1'), edge('c1', 'a1')]

    const ctx = await executeFlow(nodes, edges, { text: 'hello' }, { enableNodeCache: true })

    const metrics = (ctx as any)._metrics
    expect(metrics.nodeCount).toBe(3)
    // Condition should be cacheable (no side effects)
  })

  it('metrics are populated correctly', async () => {
    const nodes = [
      node('t1', 'message_received', 'trigger'),
      node('a1', 'send_message', 'action', { text: 'test' }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {})

    const metrics = (ctx as any)._metrics
    expect(metrics).toBeDefined()
    expect(metrics.nodeCount).toBe(2)
    expect(metrics.durationMs).toBeGreaterThanOrEqual(0)
    expect(metrics.skippedNodes).toBe(0)
  })
})
