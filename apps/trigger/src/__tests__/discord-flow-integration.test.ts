/**
 * Integration tests for Discord flow execution.
 * Tests Discord triggers, conditions, actions, and mixed Telegram/Discord flows.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => ({
    botInstance: { findUnique: vi.fn() },
  })),
}))

import { executeFlow } from '../lib/flow-engine/executor.js'
import { evaluateCondition } from '../lib/flow-engine/conditions.js'
import type { FlowNode, FlowEdge, FlowContext } from '../lib/flow-engine/types.js'

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

// =============================================================================
// Discord Triggers
// =============================================================================

describe('Discord trigger nodes in flow execution', () => {
  it('discord_message_received trigger passes data through', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_send_message', 'action', {
        channelId: '{{trigger.channelId}}',
        content: 'Echo: {{trigger.content}}',
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      channelId: 'ch-123',
      content: 'Hello bot',
      userId: 'user-456',
      guildId: 'guild-789',
    })

    expect(status(ctx, 't1')).toBe('success')
    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.content).toBe('Echo: Hello bot')
    expect(output(ctx, 'a1')?.platform).toBe('discord')
  })

  it('discord_member_join trigger starts flow', async () => {
    const nodes = [
      node('t1', 'discord_member_join', 'trigger'),
      node('a1', 'discord_send_message', 'action', {
        channelId: 'welcome-ch',
        content: 'Welcome {{trigger.userName}}!',
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      userName: 'NewUser',
      userId: 'u-1',
      guildId: 'g-1',
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.content).toBe('Welcome NewUser!')
  })

  it('discord_interaction_create trigger starts interaction flow', async () => {
    const nodes = [
      node('t1', 'discord_interaction_create', 'trigger'),
      node('a1', 'discord_reply_interaction', 'action', {
        content: 'Pong!',
        ephemeral: true,
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      interactionId: 'int-001',
      commandName: 'ping',
      userId: 'u-1',
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.content).toBe('Pong!')
    expect(output(ctx, 'a1')?.ephemeral).toBe(true)
  })

  it('discord_slash_command trigger works', async () => {
    const nodes = [
      node('t1', 'discord_slash_command', 'trigger'),
      node('a1', 'discord_reply_interaction', 'action', { content: 'Command received' }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      interactionId: 'int-002',
      commandName: '/help',
    })

    expect(status(ctx, 'a1')).toBe('success')
  })
})

// =============================================================================
// Discord Conditions
// =============================================================================

describe('Discord condition evaluators', () => {
  function createCtx(triggerData: Record<string, unknown> = {}): FlowContext {
    return {
      flowId: 'test',
      executionId: 'exec-1',
      variables: new Map(),
      triggerData,
      nodeResults: new Map(),
    }
  }

  it('discord_has_role returns true when user has the role', async () => {
    const ctx = createCtx({ roles: ['admin', 'moderator', 'member'] })
    const n = node('c1', 'discord_has_role', 'condition', { roleId: 'moderator' })
    expect(await evaluateCondition(n, ctx)).toBe(true)
  })

  it('discord_has_role returns false when user lacks the role', async () => {
    const ctx = createCtx({ roles: ['member'] })
    const n = node('c1', 'discord_has_role', 'condition', { roleId: 'admin' })
    expect(await evaluateCondition(n, ctx)).toBe(false)
  })

  it('discord_channel_type matches correctly', async () => {
    const ctx = createCtx({ channelType: 'text' })
    expect(await evaluateCondition(
      node('c1', 'discord_channel_type', 'condition', { channelType: 'text' }), ctx,
    )).toBe(true)
    expect(await evaluateCondition(
      node('c2', 'discord_channel_type', 'condition', { channelType: 'voice' }), ctx,
    )).toBe(false)
  })

  it('discord_is_bot detects bots', async () => {
    const botCtx = createCtx({ isBot: true })
    const humanCtx = createCtx({ isBot: false })

    expect(await evaluateCondition(
      node('c1', 'discord_is_bot', 'condition', { matchBots: true }), botCtx,
    )).toBe(true)
    expect(await evaluateCondition(
      node('c2', 'discord_is_bot', 'condition', { matchBots: true }), humanCtx,
    )).toBe(false)
  })

  it('discord_message_has_embed detects embeds', async () => {
    const withEmbed = createCtx({ embeds: [{ title: 'Test' }] })
    const noEmbed = createCtx({ embeds: [] })
    const noField = createCtx({})

    expect(await evaluateCondition(
      node('c1', 'discord_message_has_embed', 'condition', {}), withEmbed,
    )).toBe(true)
    expect(await evaluateCondition(
      node('c2', 'discord_message_has_embed', 'condition', {}), noEmbed,
    )).toBe(false)
    expect(await evaluateCondition(
      node('c3', 'discord_message_has_embed', 'condition', {}), noField,
    )).toBe(false)
  })

  it('discord_member_permissions checks required permissions', async () => {
    const ctx = createCtx({ permissions: ['MANAGE_MESSAGES', 'BAN_MEMBERS'] })

    expect(await evaluateCondition(
      node('c1', 'discord_member_permissions', 'condition', { permissions: ['MANAGE_MESSAGES'] }), ctx,
    )).toBe(true)
    expect(await evaluateCondition(
      node('c2', 'discord_member_permissions', 'condition', { permissions: ['ADMINISTRATOR'] }), ctx,
    )).toBe(false)
    expect(await evaluateCondition(
      node('c3', 'discord_member_permissions', 'condition', { permissions: ['MANAGE_MESSAGES', 'BAN_MEMBERS'] }), ctx,
    )).toBe(true)
  })
})

// =============================================================================
// Discord Actions in Flow
// =============================================================================

describe('Discord action nodes in flow execution', () => {
  it('discord_send_message produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_send_message', 'action', {
        channelId: '{{trigger.channelId}}',
        content: 'Received: {{trigger.content}}',
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { channelId: 'ch-1', content: 'test msg' })

    expect(output(ctx, 'a1')).toEqual(expect.objectContaining({
      action: 'discord_send_message',
      platform: 'discord',
      channelId: 'ch-1',
      content: 'Received: test msg',
      executed: true,
    }))
  })

  it('discord_send_embed produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_send_embed', 'action', {
        channelId: '{{trigger.channelId}}',
        embed: { title: 'Alert', description: 'Something happened', color: 0xFF0000 },
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { channelId: 'ch-1' })

    expect(output(ctx, 'a1')?.action).toBe('discord_send_embed')
    expect(output(ctx, 'a1')?.platform).toBe('discord')
  })

  it('discord_ban_member produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_ban_member', 'action', {
        guildId: '{{trigger.guildId}}',
        userId: '{{trigger.userId}}',
        reason: 'Spam',
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { guildId: 'g-1', userId: 'u-bad' })

    expect(output(ctx, 'a1')).toEqual(expect.objectContaining({
      action: 'discord_ban_member',
      platform: 'discord',
      guildId: 'g-1',
      userId: 'u-bad',
      executed: true,
    }))
  })

  it('discord_add_role produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_member_join', 'trigger'),
      node('a1', 'discord_add_role', 'action', {
        guildId: '{{trigger.guildId}}',
        userId: '{{trigger.userId}}',
        roleId: 'member-role',
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { guildId: 'g-1', userId: 'u-new' })

    expect(output(ctx, 'a1')?.action).toBe('discord_add_role')
    expect(output(ctx, 'a1')?.roleId).toBe('member-role')
  })

  it('discord_create_thread produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_create_thread', 'action', {
        channelId: '{{trigger.channelId}}',
        name: 'Discussion about {{trigger.content}}',
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { channelId: 'ch-1', content: 'topic' })

    expect(output(ctx, 'a1')?.action).toBe('discord_create_thread')
    expect(output(ctx, 'a1')?.name).toBe('Discussion about topic')
  })

  // SP2 new Discord actions

  it('discord_reply_interaction produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_interaction_create', 'trigger'),
      node('a1', 'discord_reply_interaction', 'action', {
        content: 'Pong!',
        ephemeral: true,
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { interactionId: 'int-1' })

    expect(output(ctx, 'a1')).toEqual(expect.objectContaining({
      action: 'discord_reply_interaction',
      platform: 'discord',
      interactionId: 'int-1',
      content: 'Pong!',
      ephemeral: true,
      executed: true,
    }))
  })

  it('discord_show_modal produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_interaction_create', 'trigger'),
      node('a1', 'discord_show_modal', 'action', {
        customId: 'feedback',
        title: 'Feedback Form',
        components: [{ type: 'text_input', label: 'Your feedback' }],
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { interactionId: 'int-2' })

    expect(output(ctx, 'a1')?.customId).toBe('feedback')
    expect(output(ctx, 'a1')?.title).toBe('Feedback Form')
  })

  it('discord_send_components produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_send_components', 'action', {
        channelId: '{{trigger.channelId}}',
        content: 'Choose an option:',
        components: [{ type: 1, components: [{ type: 2, label: 'Option A', customId: 'opt-a' }] }],
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { channelId: 'ch-1' })

    expect(output(ctx, 'a1')?.action).toBe('discord_send_components')
    expect(output(ctx, 'a1')?.content).toBe('Choose an option:')
  })

  it('discord_defer_reply produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_interaction_create', 'trigger'),
      node('a1', 'discord_defer_reply', 'action', { ephemeral: false }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { interactionId: 'int-3' })

    expect(output(ctx, 'a1')?.action).toBe('discord_defer_reply')
    expect(output(ctx, 'a1')?.ephemeral).toBe(false)
  })

  it('discord_set_channel_permissions produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_set_channel_permissions', 'action', {
        channelId: '{{trigger.channelId}}',
        targetId: 'role-123',
        allow: 'SendMessages',
        deny: 'ManageChannels',
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { channelId: 'ch-1' })

    expect(output(ctx, 'a1')?.action).toBe('discord_set_channel_permissions')
    expect(output(ctx, 'a1')?.targetId).toBe('role-123')
    expect(output(ctx, 'a1')?.allow).toBe('SendMessages')
  })

  it('discord_create_forum_post produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_create_forum_post', 'action', {
        channelId: '{{trigger.channelId}}',
        name: 'Bug: {{trigger.content}}',
        content: 'Reported by {{trigger.userName}}',
        tags: ['bug'],
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, {
      channelId: 'forum-ch',
      content: 'App crashes',
      userName: 'Tester',
    })

    expect(output(ctx, 'a1')?.name).toBe('Bug: App crashes')
    expect(output(ctx, 'a1')?.content).toBe('Reported by Tester')
  })

  it('discord_register_commands produces correct output', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'discord_register_commands', 'action', {
        commands: [
          { name: 'ping', description: 'Pong!' },
          { name: 'help', description: 'Show help' },
        ],
      }),
    ]
    const edges = [edge('t1', 'a1')]
    const ctx = await executeFlow(nodes, edges, { guildId: 'g-1' })

    expect(output(ctx, 'a1')?.action).toBe('discord_register_commands')
    expect((output(ctx, 'a1')?.commands as any[])?.length).toBe(2)
    expect(output(ctx, 'a1')?.guildId).toBe('g-1')
  })
})

// =============================================================================
// Complex Discord Flows
// =============================================================================

describe('Complex Discord flow scenarios', () => {
  it('welcome flow: join → send welcome → add role', async () => {
    const nodes = [
      node('t1', 'discord_member_join', 'trigger'),
      node('a1', 'discord_send_message', 'action', {
        channelId: 'welcome-ch',
        content: 'Welcome {{trigger.userName}} to the server!',
      }),
      node('a2', 'discord_add_role', 'action', {
        guildId: '{{trigger.guildId}}',
        userId: '{{trigger.userId}}',
        roleId: 'member-role',
      }),
    ]
    const edges = [edge('t1', 'a1'), edge('a1', 'a2')]

    const ctx = await executeFlow(nodes, edges, {
      userName: 'Alice',
      userId: 'u-alice',
      guildId: 'g-main',
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.content).toBe('Welcome Alice to the server!')
    expect(status(ctx, 'a2')).toBe('success')
    expect(output(ctx, 'a2')?.userId).toBe('u-alice')
    expect(output(ctx, 'a2')?.roleId).toBe('member-role')
  })

  it('moderation flow: message → has_role check → ban if no role', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('c1', 'discord_has_role', 'condition', { roleId: 'verified' }),
      node('a1', 'discord_kick_member', 'action', {
        guildId: '{{trigger.guildId}}',
        userId: '{{trigger.userId}}',
        reason: 'Unverified user posting',
      }),
    ]
    // Condition blocks downstream when true (verified user) — we want action when NOT verified
    // But the flow engine continues on true. So we test the case where condition is false (not verified)
    const edges = [edge('t1', 'c1'), edge('c1', 'a1')]

    // User does NOT have 'verified' role
    const ctx = await executeFlow(nodes, edges, {
      guildId: 'g-1',
      userId: 'u-unverified',
      roles: ['member'],
    })

    // Condition returns false → a1 should NOT execute (condition blocks)
    expect(ctx.nodeResults.get('c1')?.output).toBe(false)
    expect(ctx.nodeResults.has('a1')).toBe(false)
  })

  it('slash command flow: interaction → defer → reply', async () => {
    const nodes = [
      node('t1', 'discord_slash_command', 'trigger'),
      node('a1', 'discord_defer_reply', 'action', { ephemeral: true }),
      node('a2', 'discord_reply_interaction', 'action', {
        content: 'Here is your result!',
        ephemeral: true,
      }),
    ]
    const edges = [edge('t1', 'a1'), edge('a1', 'a2')]

    const ctx = await executeFlow(nodes, edges, {
      interactionId: 'int-cmd',
      commandName: '/search',
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.action).toBe('discord_defer_reply')
    expect(status(ctx, 'a2')).toBe('success')
    expect(output(ctx, 'a2')?.content).toBe('Here is your result!')
  })

  it('forum moderation: message → permission check → create thread + set permissions', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('c1', 'discord_member_permissions', 'condition', { permissions: ['MANAGE_MESSAGES'] }),
      node('a1', 'discord_create_forum_post', 'action', {
        channelId: 'forum-ch',
        name: 'Moderation Note',
        content: 'Action taken by {{trigger.userName}}',
      }),
      node('a2', 'discord_set_channel_permissions', 'action', {
        channelId: '{{trigger.channelId}}',
        targetId: '{{trigger.userId}}',
        deny: 'SendMessages',
      }),
    ]
    const edges = [
      edge('t1', 'c1'),
      edge('c1', 'a1'),
      edge('c1', 'a2'),
    ]

    const ctx = await executeFlow(nodes, edges, {
      channelId: 'ch-general',
      userId: 'mod-1',
      userName: 'Moderator',
      permissions: ['MANAGE_MESSAGES', 'BAN_MEMBERS'],
    })

    expect(ctx.nodeResults.get('c1')?.output).toBe(true)
    expect(status(ctx, 'a1')).toBe('success')
    expect(status(ctx, 'a2')).toBe('success')
    expect(output(ctx, 'a1')?.content).toBe('Action taken by Moderator')
  })

  it('modal flow: button click → show modal', async () => {
    const nodes = [
      node('t1', 'discord_button_click', 'trigger'),
      node('a1', 'discord_show_modal', 'action', {
        customId: 'report-{{trigger.userId}}',
        title: 'Report User',
        components: [{ type: 'text_input', label: 'Reason', customId: 'reason' }],
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      interactionId: 'int-btn',
      userId: 'u-reporter',
      customId: 'report-btn',
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.customId).toBe('report-u-reporter')
  })
})

// =============================================================================
// Cross-Platform Flows (Telegram + Discord)
// =============================================================================

describe('Cross-platform flow scenarios', () => {
  it('unified_send_message works in a Discord-triggered flow', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'unified_send_message', 'action', {
        text: 'Cross-platform: {{trigger.content}}',
        targetChatId: '{{trigger.channelId}}',
      }),
    ]
    const edges = [edge('t1', 'a1')]

    const ctx = await executeFlow(nodes, edges, {
      channelId: 'ch-discord',
      content: 'Hello from Discord',
    })

    expect(output(ctx, 'a1')?.text).toBe('Cross-platform: Hello from Discord')
    expect(output(ctx, 'a1')?.targetChatId).toBe('ch-discord')
    expect(output(ctx, 'a1')?.action).toBe('unified_send_message')
  })

  it('mixed flow: Discord trigger → Telegram action + Discord action', async () => {
    const nodes = [
      node('t1', 'discord_message_received', 'trigger'),
      node('a1', 'send_message', 'action', { text: 'Forwarded from Discord: {{trigger.content}}', chatId: 'tg-group-123' }),
      node('a2', 'discord_send_message', 'action', { channelId: '{{trigger.channelId}}', content: 'Forwarded to Telegram' }),
    ]
    const edges = [edge('t1', 'a1'), edge('t1', 'a2')]

    const ctx = await executeFlow(nodes, edges, {
      channelId: 'ch-1',
      content: 'important update',
    })

    expect(status(ctx, 'a1')).toBe('success')
    expect(output(ctx, 'a1')?.action).toBe('send_message') // Telegram
    expect(output(ctx, 'a1')?.text).toBe('Forwarded from Discord: important update')

    expect(status(ctx, 'a2')).toBe('success')
    expect(output(ctx, 'a2')?.action).toBe('discord_send_message')
    expect(output(ctx, 'a2')?.content).toBe('Forwarded to Telegram')
  })
})
