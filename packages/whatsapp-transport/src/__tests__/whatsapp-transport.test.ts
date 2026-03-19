import { beforeEach, describe, expect, it } from 'vitest'
import { FakeWhatsAppTransport } from '../transport/FakeWhatsAppTransport.js'
import type { IWhatsAppTransport } from '../transport/IWhatsAppTransport.js'

describe('FakeWhatsAppTransport', () => {
  let transport: FakeWhatsAppTransport

  beforeEach(() => {
    transport = new FakeWhatsAppTransport()
  })

  it('implements IWhatsAppTransport', () => {
    const t: IWhatsAppTransport = transport

    expect(typeof t.connect).toBe('function')
    expect(typeof t.disconnect).toBe('function')
    expect(typeof t.isConnected).toBe('function')
    expect(typeof t.onQrCode).toBe('function')
    expect(typeof t.onConnectionUpdate).toBe('function')
    expect(typeof t.getClient).toBe('function')
    expect(typeof t.sendMessage).toBe('function')
    expect(typeof t.sendMedia).toBe('function')
    expect(typeof t.sendLocation).toBe('function')
    expect(typeof t.sendContact).toBe('function')
    expect(typeof t.sendDocument).toBe('function')
    expect(typeof t.editMessage).toBe('function')
    expect(typeof t.deleteMessage).toBe('function')
    expect(typeof t.forwardMessage).toBe('function')
    expect(typeof t.readHistory).toBe('function')
    expect(typeof t.kickParticipant).toBe('function')
    expect(typeof t.promoteParticipant).toBe('function')
    expect(typeof t.demoteParticipant).toBe('function')
    expect(typeof t.getGroupMetadata).toBe('function')
    expect(typeof t.getGroupInviteLink).toBe('function')
    expect(typeof t.sendPresenceUpdate).toBe('function')
    expect(typeof t.getPresence).toBe('function')
  })

  it('starts disconnected', () => {
    expect(transport.isConnected()).toBe(false)
  })

  it('connects and disconnects', async () => {
    await transport.connect()
    expect(transport.isConnected()).toBe(true)

    await transport.disconnect()
    expect(transport.isConnected()).toBe(false)
  })

  it('sends a message and returns result with correct JID', async () => {
    const jid = '1234567890@s.whatsapp.net'
    const result = await transport.sendMessage(jid, 'Hello, World!')

    expect(result.key.remoteJid).toBe(jid)
    expect(result.key.fromMe).toBe(true)
    expect(typeof result.key.id).toBe('string')
    expect(result.status).toBe('sent')
  })

  it('records sent messages', async () => {
    const jid = '1234567890@s.whatsapp.net'
    await transport.sendMessage(jid, 'First message')
    await transport.sendMessage(jid, 'Second message')

    const sent = transport.getSentMessages()
    expect(sent).toHaveLength(2)
    expect(sent[0]?.jid).toBe(jid)
    expect(sent[0]?.text).toBe('First message')
    expect(sent[1]?.text).toBe('Second message')
  })

  it('records deleted messages', async () => {
    const key = { remoteJid: '1234567890@s.whatsapp.net', fromMe: true, id: 'msg-001' }
    await transport.deleteMessage(key.remoteJid, key)

    const deleted = transport.getDeletedMessages()
    expect(deleted).toHaveLength(1)
    expect(deleted[0]).toEqual({ jid: key.remoteJid, key })
  })

  it('records kicked participants', async () => {
    const groupJid = 'abc@g.us'
    const userJid = '9876543210@s.whatsapp.net'
    const result = await transport.kickParticipant(groupJid, userJid)

    expect(result).toBe(true)
    const kicked = transport.getKickedParticipants()
    expect(kicked).toHaveLength(1)
    expect(kicked[0]).toEqual({ groupJid, userJid })
  })

  it('triggers QR code callback via emitQr', () => {
    const qrValues: string[] = []
    transport.onQrCode((qr) => qrValues.push(qr))
    transport.emitQr('fake-qr-code-data')

    expect(qrValues).toHaveLength(1)
    expect(qrValues[0]).toBe('fake-qr-code-data')
  })

  it('returns group metadata', async () => {
    const groupJid = 'abc@g.us'
    const meta = await transport.getGroupMetadata(groupJid)

    expect(meta.id).toBe(groupJid)
    expect(Array.isArray(meta.participants)).toBe(true)
    expect(typeof meta.size).toBe('number')
  })

  it('returns group invite link', async () => {
    const groupJid = 'abc@g.us'
    const link = await transport.getGroupInviteLink(groupJid)

    expect(typeof link).toBe('string')
    expect(link.length).toBeGreaterThan(0)
  })

  it('clear resets all tracked state', async () => {
    await transport.sendMessage('jid@s.whatsapp.net', 'test')
    await transport.kickParticipant('group@g.us', 'user@s.whatsapp.net')

    transport.clear()

    expect(transport.getSentMessages()).toHaveLength(0)
    expect(transport.getKickedParticipants()).toHaveLength(0)
    expect(transport.getDeletedMessages()).toHaveLength(0)
  })
})
