import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executeSendMessage } from '../actions/executors/send-message.js'
import { executeBroadcast } from '../actions/executors/broadcast.js'
import { executeCrossPost } from '../actions/executors/cross-post.js'
import { FakeTelegramTransport } from '../transport/FakeTelegramTransport.js'
import type { SendMessagePayload, BroadcastPayload, CrossPostPayload } from '../actions/types.js'

// Mock sleep to avoid real delays in broadcast/cross-post
vi.mock('../errors/backoff.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../errors/backoff.js')>()
  return {
    ...actual,
    sleep: vi.fn().mockResolvedValue(undefined),
  }
})

function createTestLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as any
}

describe('send-message executor', () => {
  let transport: FakeTelegramTransport
  let logger: ReturnType<typeof createTestLogger>

  beforeEach(() => {
    transport = new FakeTelegramTransport()
    logger = createTestLogger()
  })

  it('sends message to specified peer', async () => {
    const payload: SendMessagePayload = {
      peer: 'my-chat',
      text: 'Hello there!',
    }

    const result = await executeSendMessage(transport, payload, logger)

    expect(result.id).toBe(1)
    expect(result.peerId).toBe('my-chat')

    const sent = transport.getSentMessages()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.peer).toBe('my-chat')
    expect(sent[0]!.text).toBe('Hello there!')
  })

  it('passes options through to transport', async () => {
    const payload: SendMessagePayload = {
      peer: 'chat-123',
      text: 'Formatted message',
      parseMode: 'html',
      replyToMsgId: 42,
      silent: true,
    }

    await executeSendMessage(transport, payload, logger)

    const sent = transport.getSentMessages()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.options).toEqual({
      parseMode: 'html',
      replyToMsgId: 42,
      silent: true,
    })
  })
})

describe('broadcast executor', () => {
  let transport: FakeTelegramTransport
  let logger: ReturnType<typeof createTestLogger>

  beforeEach(() => {
    transport = new FakeTelegramTransport()
    logger = createTestLogger()
  })

  it('sends to multiple targets', async () => {
    const payload: BroadcastPayload = {
      text: 'Broadcast message',
      targetChatIds: ['chat-1', 'chat-2', 'chat-3'],
    }

    const result = await executeBroadcast(transport, payload, logger)

    expect(result.results).toHaveLength(3)
    expect(result.results.every(r => r.success)).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(3)
  })

  it('returns per-target results', async () => {
    const sendSpy = vi.spyOn(transport, 'sendMessage')
    sendSpy.mockResolvedValueOnce({ id: 10, date: 123, peerId: 'chat-1' })
    sendSpy.mockRejectedValueOnce(new Error('chat not found'))
    sendSpy.mockResolvedValueOnce({ id: 12, date: 123, peerId: 'chat-3' })

    const payload: BroadcastPayload = {
      text: 'Broadcast',
      targetChatIds: ['chat-1', 'chat-2', 'chat-3'],
    }

    const result = await executeBroadcast(transport, payload, logger)

    expect(result.results).toHaveLength(3)
    expect(result.results[0]).toEqual({ chatId: 'chat-1', success: true, messageId: 10 })
    expect(result.results[1]).toEqual({ chatId: 'chat-2', success: false, error: 'chat not found' })
    expect(result.results[2]).toEqual({ chatId: 'chat-3', success: true, messageId: 12 })
  })
})

describe('cross-post executor', () => {
  let transport: FakeTelegramTransport
  let logger: ReturnType<typeof createTestLogger>

  beforeEach(() => {
    transport = new FakeTelegramTransport()
    logger = createTestLogger()
  })

  it('sends to multiple targets with stagger delay', async () => {
    const { sleep } = await import('../errors/backoff.js')
    vi.mocked(sleep).mockClear()

    const payload: CrossPostPayload = {
      text: 'Cross-post content',
      targetChatIds: ['group-a', 'group-b', 'group-c'],
    }

    const result = await executeCrossPost(transport, payload, logger)

    expect(result.results).toHaveLength(3)
    expect(result.results.every(r => r.success)).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(3)

    // sleep should have been called between messages (n-1 times)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('returns per-target results including failures', async () => {
    const sendSpy = vi.spyOn(transport, 'sendMessage')
    sendSpy.mockResolvedValueOnce({ id: 1, date: 100, peerId: 'group-a' })
    sendSpy.mockRejectedValueOnce(new Error('permission denied'))

    const payload: CrossPostPayload = {
      text: 'Cross-post',
      targetChatIds: ['group-a', 'group-b'],
    }

    const result = await executeCrossPost(transport, payload, logger)

    expect(result.results).toHaveLength(2)
    expect(result.results[0]!.success).toBe(true)
    expect(result.results[1]!.success).toBe(false)
    expect(result.results[1]!.error).toBe('permission denied')
  })
})
