/**
 * Integration tests for the WhatsApp event pipeline.
 *
 * Tests the FULL path: raw Baileys event → mapper → EventForwarder → HTTP POST
 *
 * Strategy:
 *   - Build a real EventForwarder backed by a mocked `fetch`
 *   - Build a transport whose `getClient()` returns an object with a real
 *     EventEmitter at `.ev`, mirroring the Baileys socket shape that
 *     `registerEventListeners` expects
 *   - Emit Baileys-style events and assert on the JSON body POSTed to the API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import type { IWhatsAppTransport } from '../sdk/types.js'
import { registerEventListeners } from '../events/listeners.js'

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

/**
 * A minimal WhatsApp transport whose getClient() returns an object with a
 * real EventEmitter at `.ev` — exactly what registerEventListeners accesses.
 */
function makeTransportWithEmitter(): { transport: IWhatsAppTransport; ev: EventEmitter } {
  const ev = new EventEmitter()
  const transport: IWhatsAppTransport = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: () => true,
    onQrCode: vi.fn(),
    onConnectionUpdate: vi.fn(),
    getClient: () => ({ ev }),
    sendMessage: vi.fn(),
    sendMedia: vi.fn(),
    sendLocation: vi.fn(),
    sendContact: vi.fn(),
    sendDocument: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    forwardMessage: vi.fn(),
    readHistory: vi.fn(),
    kickParticipant: vi.fn(),
    promoteParticipant: vi.fn(),
    demoteParticipant: vi.fn(),
    getGroupMetadata: vi.fn(),
    getGroupInviteLink: vi.fn(),
    sendPresenceUpdate: vi.fn(),
    getPresence: vi.fn(),
  } as unknown as IWhatsAppTransport
  return { transport, ev }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOT_INSTANCE = 'wa-bot-instance-001'
const API_URL = 'http://api:3000'
const WEBHOOK_URL = `${API_URL}/api/flow/webhook`

function makeMockFetch() {
  return vi.fn().mockResolvedValue({ ok: true })
}

function capturedEvents(mockFetch: ReturnType<typeof makeMockFetch>): unknown[] {
  return mockFetch.mock.calls.map((call) => {
    const [, init] = call as [string, RequestInit]
    return JSON.parse(init.body as string)
  })
}

/**
 * Emit a Baileys event and wait for the async handler to fully complete.
 * The handler is async so we flush microtasks with a setTimeout(0) after emitting.
 */
