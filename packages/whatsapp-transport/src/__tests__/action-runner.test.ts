import { describe, expect, it } from 'vitest'

import { ActionRunner } from '../actions/runner.js'
import { ActionType } from '../actions/types.js'
import { FakeWhatsAppTransport } from '../transport/FakeWhatsAppTransport.js'

describe('ActionRunner', () => {
  // --- send_message ---

  it('executes send_message action', async () => {
    const transport = new FakeWhatsAppTransport()
    await transport.connect()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_MESSAGE,
      jid: '123@s.whatsapp.net',
      text: 'hello world',
    })
    expect(result.success).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(1)
    expect(transport.getSentMessages()[0]?.jid).toBe('123@s.whatsapp.net')
    expect(transport.getSentMessages()[0]?.text).toBe('hello world')
  })

  it('send_message includes result data', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_MESSAGE,
      jid: 'target@s.whatsapp.net',
      text: 'test',
    })
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })

  // --- send_photo ---

  it('executes send_photo action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_PHOTO,
      jid: '123@s.whatsapp.net',
      url: 'https://example.com/photo.jpg',
      caption: 'A photo',
    })
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })

  it('executes send_video action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_VIDEO,
      jid: '123@s.whatsapp.net',
      url: 'https://example.com/video.mp4',
    })
    expect(result.success).toBe(true)
  })

  it('executes send_audio action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_AUDIO,
      jid: '123@s.whatsapp.net',
      url: 'https://example.com/audio.mp3',
    })
    expect(result.success).toBe(true)
  })

  it('executes send_document action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_DOCUMENT,
      jid: '123@s.whatsapp.net',
      url: 'https://example.com/doc.pdf',
      fileName: 'doc.pdf',
      mimetype: 'application/pdf',
    })
    expect(result.success).toBe(true)
  })

  it('executes send_sticker action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_STICKER,
      jid: '123@s.whatsapp.net',
      url: 'https://example.com/sticker.webp',
    })
    expect(result.success).toBe(true)
  })

  it('executes send_voice action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_VOICE,
      jid: '123@s.whatsapp.net',
      url: 'https://example.com/voice.ogg',
    })
    expect(result.success).toBe(true)
  })

  it('executes send_location action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_LOCATION,
      jid: '123@s.whatsapp.net',
      latitude: 51.5074,
      longitude: -0.1278,
    })
    expect(result.success).toBe(true)
  })

  it('executes send_contact action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_CONTACT,
      jid: '123@s.whatsapp.net',
      contact: { fullName: 'John Doe', phoneNumber: '+447700900000' },
    })
    expect(result.success).toBe(true)
  })

  // --- message management ---

  it('executes forward_message action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.FORWARD_MESSAGE,
      fromJid: 'group@g.us',
      toJid: 'user@s.whatsapp.net',
      key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg-1' },
    })
    expect(result.success).toBe(true)
  })

  it('executes edit_message action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.EDIT_MESSAGE,
      jid: '123@s.whatsapp.net',
      key: { remoteJid: '123@s.whatsapp.net', fromMe: true, id: 'msg-1' },
      text: 'edited text',
    })
    expect(result.success).toBe(true)
  })

  it('executes delete_message action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const key = { remoteJid: '123@s.whatsapp.net', fromMe: true, id: 'msg-1' }
    const result = await runner.execute({
      type: ActionType.DELETE_MESSAGE,
      jid: '123@s.whatsapp.net',
      key,
    })
    expect(result.success).toBe(true)
    expect(transport.getDeletedMessages()).toHaveLength(1)
    expect(transport.getDeletedMessages()[0]?.key.id).toBe('msg-1')
  })

  it('executes read_history action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.READ_HISTORY,
      jid: '123@s.whatsapp.net',
      count: 10,
    })
    expect(result.success).toBe(true)
  })

  // --- group admin ---

  it('executes kick_user action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.KICK_USER,
      groupJid: 'group@g.us',
      userJid: 'user@s.whatsapp.net',
    })
    expect(result.success).toBe(true)
    expect(transport.getKickedParticipants()).toHaveLength(1)
    expect(transport.getKickedParticipants()[0]?.groupJid).toBe('group@g.us')
    expect(transport.getKickedParticipants()[0]?.userJid).toBe('user@s.whatsapp.net')
  })

  it('executes promote_user action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.PROMOTE_USER,
      groupJid: 'group@g.us',
      userJid: 'user@s.whatsapp.net',
    })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('executes demote_user action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.DEMOTE_USER,
      groupJid: 'group@g.us',
      userJid: 'user@s.whatsapp.net',
    })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('executes get_group_info action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.GET_GROUP_INFO,
      groupJid: 'group@g.us',
    })
    expect(result.success).toBe(true)
    const data = result.data as { id: string; subject: string }
    expect(data.id).toBe('group@g.us')
    expect(data.subject).toBe('Fake Group')
  })

  it('executes get_invite_link action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.GET_INVITE_LINK,
      groupJid: 'group@g.us',
    })
    expect(result.success).toBe(true)
    expect(typeof result.data).toBe('string')
    expect(result.data as string).toContain('whatsapp.com')
  })

  // --- presence ---

  it('executes send_presence action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_PRESENCE,
      jid: '123@s.whatsapp.net',
      presence: 'composing',
    })
    expect(result.success).toBe(true)
  })

  // --- error cases ---

  it('returns error for unknown action', async () => {
    const transport = new FakeWhatsAppTransport()
    const runner = new ActionRunner(transport)
    const result = await runner.execute({ type: 'unknown_action' as ActionType } as never)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown action')
  })

  it('returns error when executor throws', async () => {
    const transport = new FakeWhatsAppTransport()
    // Override sendMessage to throw
    transport.sendMessage = async (_jid: string, _text: string) => {
      throw new Error('Network error')
    }
    const runner = new ActionRunner(transport)
    const result = await runner.execute({
      type: ActionType.SEND_MESSAGE,
      jid: '123@s.whatsapp.net',
      text: 'hello',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Network error')
  })
})
