import { describe, it, expect } from 'vitest'
import { FakeWhatsAppTransport } from '@flowbot/whatsapp-transport'
import { handleAction } from '../server/actions.js'

describe('handleAction', () => {
  it('dispatches send_message', async () => {
    const transport = new FakeWhatsAppTransport()
    await transport.connect()
    const result = await handleAction(transport, 'send_message', {
      chatId: '123@s.whatsapp.net',
      text: 'hello',
    })
    expect(result.success).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(1)
  })

  it('dispatches kick_user', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'kick_user', {
      chatId: 'group@g.us',
      userId: 'user@s.whatsapp.net',
    })
    expect(result.success).toBe(true)
  })

  it('returns error for unknown action', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'unknown_thing', {})
    expect(result.success).toBe(false)
  })

  it('dispatches send_photo', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_photo', {
      chatId: '123@s.whatsapp.net',
      photoUrl: 'https://example.com/photo.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches send_video', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_video', {
      chatId: '123@s.whatsapp.net',
      videoUrl: 'https://example.com/video.mp4',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches send_document', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_document', {
      chatId: '123@s.whatsapp.net',
      documentUrl: 'https://example.com/doc.pdf',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches send_audio', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_audio', {
      chatId: '123@s.whatsapp.net',
      audioUrl: 'https://example.com/audio.mp3',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches send_voice', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_voice', {
      chatId: '123@s.whatsapp.net',
      voiceUrl: 'https://example.com/voice.ogg',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches send_sticker', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_sticker', {
      chatId: '123@s.whatsapp.net',
      sticker: 'https://example.com/sticker.webp',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches send_location', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_location', {
      chatId: '123@s.whatsapp.net',
      lat: 51.5074,
      lng: -0.1278,
    })
    expect(result.success).toBe(true)
  })

  it('dispatches send_contact', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_contact', {
      chatId: '123@s.whatsapp.net',
      contact: { fullName: 'John Doe', phoneNumber: '+1234567890' },
    })
    expect(result.success).toBe(true)
  })

  it('dispatches forward_message', async () => {
    const transport = new FakeWhatsAppTransport()
    const key = { remoteJid: 'group@g.us', fromMe: false, id: 'msg1' }
    const result = await handleAction(transport, 'forward_message', {
      from: 'group@g.us',
      to: '123@s.whatsapp.net',
      key,
    })
    expect(result.success).toBe(true)
  })

  it('dispatches edit_message', async () => {
    const transport = new FakeWhatsAppTransport()
    const key = { remoteJid: 'group@g.us', fromMe: false, id: 'msg1' }
    const result = await handleAction(transport, 'edit_message', {
      chatId: 'group@g.us',
      key,
      text: 'edited text',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches delete_message', async () => {
    const transport = new FakeWhatsAppTransport()
    const key = { remoteJid: 'group@g.us', fromMe: false, id: 'msg1' }
    const result = await handleAction(transport, 'delete_message', {
      chatId: 'group@g.us',
      key,
    })
    expect(result.success).toBe(true)
  })

  it('dispatches read_history', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'read_history', {
      chatId: 'group@g.us',
      count: 10,
    })
    expect(result.success).toBe(true)
  })

  it('dispatches promote_user', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'promote_user', {
      chatId: 'group@g.us',
      userId: 'user@s.whatsapp.net',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches demote_user', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'demote_user', {
      chatId: 'group@g.us',
      userId: 'user@s.whatsapp.net',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches get_group_info', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'get_group_info', {
      chatId: 'group@g.us',
    })
    expect(result.success).toBe(true)
    expect(result.result).toBeDefined()
  })

  it('dispatches get_invite_link', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'get_invite_link', {
      chatId: 'group@g.us',
    })
    expect(result.success).toBe(true)
  })

  it('dispatches send_presence', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'send_presence', {
      chatId: '123@s.whatsapp.net',
      type: 'composing',
    })
    expect(result.success).toBe(true)
  })

  it('returns error message for unknown action', async () => {
    const transport = new FakeWhatsAppTransport()
    const result = await handleAction(transport, 'does_not_exist', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('does_not_exist')
  })
})
