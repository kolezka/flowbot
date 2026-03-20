import { describe, it, expect, beforeEach } from 'vitest'
import { pino } from 'pino'
import { WhatsAppUserConnector } from '../connector.js'
import { FakeWhatsAppTransport } from '../sdk/fake-client.js'

const logger = pino({ level: 'silent' })

const USER_JID = '123@s.whatsapp.net'
const GROUP_JID = 'group123@g.us'
const SAMPLE_KEY = { remoteJid: USER_JID, fromMe: true as const, id: 'msg-001' }

function makeConnector(transport?: FakeWhatsAppTransport) {
  return new WhatsAppUserConnector({
    connectionId: 'test-conn-id',
    botInstanceId: 'test-bot-instance',
    prisma: {},
    logger,
    apiUrl: 'http://localhost:3000',
    transport,
  })
}

describe('WhatsAppUserConnector', () => {
  let transport: FakeWhatsAppTransport
  let connector: WhatsAppUserConnector

  beforeEach(() => {
    transport = new FakeWhatsAppTransport()
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
    })

    it('registry has all expected group admin actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('kick_user')
      expect(actions).toContain('promote_user')
      expect(actions).toContain('demote_user')
      expect(actions).toContain('get_group_info')
      expect(actions).toContain('get_invite_link')
    })

    it('registry has all expected message management actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('forward_message')
      expect(actions).toContain('edit_message')
      expect(actions).toContain('delete_message')
      expect(actions).toContain('read_history')
    })

    it('registry has presence actions', () => {
      expect(connector.registry.getActions()).toContain('send_presence')
    })

    it('registry can execute send_message against the fake transport', async () => {
      const result = await connector.registry.execute('send_message', {
        chatId: USER_JID,
        text: 'hello from connector',
      })
      expect(result.success).toBe(true)
      expect(transport.getSentMessages()).toHaveLength(1)
      expect(transport.getSentMessages()[0]?.text).toBe('hello from connector')
    })

    it('registry can execute kick_user against the fake transport', async () => {
      const result = await connector.registry.execute('kick_user', {
        chatId: GROUP_JID,
        userId: USER_JID,
      })
      expect(result.success).toBe(true)
      expect(transport.getKickedParticipants()).toHaveLength(1)
    })

    it('registry can execute delete_message against the fake transport', async () => {
      const result = await connector.registry.execute('delete_message', {
        chatId: USER_JID,
        messageKey: SAMPLE_KEY,
      })
      expect(result.success).toBe(true)
      expect(transport.getDeletedMessages()).toHaveLength(1)
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

  describe('QR auth wiring', () => {
    it('registers onQrCode callback on the transport during connect()', async () => {
      await connector.connect()
      // Emitting a QR should not throw even without a real API (fetch will fail silently)
      expect(() => transport.emitQr('fake-qr-code')).not.toThrow()
    })

    it('registers onConnectionUpdate callback on the transport during connect()', async () => {
      await connector.connect()
      expect(() => transport.emitConnectionUpdate({ connection: 'open' })).not.toThrow()
    })
  })
})
