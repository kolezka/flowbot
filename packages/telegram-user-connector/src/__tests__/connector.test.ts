import { describe, it, expect, beforeEach } from 'vitest'
import { pino } from 'pino'
import { TelegramUserConnector } from '../connector.js'
import { FakeTelegramUserTransport } from '../sdk/fake-client.js'

const logger = pino({ level: 'silent' })

const PEER = 'channel123'
const USER_ID = 'user456'

function makeConnector(transport?: FakeTelegramUserTransport) {
  return new TelegramUserConnector({
    sessionString: 'fake-session',
    apiId: 12345,
    apiHash: 'fake-hash',
    logger,
    transport,
  })
}

describe('TelegramUserConnector', () => {
  let transport: FakeTelegramUserTransport
  let connector: TelegramUserConnector

  beforeEach(() => {
    transport = new FakeTelegramUserTransport()
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
      expect(actions).toContain('send_sticker')
      expect(actions).toContain('send_voice')
      expect(actions).toContain('send_audio')
      expect(actions).toContain('send_animation')
      expect(actions).toContain('send_location')
      expect(actions).toContain('send_contact')
      expect(actions).toContain('send_venue')
      expect(actions).toContain('send_dice')
      expect(actions).toContain('forward_message')
      expect(actions).toContain('send_media_group')
      expect(actions).toContain('resolve_username')
    })

    it('registry has all expected user/chat management actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('edit_message')
      expect(actions).toContain('delete_message')
      expect(actions).toContain('pin_message')
      expect(actions).toContain('unpin_message')
      expect(actions).toContain('copy_message')
      expect(actions).toContain('ban_user')
      expect(actions).toContain('restrict_user')
      expect(actions).toContain('promote_user')
      expect(actions).toContain('set_chat_title')
      expect(actions).toContain('set_chat_description')
      expect(actions).toContain('export_invite_link')
      expect(actions).toContain('get_chat_member')
      expect(actions).toContain('leave_chat')
      expect(actions).toContain('create_poll')
      expect(actions).toContain('create_forum_topic')
    })

    it('registry can execute send_message against fake transport', async () => {
      const result = await connector.registry.execute('send_message', {
        peer: PEER,
        text: 'hello from connector',
      })
      expect(result.success).toBe(true)
      expect(transport.getSentMessages()).toHaveLength(1)
      expect(transport.getSentMessages()[0]?.text).toBe('hello from connector')
    })

    it('registry can execute forward_message against fake transport', async () => {
      const result = await connector.registry.execute('forward_message', {
        fromPeer: 'chat_a',
        toPeer: PEER,
        messageIds: [10, 20],
      })
      expect(result.success).toBe(true)
      expect(transport.getForwardedMessages()).toHaveLength(1)
    })

    it('registry can execute ban_user against fake transport', async () => {
      const result = await connector.registry.execute('ban_user', { peer: PEER, userId: USER_ID })
      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    it('registry can execute get_chat_member against fake transport', async () => {
      const result = await connector.registry.execute('get_chat_member', { peer: PEER, userId: USER_ID })
      expect(result.success).toBe(true)
      const data = result.data as { userId: string; status: string }
      expect(data.userId).toBe(USER_ID)
    })

    it('registry returns error for unregistered action', async () => {
      const result = await connector.registry.execute('nonexistent', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('not registered')
    })

    it('registry returns validation error for invalid params', async () => {
      const result = await connector.registry.execute('send_message', { peer: PEER })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid params')
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
      await expect(connector.disconnect()).resolves.toBeUndefined()
    })
  })
})
