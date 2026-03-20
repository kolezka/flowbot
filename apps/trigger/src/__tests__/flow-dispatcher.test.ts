import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FlowContext, NodeResult } from '../lib/flow-engine/types.js'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use them
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

import { dispatchAction, dispatchActions, dispatchActionToCommunity } from '../lib/flow-engine/dispatcher.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOT_API_URL = 'http://telegram-bot:3001'

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

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

// ---------------------------------------------------------------------------
// dispatchAction — unit tests for the HTTP dispatch primitive
// ---------------------------------------------------------------------------

describe('dispatchAction', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('POSTs to ${apiUrl}/execute with correct method, headers, and body', async () => {
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse({ success: true, data: { messageId: '123' } }),
    )

    const result = await dispatchAction('send_message', { chatId: '123', text: 'Hello' }, BOT_API_URL)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BOT_API_URL}/execute`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')

    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ action: 'send_message', params: { chatId: '123', text: 'Hello' } })

    expect(result).toEqual({ success: true, data: { messageId: '123' } })
  })

  it('returns success: false with error message when connector returns non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    })

    const result = await dispatchAction('ban_user', { chatId: '-100123', userId: '456' }, BOT_API_URL)

    expect(result.success).toBe(false)
    expect(result.error).toContain('500')
    expect(result.error).toContain('Internal Server Error')
  })

  it('returns success: false with error message when connector returns 400', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('Bad Request: missing chatId'),
    })

    const result = await dispatchAction('send_message', { text: 'oops' }, BOT_API_URL)

    expect(result.success).toBe(false)
    expect(result.error).toContain('400')
    expect(result.error).toContain('Bad Request')
  })

  it('propagates fetch network error (throws) to the caller', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(
      dispatchAction('send_message', { chatId: '123', text: 'Hi' }, BOT_API_URL),
    ).rejects.toThrow('ECONNREFUSED')
  })

  it('returns the full connector response data on success', async () => {
    const payload = { success: true, data: { messageId: '999', timestamp: 1234567890 } }
    mockFetch.mockResolvedValueOnce(makeFetchResponse(payload))

    const result = await dispatchAction('send_message', { chatId: '123', text: 'Hi' }, BOT_API_URL)

    expect(result).toEqual(payload)
  })

  it('includes AbortSignal in the fetch call (timeout guard)', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ success: true }))

    await dispatchAction('send_message', { chatId: '123', text: 'Hi' }, BOT_API_URL)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// dispatchActions — integration-level tests for the orchestration loop
// ---------------------------------------------------------------------------

describe('dispatchActions', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    // Default: bot instance is active and reachable
    mockPrisma.botInstance.findUnique.mockResolvedValue({
      apiUrl: BOT_API_URL,
      isActive: true,
    })

    // Default: fetch succeeds
    mockFetch.mockResolvedValue(makeFetchResponse({ success: true, data: { messageId: '1' } }))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // --- Correct HTTP dispatch ---

  it('dispatches send_message to POST /execute with correct body', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hello' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(1)
    expect(results[0]!.dispatched).toBe(true)
    expect(results[0]!.nodeId).toBe('n1')

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BOT_API_URL}/execute`)
    const body = JSON.parse(init.body as string)
    expect(body.action).toBe('send_message')
    expect(body.params).toMatchObject({ chatId: '123', text: 'Hello', action: 'send_message' })
  })

  it('dispatches ban_user via POST /execute with correct body', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'ban_user', params: { chatId: '-100123', userId: '456' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(1)
    expect(results[0]!.dispatched).toBe(true)

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BOT_API_URL}/execute`)
    const body = JSON.parse(init.body as string)
    expect(body.action).toBe('ban_user')
    expect(body.params).toMatchObject({ chatId: '-100123', userId: '456' })
  })

  it('dispatches multiple actions sequentially, each as a separate POST', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'First' } },
      { id: 'n2', action: 'ban_user', params: { chatId: '123', userId: '456' } },
      { id: 'n3', action: 'pin_message', params: { chatId: '123', messageId: 99 } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.dispatched)).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(3)

    const actions = mockFetch.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).action)
    expect(actions).toEqual(['send_message', 'ban_user', 'pin_message'])
  })

  it('attaches the nodeId to each dispatch result', async () => {
    const ctx = makeCtx([
      { id: 'node-abc', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results[0]!.nodeId).toBe('node-abc')
  })

  it('includes connector response in result.response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse({ success: true, data: { messageId: '42' } }),
    )
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results[0]!.response).toEqual({ success: true, data: { messageId: '42' } })
  })

  // --- botInstanceId DB resolution ---

  it('looks up the bot instance from the database using botInstanceId', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    await dispatchActions(ctx, { botInstanceId: 'bot-xyz' })

    expect(mockPrisma.botInstance.findUnique).toHaveBeenCalledWith({
      where: { id: 'bot-xyz' },
      select: { apiUrl: true, isActive: true },
    })
  })

  it('uses apiUrl from the bot instance for the fetch call', async () => {
    mockPrisma.botInstance.findUnique.mockResolvedValueOnce({
      apiUrl: 'http://custom-bot:9000',
      isActive: true,
    })
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    await dispatchActions(ctx, { botInstanceId: 'bot-custom' })

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://custom-bot:9000/execute')
  })

  // --- Error: missing botInstanceId ---

  it('returns dispatched:false when no botInstanceId is provided', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, {})

    expect(results).toHaveLength(1)
    expect(results[0]!.dispatched).toBe(false)
    expect(results[0]!.error).toContain('botInstanceId')
  })

  // --- Error: bot instance not found / inactive ---

  it('returns dispatched:false when bot instance is not found in DB', async () => {
    mockPrisma.botInstance.findUnique.mockResolvedValueOnce(null)
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'ghost-bot' })

    expect(results[0]!.dispatched).toBe(false)
    expect(results[0]!.error).toContain('ghost-bot')
  })

  it('returns dispatched:false when bot instance is inactive', async () => {
    mockPrisma.botInstance.findUnique.mockResolvedValueOnce({
      apiUrl: BOT_API_URL,
      isActive: false,
    })
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'inactive-bot' })

    expect(results[0]!.dispatched).toBe(false)
    expect(results[0]!.error).toContain('inactive-bot')
  })

  it('returns dispatched:false when bot instance has no apiUrl', async () => {
    mockPrisma.botInstance.findUnique.mockResolvedValueOnce({
      apiUrl: null,
      isActive: true,
    })
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'no-url-bot' })

    expect(results[0]!.dispatched).toBe(false)
  })

  // --- Error: connector returns error status ---

  it('returns dispatched:false when connector returns non-ok HTTP status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Service unavailable'),
    })
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    // dispatchAction returns { success: false } on non-ok — doesn't throw
    // so dispatchActions sets dispatched: true with the error in response
    expect(results[0]!.dispatched).toBe(true)
    expect((results[0]!.response as any)?.success).toBe(false)
    expect((results[0]!.response as any)?.error).toContain('500')
  })

  it('continues processing after one action fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: vi.fn().mockResolvedValue('Down') })
      .mockResolvedValueOnce(makeFetchResponse({ success: true, data: {} }))

    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Fail' } },
      { id: 'n2', action: 'ban_user', params: { chatId: '123', userId: '456' } },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(2)
    // First action: non-ok HTTP → dispatched: true with { success: false } response
    expect(results[0]!.dispatched).toBe(true)
    expect((results[0]!.response as any)?.success).toBe(false)
    // Second action: normal success
    expect(results[1]!.dispatched).toBe(true)
  })

  // --- Skipping behavior ---

  it('skips all internal actions and returns empty results', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'delay', params: {} },
      { id: 'n2', action: 'api_call', params: {} },
      { id: 'n3', action: 'db_query', params: {} },
      { id: 'n4', action: 'transform', params: {} },
      { id: 'n5', action: 'loop', params: {} },
      { id: 'n6', action: 'switch', params: {} },
      { id: 'n7', action: 'parallel_branch', params: {} },
      { id: 'n8', action: 'notification', params: {} },
      { id: 'n9', action: 'bot_action', params: {} },
      { id: 'n10', action: 'get_context', params: {} },
      { id: 'n11', action: 'set_context', params: {} },
      { id: 'n12', action: 'delete_context', params: {} },
      { id: 'n13', action: 'run_flow', params: {} },
      { id: 'n14', action: 'emit_event', params: {} },
    ])

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('skips nodes with error status', async () => {
    const nodeResults = new Map<string, NodeResult>()
    nodeResults.set('n1', {
      nodeId: 'n1',
      status: 'error',
      output: { action: 'send_message', executed: true, chatId: '123', text: 'Hi' },
      error: 'execution failed upstream',
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

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('skips nodes without the executed:true flag', async () => {
    const nodeResults = new Map<string, NodeResult>()
    nodeResults.set('n1', {
      nodeId: 'n1',
      status: 'success',
      // no executed: true — node did not run an action
      output: { action: 'send_message', chatId: '123', text: 'Hi' },
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

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(0)
  })

  it('skips nodes with no output', async () => {
    const nodeResults = new Map<string, NodeResult>()
    nodeResults.set('n1', {
      nodeId: 'n1',
      status: 'success',
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

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(0)
  })

  it('returns empty array for an empty context', async () => {
    const ctx: FlowContext = {
      flowId: 'f',
      executionId: 'e',
      variables: new Map(),
      triggerData: {},
      nodeResults: new Map(),
    }

    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // --- user_* actions routed to dispatchUserAction ---

  it('routes user_* actions to dispatchUserAction, not fetch', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'user_send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    const results = await dispatchActions(ctx, {
      botInstanceId: 'bot-1',
      platformConnectionId: 'conn-abc',
    })

    expect(results).toHaveLength(1)
    expect(results[0]!.dispatched).toBe(true)
    expect(mockDispatchUserAction).toHaveBeenCalledWith(
      'user_send_message',
      expect.objectContaining({ chatId: '123', text: 'Hi' }),
      'conn-abc',
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uses connectionOverride from node output for user_* actions', async () => {
    const ctx = makeCtx([
      {
        id: 'n1',
        action: 'user_get_chat_history',
        params: { chatId: '123', connectionOverride: 'conn-override-789' },
      },
    ])

    await dispatchActions(ctx, {
      botInstanceId: 'bot-1',
      platformConnectionId: 'conn-default',
    })

    expect(mockDispatchUserAction).toHaveBeenCalledWith(
      'user_get_chat_history',
      expect.objectContaining({ connectionOverride: 'conn-override-789' }),
      'conn-override-789',
    )
  })

  it('returns dispatched:false for user_* actions when no connectionId is available', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'user_send_message', params: { chatId: '123', text: 'Hi' } },
    ])

    // No platformConnectionId and no connectionOverride in params
    const results = await dispatchActions(ctx, { botInstanceId: 'bot-1' })

    expect(results[0]!.dispatched).toBe(false)
    expect(results[0]!.error).toContain('connection')
    expect(mockDispatchUserAction).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// dispatchActionToCommunity — community-to-bot resolution
// ---------------------------------------------------------------------------

describe('dispatchActionToCommunity', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    mockFetch.mockResolvedValue(makeFetchResponse({ success: true, data: {} }))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('resolves the bot instance URL from the community and dispatches via POST /execute', async () => {
    mockPrisma.community.findUnique.mockResolvedValueOnce({
      id: 'comm-1',
      botInstance: { id: 'bot-1', apiUrl: 'http://tg-bot:3001', isActive: true, platform: 'telegram' },
    })

    const result = await dispatchActionToCommunity(
      'send_message',
      { chatId: '123', text: 'Hello from community' },
      'comm-1',
    )

    expect(result.success).toBe(true)

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://tg-bot:3001/execute')
    const body = JSON.parse(init.body as string)
    expect(body.action).toBe('send_message')
    expect(body.params).toMatchObject({ chatId: '123', text: 'Hello from community' })
  })

  it('returns error when community is not found', async () => {
    mockPrisma.community.findUnique.mockResolvedValueOnce(null)

    const result = await dispatchActionToCommunity('send_message', { chatId: '123' }, 'missing-comm')

    expect(result.success).toBe(false)
    expect(result.error).toContain('missing-comm')
    expect(result.error).toContain('not found')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error when community has no bot instance assigned', async () => {
    mockPrisma.community.findUnique.mockResolvedValueOnce({
      id: 'comm-1',
      botInstance: null,
    })

    const result = await dispatchActionToCommunity('send_message', { chatId: '123' }, 'comm-1')

    expect(result.success).toBe(false)
    expect(result.error).toContain('no bot instance')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error when bot instance is inactive', async () => {
    mockPrisma.community.findUnique.mockResolvedValueOnce({
      id: 'comm-1',
      botInstance: { id: 'bot-off', apiUrl: 'http://tg-bot:3001', isActive: false, platform: 'telegram' },
    })

    const result = await dispatchActionToCommunity('send_message', { chatId: '123' }, 'comm-1')

    expect(result.success).toBe(false)
    expect(result.error).toContain('bot-off')
    expect(result.error).toContain('not available')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error when bot instance has no apiUrl', async () => {
    mockPrisma.community.findUnique.mockResolvedValueOnce({
      id: 'comm-1',
      botInstance: { id: 'bot-no-url', apiUrl: null, isActive: true, platform: 'telegram' },
    })

    const result = await dispatchActionToCommunity('send_message', { chatId: '123' }, 'comm-1')

    expect(result.success).toBe(false)
    expect(result.error).toContain('not available')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error when fetch throws a network error', async () => {
    mockPrisma.community.findUnique.mockResolvedValueOnce({
      id: 'comm-1',
      botInstance: { id: 'bot-1', apiUrl: BOT_API_URL, isActive: true, platform: 'telegram' },
    })
    mockFetch.mockRejectedValueOnce(new Error('ETIMEDOUT'))

    const result = await dispatchActionToCommunity('ban_user', { chatId: '-100123', userId: '789' }, 'comm-1')

    expect(result.success).toBe(false)
    expect(result.error).toContain('ETIMEDOUT')
  })

  it('queries the community with botInstance included', async () => {
    mockPrisma.community.findUnique.mockResolvedValueOnce({
      id: 'comm-1',
      botInstance: { id: 'bot-1', apiUrl: BOT_API_URL, isActive: true, platform: 'telegram' },
    })

    await dispatchActionToCommunity('send_message', { chatId: '123' }, 'comm-1')

    expect(mockPrisma.community.findUnique).toHaveBeenCalledWith({
      where: { id: 'comm-1' },
      include: {
        botInstance: { select: { id: true, apiUrl: true, isActive: true, platform: true } },
      },
    })
  })
})