async function emitAndFlush(ev: EventEmitter, event: string, payload: unknown): Promise<void> {
  ev.emit(event, payload)
  // Yield to the event loop so the async handler (including forwarder.send) finishes
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsApp event pipeline', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // -------------------------------------------------------------------------
  // messages.upsert
  // -------------------------------------------------------------------------

  describe('messages.upsert → message_received', () => {
    it('forwards a plain text group message with correct FlowTriggerEvent shape', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'messages.upsert', {
        messages: [
          {
            key: { remoteJid: '1234567890-001@g.us', fromMe: false, id: 'msg-abc-001' },
            message: { conversation: 'Hello group!' },
            pushName: 'Alice',
            messageTimestamp: 1700000000,
          },
        ],
        type: 'notify',
      })

      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch).toHaveBeenCalledWith(WEBHOOK_URL, expect.objectContaining({ method: 'POST' }))

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('whatsapp')
      expect(posted.eventType).toBe('message_received')
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.communityId).toBe('1234567890-001@g.us')
      expect(posted.accountId).toBe('Alice')
      expect(posted.timestamp).toBeDefined()
      expect(typeof posted.timestamp).toBe('string')

      const data = posted.data as Record<string, unknown>
      expect(data.messageId).toBe('msg-abc-001')
      expect(data.text).toBe('Hello group!')
      expect(data.senderName).toBe('Alice')
      expect(data.isDirectMessage).toBe(false)
      expect(data.mediaType).toBeNull()
    })

    it('forwards a DM text message with isDirectMessage=true and communityId=null', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'messages.upsert', {
        messages: [
          {
            key: { remoteJid: '9876543210@s.whatsapp.net', fromMe: false, id: 'msg-dm-001' },
            message: { conversation: 'hey there' },
            pushName: 'Bob',
            messageTimestamp: 1700000001,
          },
        ],
        type: 'notify',
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.communityId).toBeNull()
      expect((posted.data as Record<string, unknown>).isDirectMessage).toBe(true)
    })

    it('does NOT forward messages where fromMe=true', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'messages.upsert', {
        messages: [
          {
            key: { remoteJid: 'group@g.us', fromMe: true, id: 'msg-self' },
            message: { conversation: 'I said this' },
            pushName: 'Me',
            messageTimestamp: 1700000002,
          },
        ],
        type: 'notify',
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('forwards an image message with mediaType=image', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'messages.upsert', {
        messages: [
          {
            key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg-img-001' },
            message: { imageMessage: { caption: 'look at this' } },
            pushName: 'Carol',
            messageTimestamp: 1700000003,
          },
        ],
        type: 'notify',
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.mediaType).toBe('image')
      expect(data.text).toBeNull()
    })

    it('forwards extended text messages', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'messages.upsert', {
        messages: [
          {
            key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg-ext-001' },
            message: { extendedTextMessage: { text: 'extended content here' } },
            pushName: 'Dave',
            messageTimestamp: 1700000004,
          },
        ],
        type: 'notify',
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect((posted.data as Record<string, unknown>).text).toBe('extended content here')
    })

    it('forwards multiple messages in a single upsert as separate POSTs', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'messages.upsert', {
        messages: [
          {
            key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg-multi-1' },
            message: { conversation: 'first' },
            pushName: 'Eve',
            messageTimestamp: 1700000005,
          },
          {
            key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg-multi-2' },
            message: { conversation: 'second' },
            pushName: 'Frank',
            messageTimestamp: 1700000006,
          },
        ],
        type: 'notify',
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // -------------------------------------------------------------------------
  // group-participants.update
  // -------------------------------------------------------------------------

  describe('group-participants.update → member_join / member_leave / member_promoted / member_demoted', () => {
    it('forwards member_join event when action=add', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'group-participants.update', {
        id: 'mygroup@g.us',
        participants: ['newuser@s.whatsapp.net'],
        action: 'add',
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('whatsapp')
      expect(posted.eventType).toBe('member_join')
      expect(posted.communityId).toBe('mygroup@g.us')
      expect(posted.accountId).toBe('newuser@s.whatsapp.net')
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()

      const data = posted.data as Record<string, unknown>
      expect(data.groupId).toBe('mygroup@g.us')
      expect(data.participantJid).toBe('newuser@s.whatsapp.net')
      expect(data.action).toBe('add')
    })

    it('forwards member_leave event when action=remove', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'group-participants.update', {
        id: 'mygroup@g.us',
        participants: ['leaving@s.whatsapp.net'],
        action: 'remove',
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.eventType).toBe('member_leave')
    })

    it('forwards member_promoted event when action=promote', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'group-participants.update', {
        id: 'mygroup@g.us',
        participants: ['promoted@s.whatsapp.net'],
        action: 'promote',
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.eventType).toBe('member_promoted')
    })

    it('forwards member_demoted event when action=demote', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'group-participants.update', {
        id: 'mygroup@g.us',
        participants: ['demoted@s.whatsapp.net'],
        action: 'demote',
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.eventType).toBe('member_demoted')
    })

    it('emits one POST per participant in a bulk update', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'group-participants.update', {
        id: 'mygroup@g.us',
        participants: ['user1@s.whatsapp.net', 'user2@s.whatsapp.net', 'user3@s.whatsapp.net'],
        action: 'add',
      })

      expect(mockFetch).toHaveBeenCalledTimes(3)
      const events = capturedEvents(mockFetch) as Array<Record<string, unknown>>
      const accountIds = events.map((e) => e.accountId)
      expect(accountIds).toContain('user1@s.whatsapp.net')
      expect(accountIds).toContain('user2@s.whatsapp.net')
      expect(accountIds).toContain('user3@s.whatsapp.net')
    })
  })

  // -------------------------------------------------------------------------
  // groups.update
  // -------------------------------------------------------------------------

  describe('groups.update → group_updated', () => {
    it('forwards group_updated event with metadata', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'groups.update', [
        { id: 'community@g.us', subject: 'New Group Name', description: 'updated desc' },
      ])

      expect(mockFetch).toHaveBeenCalledOnce()
      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('whatsapp')
      expect(posted.eventType).toBe('group_updated')
      expect(posted.communityId).toBe('community@g.us')
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)

      const data = posted.data as Record<string, unknown>
      expect(data.subject).toBe('New Group Name')
      expect(data.description).toBe('updated desc')
    })

    it('emits one POST per group in a batch update', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'groups.update', [
        { id: 'group1@g.us', subject: 'G1' },
        { id: 'group2@g.us', subject: 'G2' },
      ])

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // -------------------------------------------------------------------------
  // presence.update
  // -------------------------------------------------------------------------

  describe('presence.update → presence_update', () => {
    it('forwards presence_update for a DM context (communityId is null)', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'presence.update', {
        id: 'friend@s.whatsapp.net',
        presences: {
          'friend@s.whatsapp.net': { lastKnownPresence: 'available', lastSeen: 1700000010 },
        },
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('whatsapp')
      expect(posted.eventType).toBe('presence_update')
      expect(posted.accountId).toBe('friend@s.whatsapp.net')
      expect(posted.communityId).toBeNull() // DM — not a group
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)

      const data = posted.data as Record<string, unknown>
      expect(data.presence).toBe('available')
      expect(data.lastSeen).toBe(1700000010)
      expect(data.participantJid).toBe('friend@s.whatsapp.net')
    })

    it('forwards presence_update with communityId set for group presence', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'presence.update', {
        id: 'thegroup@g.us',
        presences: {
          'member1@s.whatsapp.net': { lastKnownPresence: 'composing' },
        },
      })

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.communityId).toBe('thegroup@g.us')
      expect(posted.accountId).toBe('member1@s.whatsapp.net')
    })

    it('emits one POST per participant in the presence update', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'presence.update', {
        id: 'group@g.us',
        presences: {
          'p1@s.whatsapp.net': { lastKnownPresence: 'available' },
          'p2@s.whatsapp.net': { lastKnownPresence: 'unavailable' },
        },
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // -------------------------------------------------------------------------
  // HTTP transport
  // -------------------------------------------------------------------------

  describe('HTTP transport', () => {
    it('always POSTs to the configured webhook URL with JSON content-type', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'messages.upsert', {
        messages: [
          {
            key: { remoteJid: 'g@g.us', fromMe: false, id: 'any' },
            message: { conversation: 'hi' },
            pushName: 'X',
            messageTimestamp: 1700000020,
          },
        ],
        type: 'notify',
      })

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(WEBHOOK_URL)
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    })

    it('sends valid JSON body that can be parsed back', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const { transport, ev } = makeTransportWithEmitter()
      registerEventListeners(transport, forwarder, BOT_INSTANCE, mockLogger)

      await emitAndFlush(ev, 'messages.upsert', {
        messages: [
          {
            key: { remoteJid: 'g@g.us', fromMe: false, id: 'json-check' },
            message: { conversation: 'valid json?' },
            pushName: 'Tester',
            messageTimestamp: 1700000021,
          },
        ],
        type: 'notify',
      })

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(() => JSON.parse(init.body as string)).not.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // Graceful degradation
  // -------------------------------------------------------------------------

  describe('graceful degradation', () => {
    it('logs warning and does not throw when transport client has no ev emitter', () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })

      // Transport that returns null from getClient()
      const nullTransport: IWhatsAppTransport = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: () => false,
        onQrCode: vi.fn(),
        onConnectionUpdate: vi.fn(),
        getClient: () => null,
        sendMessage: vi.fn(),
        sendMedia: vi.fn(),
        sendLocation: vi.fn(),
        sendContact: vi.fn(),
        sendDocument: vi.fn(),
        editMessage: vi.fn(),
        deleteMessage: vi.fn(),
        forwardMessage: vi.fn(),
        readHistory: vi.fn(),
        kickParticipant: vi.fn(),
        promoteParticipant: vi.fn(),
        demoteParticipant: vi.fn(),
        getGroupMetadata: vi.fn(),
        getGroupInviteLink: vi.fn(),
        sendPresenceUpdate: vi.fn(),
        getPresence: vi.fn(),
      } as unknown as IWhatsAppTransport

      expect(() => registerEventListeners(nullTransport, forwarder, BOT_INSTANCE, mockLogger)).not.toThrow()
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })
})
