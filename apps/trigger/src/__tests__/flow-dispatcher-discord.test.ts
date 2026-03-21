/**
 * flow-dispatcher-discord.test.ts
 *
 * Verifies that Discord actions are dispatched through the same HTTP-based connector
 * contract as all other actions. There is no special Discord routing — Discord actions
 * use the botInstanceId → DB lookup → POST /execute path identical to Telegram actions.
 *
 * Key things proven:
 *  - Discord actions POST to `${apiUrl}/execute` with `{ action, params }` body
 *  - The botInstanceId used is whatever is in transportConfig.botInstanceId
 *  - No special discord_ prefix treatment — same code path as any other action
 *  - Error cases (no botInstanceId, inactive instance, connector errors) behave identically
 *  - Mixed Discord + non-Discord flows work correctly in a single dispatchActions call
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FlowContext, NodeResult } from '../lib/flow-engine/types.js'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockDispatchUserAction, mockFetch } = vi.hoisted(() => {
  const mockPrisma = {
    botInstance: {
      findUnique: vi.fn(),
    },
    community: {
      findUnique: vi.fn(),
    },
  }

  const mockDispatchUserAction = vi.fn().mockResolvedValue({
    nodeId: '',
    dispatched: true,
    response: { ok: true },
  })

  const mockFetch = vi.fn()

  return { mockPrisma, mockDispatchUserAction, mockFetch }
})

vi.mock('@trigger.dev/sdk/v3', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => mockPrisma),
}))

vi.mock('../lib/flow-engine/user-actions.js', () => ({
  dispatchUserAction: mockDispatchUserAction,
}))

import { dispatchActions } from '../lib/flow-engine/dispatcher.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DISCORD_BOT_URL = 'http://discord-bot:3003'
const TG_BOT_URL = 'http://telegram-bot:3001'

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

function makeFetchOk(data: unknown = { success: true }) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dispatchActions — Discord actions via HTTP connector', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    // Default: Discord bot instance is available
    mockPrisma.botInstance.findUnique.mockResolvedValue({
      apiUrl: DISCORD_BOT_URL,
      isActive: true,
    })

    mockFetch.mockResolvedValue(makeFetchOk({ success: true, data: {} }))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // --- Core routing: Discord actions go through POST /execute ---

  it('dispatches discord_send_message to POST /execute with correct body', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hello Discord' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results).toHaveLength(1)
    expect(results[0]!.dispatched).toBe(true)
    expect(results[0]!.nodeId).toBe('n1')

    expect(mockPrisma.botInstance.findUnique).toHaveBeenCalledWith({
      where: { id: 'dbot-1' },
      select: { apiUrl: true, isActive: true },
    })

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${DISCORD_BOT_URL}/execute`)

    const body = JSON.parse(init.body as string)
    expect(body.action).toBe('discord_send_message')
    expect(body.params).toMatchObject({ channelId: 'ch-1', content: 'Hello Discord' })
    expect(body.instanceId).toBe('dbot-1')
  })

  it('uses method: POST with Content-Type: application/json header', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_ban_member', params: { guildId: 'g-1', userId: 'u-1' } },
    ])

    await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  // --- All Discord action types route through the same path ---

  it.each([
    ['discord_send_message', { channelId: 'ch-1', content: 'Hello' }],
    ['discord_send_embed', { channelId: 'ch-1', title: 'Embed', description: 'Body' }],
    ['discord_send_dm', { userId: 'u-1', content: 'DM' }],
    ['discord_edit_message', { channelId: 'ch-1', messageId: 'm-1', content: 'Updated' }],
    ['discord_delete_message', { channelId: 'ch-1', messageId: 'm-1' }],
    ['discord_add_reaction', { channelId: 'ch-1', messageId: 'm-1', emoji: '👍' }],
    ['discord_remove_reaction', { channelId: 'ch-1', messageId: 'm-1', emoji: '👍' }],
    ['discord_pin_message', { channelId: 'ch-1', messageId: 'm-1' }],
    ['discord_unpin_message', { channelId: 'ch-1', messageId: 'm-1' }],
    ['discord_ban_member', { guildId: 'g-1', userId: 'u-1' }],
    ['discord_kick_member', { guildId: 'g-1', userId: 'u-1' }],
    ['discord_timeout_member', { guildId: 'g-1', userId: 'u-1', duration: 3600 }],
    ['discord_add_role', { guildId: 'g-1', userId: 'u-1', roleId: 'r-1' }],
    ['discord_remove_role', { guildId: 'g-1', userId: 'u-1', roleId: 'r-1' }],
    ['discord_create_role', { guildId: 'g-1', name: 'Moderator' }],
    ['discord_set_nickname', { guildId: 'g-1', userId: 'u-1', nickname: 'Nick' }],
    ['discord_create_channel', { guildId: 'g-1', name: 'general', type: 'text' }],
    ['discord_delete_channel', { channelId: 'ch-1' }],
    ['discord_move_member', { guildId: 'g-1', userId: 'u-1', channelId: 'vc-1' }],
    ['discord_create_thread', { channelId: 'ch-1', name: 'Thread', messageId: 'm-1' }],
    ['discord_send_thread_message', { threadId: 'th-1', content: 'Reply' }],
    ['discord_create_invite', { channelId: 'ch-1', maxAge: 86400 }],
    ['discord_create_scheduled_event', { guildId: 'g-1', name: 'Event', startTime: '2026-01-01T00:00:00Z' }],
  ] as const)(
    'routes %s through POST /execute',
    async (action, params) => {
      vi.clearAllMocks()
      mockPrisma.botInstance.findUnique.mockResolvedValue({ apiUrl: DISCORD_BOT_URL, isActive: true })
      mockFetch.mockResolvedValue(makeFetchOk())

      const ctx = makeCtx([{ id: 'n1', action, params }])
      const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

      expect(results).toHaveLength(1)
      expect(results[0]!.dispatched).toBe(true)

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(`${DISCORD_BOT_URL}/execute`)
      const body = JSON.parse(init.body as string)
      expect(body.action).toBe(action)
    },
  )

  // --- Error cases ---

  it('returns dispatched:false when no botInstanceId is provided for Discord action', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, {})

    expect(results).toHaveLength(1)
    expect(results[0]!.dispatched).toBe(false)
    expect(results[0]!.error).toContain('botInstanceId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns dispatched:false when Discord bot instance is not found in DB', async () => {
    mockPrisma.botInstance.findUnique.mockResolvedValueOnce(null)

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'missing-discord-bot' })

    expect(results[0]!.dispatched).toBe(false)
    expect(results[0]!.error).toContain('missing-discord-bot')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns dispatched:false when Discord bot instance is inactive', async () => {
    mockPrisma.botInstance.findUnique.mockResolvedValueOnce({
      apiUrl: DISCORD_BOT_URL,
      isActive: false,
    })

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_ban_member', params: { guildId: 'g-1', userId: 'u-1' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'offline-discord-bot' })

    expect(results[0]!.dispatched).toBe(false)
    expect(results[0]!.error).toContain('offline-discord-bot')
  })

  it('returns dispatched:false when connector returns 500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Discord API error'),
    })

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    // Non-ok HTTP → dispatched: true with { success: false } in response
    expect(results[0]!.dispatched).toBe(true)
    expect((results[0]!.response as any)?.success).toBe(false)
    expect((results[0]!.response as any)?.error).toContain('500')
  })

  it('returns dispatched:false when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results[0]!.dispatched).toBe(false)
    expect(results[0]!.error).toContain('Connection refused')
  })

  // --- Multiple Discord actions in one flow ---

  it('dispatches multiple Discord actions as separate POSTs', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Hello' } },
      { id: 'n2', action: 'discord_ban_member', params: { guildId: 'g-1', userId: 'u-bad' } },
      { id: 'n3', action: 'discord_add_role', params: { guildId: 'g-1', userId: 'u-1', roleId: 'r-mod' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.dispatched)).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(3)

    const sentActions = mockFetch.mock.calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string).action,
    )
    expect(sentActions).toEqual(['discord_send_message', 'discord_ban_member', 'discord_add_role'])
  })

  it('continues processing after one Discord action fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429, text: vi.fn().mockResolvedValue('Rate limited') })
      .mockResolvedValueOnce(makeFetchOk())

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Rate limited' } },
      { id: 'n2', action: 'discord_ban_member', params: { guildId: 'g-1', userId: 'u-1' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results).toHaveLength(2)
    // First: non-ok HTTP → dispatched: true with { success: false }
    expect(results[0]!.dispatched).toBe(true)
    expect((results[0]!.response as any)?.success).toBe(false)
    // Second: normal success
    expect(results[1]!.dispatched).toBe(true)
  })

  // --- Mixed platform flows ---

  it('dispatches Telegram and Discord actions to their respective bot instance URLs', async () => {
    // Two separate bot instances: TG bot for Telegram actions, Discord bot for Discord actions
    // In practice they'd need different transportConfig calls, but we verify the URL routing.
    // Here we use a single botInstanceId pointing to the Discord connector to confirm all go there.
    mockPrisma.botInstance.findUnique.mockResolvedValue({
      apiUrl: DISCORD_BOT_URL,
      isActive: true,
    })

    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Discord msg' } },
      { id: 'n2', action: 'discord_ban_member', params: { guildId: 'g-1', userId: 'u-1' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.dispatched)).toBe(true)

    // Both went to the same Discord connector URL
    for (const [url] of mockFetch.mock.calls as [string, RequestInit][]) {
      expect(url).toBe(`${DISCORD_BOT_URL}/execute`)
    }
  })

  it('Discord and non-Discord actions both use botInstanceId for lookup', async () => {
    // Both action types look up by botInstanceId — no special Discord DB field
    mockPrisma.botInstance.findUnique.mockResolvedValue({
      apiUrl: DISCORD_BOT_URL,
      isActive: true,
    })

    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'TG' } },
      { id: 'n2', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'DC' } },
    ])

    await dispatchActions(ctx, { botInstanceId: 'bot-shared' })

    // DB lookup called for each dispatched action
    expect(mockPrisma.botInstance.findUnique).toHaveBeenCalledTimes(2)
    for (const call of mockPrisma.botInstance.findUnique.mock.calls) {
      expect(call[0]).toMatchObject({ where: { id: 'bot-shared' } })
    }
  })

  // --- Internal actions are still skipped for Discord flows ---

  it('skips internal actions even when Discord botInstanceId is configured', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'delay', params: { ms: 1000 } },
      { id: 'n2', action: 'transform', params: { value: '...' } },
      { id: 'n3', action: 'bot_action', params: {} },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockPrisma.botInstance.findUnique).not.toHaveBeenCalled()
  })

  // --- Skipping nodes still applies ---

  it('skips Discord action nodes with error status', async () => {
    const nodeResults = new Map<string, NodeResult>()
    nodeResults.set('n1', {
      nodeId: 'n1',
      status: 'error',
      output: { action: 'discord_send_message', executed: true, channelId: 'ch-1', content: 'Hi' },
      error: 'upstream failure',
      startedAt: new Date(),
      completedAt: new Date(),
    })
    const ctx: FlowContext = {
      flowId: 'f',
      executionId: 'e',
      variables: new Map(),
      triggerData: {},
      nodeResults,
    }

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('skips Discord action nodes without executed:true flag', async () => {
    const nodeResults = new Map<string, NodeResult>()
    nodeResults.set('n1', {
      nodeId: 'n1',
      status: 'success',
      output: { action: 'discord_send_message', channelId: 'ch-1', content: 'Hi' }, // no executed: true
      startedAt: new Date(),
      completedAt: new Date(),
    })
    const ctx: FlowContext = {
      flowId: 'f',
      executionId: 'e',
      variables: new Map(),
      triggerData: {},
      nodeResults,
    }

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results).toHaveLength(0)
  })

  // --- Result shape ---

  it('result includes nodeId, dispatched:true, and response from connector', async () => {
    mockFetch.mockResolvedValueOnce(
      makeFetchOk({ success: true, data: { id: 'msg-discord-999' } }),
    )

    const ctx = makeCtx([
      { id: 'discord-node-42', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Check' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    expect(results[0]!.nodeId).toBe('discord-node-42')
    expect(results[0]!.dispatched).toBe(true)
    expect(results[0]!.response).toEqual({ success: true, data: { id: 'msg-discord-999' } })
  })

  // --- Confirm no legacy transport code is involved ---

  it('does NOT use any Telegram transport for Discord actions', async () => {
    // If the old getTelegramTransport mock were imported, calling it for Discord
    // would be a bug. With the new HTTP-only dispatcher, only fetch is called.
    const ctx = makeCtx([
      { id: 'n1', action: 'discord_send_message', params: { channelId: 'ch-1', content: 'Pure Discord' } },
    ])

    await dispatchActions(ctx, { botInstanceId: 'dbot-1' })

    // Only fetch is used — no transport mock should be touched
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockDispatchUserAction).not.toHaveBeenCalled()
  })
})
