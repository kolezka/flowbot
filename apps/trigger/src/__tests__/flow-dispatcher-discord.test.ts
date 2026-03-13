import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FlowContext, NodeResult } from '../lib/flow-engine/types.js'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockTransport, mockPrisma, mockFetchFn } = vi.hoisted(() => {
  const mockTransport = {
    sendMessage: vi.fn().mockResolvedValue({ id: 1, date: 0, peerId: '123' }),
    sendPhoto: vi.fn().mockResolvedValue({ id: 2, date: 0, peerId: '123' }),
    sendVideo: vi.fn().mockResolvedValue({ id: 3, date: 0, peerId: '123' }),
    sendDocument: vi.fn().mockResolvedValue({ id: 4, date: 0, peerId: '123' }),
    sendSticker: vi.fn().mockResolvedValue({ id: 5, date: 0, peerId: '123' }),
    sendVoice: vi.fn().mockResolvedValue({ id: 6, date: 0, peerId: '123' }),
    sendAudio: vi.fn().mockResolvedValue({ id: 7, date: 0, peerId: '123' }),
    sendAnimation: vi.fn().mockResolvedValue({ id: 8, date: 0, peerId: '123' }),
    sendLocation: vi.fn().mockResolvedValue({ id: 9, date: 0, peerId: '123' }),
    sendContact: vi.fn().mockResolvedValue({ id: 10, date: 0, peerId: '123' }),
    sendVenue: vi.fn().mockResolvedValue({ id: 11, date: 0, peerId: '123' }),
    sendDice: vi.fn().mockResolvedValue({ id: 12, date: 0, peerId: '123' }),
    forwardMessage: vi.fn().mockResolvedValue([{ id: 13, date: 0, peerId: '123' }]),
    copyMessage: vi.fn().mockResolvedValue([{ id: 14, date: 0, peerId: '123' }]),
    editMessage: vi.fn().mockResolvedValue({ id: 15, date: 0, peerId: '123' }),
    deleteMessages: vi.fn().mockResolvedValue(true),
    pinMessage: vi.fn().mockResolvedValue(true),
    unpinMessage: vi.fn().mockResolvedValue(true),
    banUser: vi.fn().mockResolvedValue(true),
    restrictUser: vi.fn().mockResolvedValue(true),
    promoteUser: vi.fn().mockResolvedValue(true),
    setChatTitle: vi.fn().mockResolvedValue(true),
    setChatDescription: vi.fn().mockResolvedValue(true),
    exportInviteLink: vi.fn().mockResolvedValue('https://t.me/+abc'),
    getChatMember: vi.fn().mockResolvedValue({ userId: '123', status: 'member' }),
    leaveChat: vi.fn().mockResolvedValue(true),
    createPoll: vi.fn().mockResolvedValue({ id: 16, date: 0, peerId: '123' }),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
  }

  const mockPrisma = {
    botInstance: {
      findUnique: vi.fn(),
    },
  }

  const mockFetchFn = vi.fn()

  return { mockTransport, mockPrisma, mockFetchFn }
})

vi.mock('@trigger.dev/sdk/v3', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('../lib/telegram.js', () => ({
  getTelegramTransport: vi.fn().mockResolvedValue(mockTransport),
}))

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => mockPrisma),
}))

