import { describe, it, expect, beforeEach } from 'vitest'
import { pino } from 'pino'
import { TelegramBotConnector } from '../connector.js'
import { FakeTelegramBot } from '../sdk/fake-bot.js'

const logger = pino({ level: 'silent' })

const CHAT_ID = '-1001234567890'
const USER_ID = 12345
const MESSAGE_ID = 99

function makeConnector(transport?: FakeTelegramBot) {
  return new TelegramBotConnector({
    botToken: 'test-bot-token',
    botInstanceId: 'test-bot-instance',
    logger,
    apiUrl: 'http://localhost:3000',
    transport,
  })
}

describe('TelegramBotConnector', () => {
  let transport: FakeTelegramBot
  let connector: TelegramBotConnector

  beforeEach(() => {
    transport = new FakeTelegramBot()
    connector = makeConnector(transport)
  })

  it('creates a registry before connect()', () => {
    expect(connector.registry).toBeDefined()
    // Registry is empty before connect — actions only registered after transport is set
    expect(connector.registry.getActions()).toHaveLength(0)
  })

  it('isConnected() returns false before connect()', () => {
    expect(connector.isConnected()).toBe(false)
  })

  it('getTransport() returns null before connect()', () => {
    expect(connector.getTransport()).toBeNull()
  })

  describe('after connect()', () => {
    beforeEach(async () => {
      await connector.connect()
    })

    it('isConnected() returns true', () => {
      expect(connector.isConnected()).toBe(true)
    })

    it('getTransport() returns the injected transport', () => {
      expect(connector.getTransport()).toBe(transport)
    })

    it('registry has all expected messaging actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('send_message')
      expect(actions).toContain('send_photo')
      expect(actions).toContain('send_video')
      expect(actions).toContain('send_document')
      expect(actions).toContain('send_audio')
      expect(actions).toContain('send_voice')
      expect(actions).toContain('send_sticker')
      expect(actions).toContain('send_location')
      expect(actions).toContain('send_contact')
      expect(actions).toContain('send_poll')
    })

    it('registry has all expected admin actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('ban_user')
      expect(actions).toContain('unban_user')
      expect(actions).toContain('restrict_user')
      expect(actions).toContain('promote_user')
    })

    it('registry has all expected chat actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('get_chat')
      expect(actions).toContain('get_chat_member')
      expect(actions).toContain('get_chat_members_count')
      expect(actions).toContain('set_chat_title')
      expect(actions).toContain('set_chat_description')
    })

    it('registry has all expected message management actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('edit_message')
      expect(actions).toContain('delete_message')
      expect(actions).toContain('pin_message')
      expect(actions).toContain('unpin_message')
      expect(actions).toContain('reply_to_message')
    })

    it('registry can execute send_message against the fake transport', async () => {
      const result = await connector.registry.execute('send_message', {
        chatId: CHAT_ID,
        text: 'hello from connector',
      })
      expect(result.success).toBe(true)
      expect(transport.getSentMessages()).toHaveLength(1)
      expect(transport.getSentMessages()[0]?.text).toBe('hello from connector')
    })

    it('registry can execute ban_user against the fake transport', async () => {
      const result = await connector.registry.execute('ban_user', {
        chatId: CHAT_ID,
        userId: USER_ID,
      })
      expect(result.success).toBe(true)
      expect(transport.getBannedUsers()).toHaveLength(1)
      expect(transport.getBannedUsers()[0]?.userId).toBe(USER_ID)
    })

    it('registry can execute delete_message against the fake transport', async () => {
      const result = await connector.registry.execute('delete_message', {
        chatId: CHAT_ID,
        messageId: MESSAGE_ID,
      })
      expect(result.success).toBe(true)
      expect(transport.getDeletedMessages()).toHaveLength(1)
      expect(transport.getDeletedMessages()[0]?.messageId).toBe(MESSAGE_ID)
    })

    it('registry returns error for unregistered action', async () => {
      const result = await connector.registry.execute('nonexistent', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('not registered')
    })
  })

  describe('disconnect()', () => {
    it('isConnected() returns false after disconnect', async () => {
      await connector.connect()
      expect(connector.isConnected()).toBe(true)
      await connector.disconnect()
      expect(connector.isConnected()).toBe(false)
    })

    it('disconnect() is safe to call before connect()', async () => {
      // Should not throw
      await expect(connector.disconnect()).resolves.toBeUndefined()
    })
  })
})
