/**
 * Integration tests for the Telegram bot event pipeline.
 *
 * Tests the FULL path: grammY-style Context → mapper → EventForwarder → HTTP POST
 *
 * Strategy:
 *   - Build a real EventForwarder backed by a mocked `fetch`
 *   - Feed realistic grammY Context objects into each mapper function
 *   - Assert on the EXACT JSON body POSTed to the API webhook
 *
 * Note: grammY's Bot middleware system does not lend itself to programmatic
 * event injection in unit tests without a full bot test harness.  The mapper
 * functions are the boundary between grammY and the rest of the pipeline, so
 * we test the pipeline as: mapper → forwarder.send() → fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from 'grammy'
import { EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import { mapMessageEvent, mapMemberJoinEvent, mapMemberLeaveEvent, mapCallbackQueryEvent } from '../events/mapper.js'

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger

const BOT_INSTANCE = 'tg-bot-instance-001'
const API_URL = 'http://api:3000'
const WEBHOOK_URL = `${API_URL}/api/flow/webhook`

// ---------------------------------------------------------------------------
// Context builder helpers
// ---------------------------------------------------------------------------

function makeGroupMessageCtx(opts: {
  chatId?: number
  fromId?: number
  firstName?: string
  username?: string
  text?: string
  messageId?: number
  chatType?: string
} = {}): Context {
  const {
    chatId = -100987654321,
    fromId = 12345,
    firstName = 'Alice',
    username = 'alice',
    text = 'Hello everyone',
    messageId = 101,
    chatType = 'supergroup',
  } = opts

  return {
    chat: { id: chatId, type: chatType },
    from: { id: fromId, first_name: firstName, username, is_bot: false },
    message: {
      message_id: messageId,
      text,
    },
    callbackQuery: undefined,
    chatMember: undefined,
  } as unknown as Context
}

function makePrivateMessageCtx(opts: { text?: string; fromId?: number } = {}): Context {
  const { text = 'Hello bot', fromId = 99 } = opts
  return {
    chat: { id: fromId, type: 'private' },
    from: { id: fromId, first_name: 'User', username: 'someuser', is_bot: false },
    message: {
      message_id: 1,
      text,
    },
    callbackQuery: undefined,
    chatMember: undefined,
  } as unknown as Context
}

function makeMediaMessageCtx(mediaKey: string, chatType: string = 'supergroup'): Context {
  return {
    chat: { id: -100111, type: chatType },
    from: { id: 42, first_name: 'Dave', username: 'dave', is_bot: false },
    message: {
      message_id: 200,
      [mediaKey]: mediaKey === 'photo' ? [{}] : {},
    },
    callbackQuery: undefined,
    chatMember: undefined,
  } as unknown as Context
}

function makeCommandCtx(command: string, args: string = ''): Context {
  const text = args ? `${command} ${args}` : command
  return {
    chat: { id: -100888, type: 'supergroup' },
    from: { id: 77, first_name: 'Commander', username: 'cmd', is_bot: false },
    message: {
      message_id: 300,
      text,
    },
    callbackQuery: undefined,
    chatMember: undefined,
  } as unknown as Context
}

function makeChatMemberCtx(opts: {
  chatId?: number
  userId?: number
  username?: string
  firstName?: string
  isBot?: boolean
  oldStatus?: string
  newStatus?: string
}): Context {
  const {
    chatId = -100555,
    userId = 33,
    username = 'newguy',
    firstName = 'New',
    isBot = false,
    oldStatus = 'left',
    newStatus = 'member',
  } = opts

  return {
    chat: { id: chatId, type: 'supergroup' },
    from: { id: 99, first_name: 'Admin', is_bot: false },
    chatMember: {
      old_chat_member: { status: oldStatus, user: { id: userId, first_name: firstName, is_bot: isBot } },
      new_chat_member: { status: newStatus, user: { id: userId, first_name: firstName, username, is_bot: isBot } },
    },
    message: undefined,
    callbackQuery: undefined,
  } as unknown as Context
}

function makeCallbackQueryCtx(opts: {
  fromId?: number
  username?: string
  callbackQueryId?: string
  data?: string
  chatId?: number
  messageId?: number
}): Context {
  const {
    fromId = 55,
    username = 'clicker',
    callbackQueryId = 'cq-pipeline-001',
    data = 'action:confirm',
    chatId = -100444,
    messageId = 77,
  } = opts

  return {
    chat: { id: chatId, type: 'supergroup' },
    from: { id: fromId, first_name: 'Clicker', username, is_bot: false },
    message: undefined,
    chatMember: undefined,
    callbackQuery: {
      id: callbackQueryId,
      data,
      message: { chat: { id: chatId }, message_id: messageId },
    },
  } as unknown as Context
}

// ---------------------------------------------------------------------------
// Helper: capture events POSTed by the forwarder
// ---------------------------------------------------------------------------

function makeMockFetch() {
  return vi.fn().mockResolvedValue({ ok: true })
}

function capturedEvents(mockFetch: ReturnType<typeof makeMockFetch>): unknown[] {
  return mockFetch.mock.calls.map((call) => {
    const [, init] = call as [string, RequestInit]
    return JSON.parse(init.body as string)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Telegram event pipeline', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // -------------------------------------------------------------------------
  // mapMessageEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapMessageEvent → EventForwarder', () => {
    it('posts a correct FlowTriggerEvent for a group text message', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeGroupMessageCtx({ text: 'hello everyone', fromId: 12345, chatId: -100987654321, messageId: 101 })
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch).toHaveBeenCalledWith(WEBHOOK_URL, expect.objectContaining({ method: 'POST' }))

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('telegram')
      expect(posted.eventType).toBe('message_received')
      expect(posted.communityId).toBe(String(-100987654321))
      expect(posted.accountId).toBe(String(12345))
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()
      expect(typeof posted.timestamp).toBe('string')

      const data = posted.data as Record<string, unknown>
      expect(data.messageId).toBe(101)
      expect(data.text).toBe('hello everyone')
      expect(data.isDirectMessage).toBe(false)
      expect(data.senderName).toBe('Alice')
      expect(data.username).toBe('alice')
      expect(data.mediaType).toBeNull()
      expect(data.command).toBeNull()
    })

    it('posts with communityId=null and isDirectMessage=true for private chat', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makePrivateMessageCtx({ text: 'just you and me', fromId: 99 })
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.communityId).toBeNull()
      const data = posted.data as Record<string, unknown>
      expect(data.isDirectMessage).toBe(true)
    })

    it('posts photo mediaType for a photo message', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeMediaMessageCtx('photo')
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.mediaType).toBe('photo')
      expect(data.text).toBeNull()
    })

    it('posts video mediaType for a video message', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeMediaMessageCtx('video')
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect((posted.data as Record<string, unknown>).mediaType).toBe('video')
    })

    it('posts document mediaType for a document message', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeMediaMessageCtx('document')
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect((posted.data as Record<string, unknown>).mediaType).toBe('document')
    })

    it('posts sticker mediaType for a sticker message', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeMediaMessageCtx('sticker')
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect((posted.data as Record<string, unknown>).mediaType).toBe('sticker')
    })

    it('posts voice mediaType for a voice message', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeMediaMessageCtx('voice')
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect((posted.data as Record<string, unknown>).mediaType).toBe('voice')
    })

    it('posts command and commandArgs for bot commands', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeCommandCtx('/ban', '@baduser 7d spamming')
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.command).toBe('/ban')
      expect(data.commandArgs).toBe('@baduser 7d spamming')
    })

    it('strips @botname from command when present', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeCommandCtx('/help@FlowbotApp')
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect((posted.data as Record<string, unknown>).command).toBe('/help')
    })

    it('does not post when message context is missing', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = {
        chat: undefined,
        from: undefined,
        message: undefined,
        chatMember: undefined,
        callbackQuery: undefined,
      } as unknown as Context

      const event = mapMessageEvent(ctx, BOT_INSTANCE)
      expect(event).toBeNull()
      // Nothing POSTed
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // mapMemberJoinEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapMemberJoinEvent → EventForwarder', () => {
    it('posts a correct member_join FlowTriggerEvent', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeChatMemberCtx({
        chatId: -100111222,
        userId: 888,
        username: 'joiner',
        firstName: 'Joiner',
        isBot: false,
        oldStatus: 'left',
        newStatus: 'member',
      })

      const event = mapMemberJoinEvent(ctx, BOT_INSTANCE)
      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('telegram')
      expect(posted.eventType).toBe('member_join')
      expect(posted.communityId).toBe(String(-100111222))
      expect(posted.accountId).toBe(String(888))
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()

      const data = posted.data as Record<string, unknown>
      expect(data.userId).toBe(888)
      expect(data.username).toBe('joiner')
      expect(data.firstName).toBe('Joiner')
      expect(data.newStatus).toBe('member')
    })

    it('posts member_join when kicked user is allowed back in', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeChatMemberCtx({ oldStatus: 'kicked', newStatus: 'member' })
      const event = mapMemberJoinEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.eventType).toBe('member_join')
    })

    it('does not post when a bot joins', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeChatMemberCtx({ isBot: true, oldStatus: 'left', newStatus: 'member' })
      const event = mapMemberJoinEvent(ctx, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('does not post when member was already in the group (promote transition)', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeChatMemberCtx({ oldStatus: 'member', newStatus: 'administrator' })
      const event = mapMemberJoinEvent(ctx, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // mapMemberLeaveEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapMemberLeaveEvent → EventForwarder', () => {
    it('posts a correct member_leave FlowTriggerEvent', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeChatMemberCtx({
        chatId: -100333444,
        userId: 777,
        username: 'leaver',
        firstName: 'Leaver',
        isBot: false,
        oldStatus: 'member',
        newStatus: 'left',
      })

      const event = mapMemberLeaveEvent(ctx, BOT_INSTANCE)
      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('telegram')
      expect(posted.eventType).toBe('member_leave')
      expect(posted.communityId).toBe(String(-100333444))
      expect(posted.accountId).toBe(String(777))
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)

      const data = posted.data as Record<string, unknown>
      expect(data.userId).toBe(777)
      expect(data.username).toBe('leaver')
      expect(data.wasKicked).toBe(false)
      expect(data.oldStatus).toBe('member')
    })

    it('sets wasKicked=true for kicked members', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeChatMemberCtx({
        oldStatus: 'member',
        newStatus: 'kicked',
      })

      const event = mapMemberLeaveEvent(ctx, BOT_INSTANCE)
      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect((posted.data as Record<string, unknown>).wasKicked).toBe(true)
    })

    it('does not post when a bot leaves', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeChatMemberCtx({ isBot: true, oldStatus: 'member', newStatus: 'left' })
      const event = mapMemberLeaveEvent(ctx, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('does not post when member was not in the group (left -> kicked)', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeChatMemberCtx({ oldStatus: 'left', newStatus: 'kicked' })
      const event = mapMemberLeaveEvent(ctx, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // mapCallbackQueryEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapCallbackQueryEvent → EventForwarder', () => {
    it('posts a correct callback_query FlowTriggerEvent', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeCallbackQueryCtx({
        fromId: 55,
        username: 'clicker',
        callbackQueryId: 'cq-pipeline-001',
        data: 'action:confirm',
        chatId: -100444,
        messageId: 77,
      })

      const event = mapCallbackQueryEvent(ctx, BOT_INSTANCE)
      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('telegram')
      expect(posted.eventType).toBe('callback_query')
      expect(posted.communityId).toBe(String(-100444))
      expect(posted.accountId).toBe(String(55))
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()

      const data = posted.data as Record<string, unknown>
      expect(data.callbackQueryId).toBe('cq-pipeline-001')
      expect(data.data).toBe('action:confirm')
      expect(data.messageId).toBe(77)
      expect(data.username).toBe('clicker')
    })

    it('posts communityId=null when callback query has no associated chat', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })

      const ctx = {
        chat: undefined,
        from: { id: 55, first_name: 'User', username: 'user', is_bot: false },
        message: undefined,
        chatMember: undefined,
        callbackQuery: {
          id: 'cq-no-chat',
          data: 'standalone',
          message: undefined,
        },
      } as unknown as Context

      const event = mapCallbackQueryEvent(ctx, BOT_INSTANCE)
      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.communityId).toBeNull()
    })

    it('does not post when callbackQuery is absent', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = {
        chat: { id: 1 },
        from: { id: 1 },
        message: undefined,
        chatMember: undefined,
        callbackQuery: undefined,
      } as unknown as Context

      const event = mapCallbackQueryEvent(ctx, BOT_INSTANCE)
      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // HTTP transport
  // -------------------------------------------------------------------------

  describe('HTTP transport', () => {
    it('POSTs to the correct webhook URL with JSON content-type', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeGroupMessageCtx()
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(WEBHOOK_URL)
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    })

    it('sends valid parseable JSON', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const ctx = makeGroupMessageCtx()
      const event = mapMessageEvent(ctx, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(() => JSON.parse(init.body as string)).not.toThrow()
    })
  })
})
