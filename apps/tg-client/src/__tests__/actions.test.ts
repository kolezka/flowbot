import { describe, expect, it, vi } from 'vitest'
import pino from 'pino'
import { FakeTelegramTransport } from '../transport/FakeTelegramTransport.js'
import { executeSendMessage } from '../actions/send-message.js'
import { executeForwardMessage } from '../actions/forward-message.js'
import type { Logger } from '../logger.js'

const logger = pino({ level: 'silent' }) as unknown as Logger

describe('executeSendMessage', () => {
  it('calls transport.sendMessage with correct arguments', async () => {
    const transport = new FakeTelegramTransport()
    const sendSpy = vi.spyOn(transport, 'sendMessage')

    const result = await executeSendMessage(transport, {
      peer: 'testchannel',
      text: 'Hello world',
    }, logger)

    expect(sendSpy).toHaveBeenCalledOnce()
    expect(sendSpy).toHaveBeenCalledWith('testchannel', 'Hello world', {
      parseMode: undefined,
      replyToMsgId: undefined,
      silent: undefined,
    })
    expect(result.id).toBe(1)
    expect(result.peerId).toBe('testchannel')
  })

  it('passes parseMode, replyToMsgId, and silent options', async () => {
    const transport = new FakeTelegramTransport()
    const sendSpy = vi.spyOn(transport, 'sendMessage')

    await executeSendMessage(transport, {
      peer: 'user123',
      text: '<b>bold</b>',
      parseMode: 'html',
      replyToMsgId: 42,
      silent: true,
    }, logger)

    expect(sendSpy).toHaveBeenCalledWith('user123', '<b>bold</b>', {
      parseMode: 'html',
      replyToMsgId: 42,
      silent: true,
    })
  })

  it('returns the message result from transport', async () => {
    const transport = new FakeTelegramTransport()

    const result = await executeSendMessage(transport, {
      peer: 'chat',
      text: 'test message',
    }, logger)

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('date')
    expect(result).toHaveProperty('peerId', 'chat')

    const sent = transport.getSentMessages()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.text).toBe('test message')
  })

  it('throws on invalid payload', async () => {
    const transport = new FakeTelegramTransport()

    await expect(executeSendMessage(transport, {} as any, logger)).rejects.toThrow()
  })
})

describe('executeForwardMessage', () => {
  it('calls transport.forwardMessage with correct arguments', async () => {
    const transport = new FakeTelegramTransport()
    const forwardSpy = vi.spyOn(transport, 'forwardMessage')

    const results = await executeForwardMessage(transport, {
      fromPeer: 'source_channel',
      toPeer: 'dest_channel',
      messageIds: [10, 20, 30],
    }, logger)

    expect(forwardSpy).toHaveBeenCalledOnce()
    expect(forwardSpy).toHaveBeenCalledWith('source_channel', 'dest_channel', [10, 20, 30], {
      silent: undefined,
      dropAuthor: undefined,
    })
    expect(results).toHaveLength(3)
  })

  it('passes silent and dropAuthor options', async () => {
    const transport = new FakeTelegramTransport()
    const forwardSpy = vi.spyOn(transport, 'forwardMessage')

    await executeForwardMessage(transport, {
      fromPeer: 'src',
      toPeer: 'dst',
      messageIds: [1],
      silent: true,
      dropAuthor: true,
    }, logger)

    expect(forwardSpy).toHaveBeenCalledWith('src', 'dst', [1], {
      silent: true,
      dropAuthor: true,
    })
  })

  it('returns results from transport', async () => {
    const transport = new FakeTelegramTransport()

    const results = await executeForwardMessage(transport, {
      fromPeer: 'src',
      toPeer: 'dst',
      messageIds: [5, 6],
    }, logger)

    expect(results).toHaveLength(2)
    expect(results[0]!.peerId).toBe('dst')

    const forwarded = transport.getForwardedMessages()
    expect(forwarded).toHaveLength(1)
    expect(forwarded[0]!.messageIds).toEqual([5, 6])
  })

  it('throws on invalid payload', async () => {
    const transport = new FakeTelegramTransport()

    await expect(executeForwardMessage(transport, { fromPeer: 'a' } as any, logger)).rejects.toThrow()
  })
})
