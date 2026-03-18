import { describe, expect, it } from 'vitest'
import { FakeTelegramTransport } from '@flowbot/telegram-transport'

describe('FakeTelegramTransport', () => {
  it('connects and sends a message', async () => {
    const transport = new FakeTelegramTransport()
    await transport.connect()

    expect(transport.isConnected()).toBe(true)

    await transport.sendMessage('test-peer', 'Hello, world!')

    const sent = transport.getSentMessages()
    expect(sent).toHaveLength(1)
    expect(sent[0].peer).toBe('test-peer')
    expect(sent[0].text).toBe('Hello, world!')
  })

  it('disconnects correctly', async () => {
    const transport = new FakeTelegramTransport()
    await transport.connect()
    expect(transport.isConnected()).toBe(true)

    await transport.disconnect()
    expect(transport.isConnected()).toBe(false)
  })

  it('tracks multiple messages', async () => {
    const transport = new FakeTelegramTransport()
    await transport.connect()

    await transport.sendMessage('peer-1', 'First message')
    await transport.sendMessage('peer-2', 'Second message')
    await transport.sendMessage('peer-1', 'Third message')

    const sent = transport.getSentMessages()
    expect(sent).toHaveLength(3)
    expect(sent[0].text).toBe('First message')
    expect(sent[1].text).toBe('Second message')
    expect(sent[2].text).toBe('Third message')
  })
})