import { dispatchActions } from '../lib/flow-engine/dispatcher.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(
  nodeResults: Array<{ id: string; action: string; params?: Record<string, unknown> }>,
): FlowContext {
  const results = new Map<string, NodeResult>()
  for (const nr of nodeResults) {
    results.set(nr.id, {
      nodeId: nr.id,
      status: 'success',
      output: { action: nr.action, executed: true, ...(nr.params ?? {}) },
      startedAt: new Date(),
      completedAt: new Date(),
    })
  }
  return {
    flowId: 'test-flow',
    executionId: 'test-exec',
    variables: new Map(),
    triggerData: {},
    nodeResults: results,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dispatchActions - Discord routing', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = globalThis.fetch

    // Default: Discord bot instance is available
    mockPrisma.botInstance.findUnique.mockResolvedValue({
      apiUrl: 'http://discord-bot:3003',
      isActive: true,
    })

    // Default: fetch succeeds for Discord bot API
    mockFetchFn.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, result: {} }),
      text: vi.fn().mockResolvedValue(''),
    })
    globalThis.fetch = mockFetchFn
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // --- discord_ prefix detection ---

  it('routes discord_ prefixed actions to Discord bot API', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hello' } },
    ])

    const results = await dispatchActions(ctx, { discordBotInstanceId: 'dbot-1' })
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(true)

    expect(mockPrisma.botInstance.findUnique).toHaveBeenCalledWith({
      where: { id: 'dbot-1' },
      select: { apiUrl: true, isActive: true },
    })

    expect(mockFetchFn).toHaveBeenCalledWith(
      'http://discord-bot:3003/api/execute-action',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('discord_send_message'),
      }),
    )
  })

  it('routes all Discord action types through dispatchViaDiscordBotApi', async () => {
    const discordActions = [
      'discord_send_message',
      'discord_send_embed',
      'discord_send_dm',
      'discord_edit_message',
      'discord_delete_message',
      'discord_add_reaction',
      'discord_remove_reaction',
      'discord_pin_message',
      'discord_unpin_message',
      'discord_ban_member',
      'discord_kick_member',
      'discord_timeout_member',
      'discord_add_role',
      'discord_remove_role',
      'discord_create_role',
      'discord_set_nickname',
      'discord_create_channel',
      'discord_delete_channel',
      'discord_move_member',
      'discord_create_thread',
      'discord_send_thread_message',
      'discord_create_invite',
      'discord_create_scheduled_event',
    ]

    for (const action of discordActions) {
      vi.clearAllMocks()
      mockPrisma.botInstance.findUnique.mockResolvedValue({
        apiUrl: 'http://discord-bot:3003',
        isActive: true,
      })
      mockFetchFn.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
        text: vi.fn().mockResolvedValue(''),
      })

      const ctx = makeCtx([
        { id: 'n1', action, params: { channelId: 'ch-1', guildId: 'g-1' } },
      ])

      const results = await dispatchActions(ctx, { discordBotInstanceId: 'dbot-1' })
      expect(results).toHaveLength(1)
      expect(results[0].dispatched).toBe(true)
      expect(mockFetchFn).toHaveBeenCalledTimes(1)
    }
  })

  // --- discordBotInstanceId fallback ---

  it('falls back to botInstanceId when discordBotInstanceId is not set', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(true)

    expect(mockPrisma.botInstance.findUnique).toHaveBeenCalledWith({
      where: { id: 'bot-1' },
      select: { apiUrl: true, isActive: true },
    })
  })

  it('prefers discordBotInstanceId over botInstanceId', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, {
      botInstanceId: 'tg-bot-1',
      discordBotInstanceId: 'dbot-1',
    })
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(true)

    expect(mockPrisma.botInstance.findUnique).toHaveBeenCalledWith({
      where: { id: 'dbot-1' },
      select: { apiUrl: true, isActive: true },
    })
  })

  // --- Error: no bot instance ID ---

  it('errors when Discord action has no bot instance ID at all', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, {})
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(false)
    expect(results[0].error).toContain('requires a discordBotInstanceId')
  })

  // --- Error: bot instance not found / inactive ---

  it('errors when Discord bot instance is not found', async () => {
    mockPrisma.botInstance.findUnique.mockResolvedValue(null)

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { discordBotInstanceId: 'missing-bot' })
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(false)
    expect(results[0].error).toContain('not available')
  })

  it('errors when Discord bot instance is inactive', async () => {
    mockPrisma.botInstance.findUnique.mockResolvedValue({
      apiUrl: 'http://discord-bot:3003',
      isActive: false,
    })

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { discordBotInstanceId: 'inactive-bot' })
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(false)
    expect(results[0].error).toContain('not available')
  })

  // --- Error: Discord bot API returns error ---

  it('errors when Discord bot API returns non-OK response', async () => {
    mockFetchFn.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    })

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { discordBotInstanceId: 'dbot-1' })
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(false)
    expect(results[0].error).toContain('500')
  })

  // --- Cross-platform flows ---

  it('dispatches mixed Telegram and Discord actions correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'TG message' } },
      { id: 'n2', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'DC message' } },
      { id: 'n3', action: 'ban_user', params: { chatId: '123', userId: '456' } },
      { id: 'n4', action: 'discord_ban_member', params: { guildId: 'g-1', userId: 'u-1' } },
    ])

    const results = await dispatchActions(ctx, { discordBotInstanceId: 'dbot-1' })

    expect(results).toHaveLength(4)
    expect(results.every(r => r.dispatched)).toBe(true)

    // Telegram actions used the mock transport
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('123', 'TG message', expect.any(Object))
    expect(mockTransport.banUser).toHaveBeenCalledWith('123', '456')

    // Discord actions used fetch (bot API)
    const fetchCalls = mockFetchFn.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes('/api/execute-action'),
    )
    expect(fetchCalls).toHaveLength(2)
  })

  // --- Telegram actions still work normally ---

  it('does not route non-discord actions to Discord API', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hello TG' } },
    ])

    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendMessage).toHaveBeenCalled()
    expect(mockFetchFn).not.toHaveBeenCalled()
  })

  // --- Internal actions still skipped ---

  it('skips internal actions even with Discord config', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'delay', params: {} },
      { id: 'n2', action: 'transform', params: {} },
    ])

    const results = await dispatchActions(ctx, { discordBotInstanceId: 'dbot-1' })
    expect(results).toHaveLength(0)
  })
})

// Separate import to restore the afterEach
import { afterEach } from 'vitest'
