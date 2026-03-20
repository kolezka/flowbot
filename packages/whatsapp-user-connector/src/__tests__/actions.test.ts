import { describe, it, expect, beforeEach } from 'vitest'
import { ActionRegistry } from '@flowbot/platform-kit'
import { FakeWhatsAppTransport } from '../sdk/fake-client.js'
import { registerMessagingActions } from '../actions/messaging.js'
import { registerGroupAdminActions } from '../actions/group-admin.js'
import { registerMessageMgmtActions } from '../actions/message-mgmt.js'
import { registerPresenceActions } from '../actions/presence.js'

const USER_JID = '123@s.whatsapp.net'
const GROUP_JID = 'group123@g.us'
const OTHER_USER_JID = 'user2@s.whatsapp.net'
const SAMPLE_KEY = { remoteJid: USER_JID, fromMe: true, id: 'msg-001' }

describe('messaging actions', () => {
  let transport: FakeWhatsAppTransport
  let registry: ActionRegistry

  beforeEach(async () => {
    transport = new FakeWhatsAppTransport()
    await transport.connect()
    registry = new ActionRegistry()
    registerMessagingActions(registry, transport)
  })

  it('send_message executes via registry', async () => {
    const result = await registry.execute('send_message', { chatId: USER_JID, text: 'hello' })
    expect(result.success).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(1)
    expect(transport.getSentMessages()[0]?.text).toBe('hello')
  })

  it('send_message fails with missing params', async () => {
    const result = await registry.execute('send_message', { chatId: USER_JID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('send_photo executes via registry', async () => {
    const result = await registry.execute('send_photo', { chatId: USER_JID, photoUrl: 'https://example.com/img.jpg' })
    expect(result.success).toBe(true)
  })

  it('send_photo with caption executes via registry', async () => {
    const result = await registry.execute('send_photo', { chatId: USER_JID, photoUrl: 'https://example.com/img.jpg', caption: 'Nice photo' })
    expect(result.success).toBe(true)
  })

  it('send_video executes via registry', async () => {
    const result = await registry.execute('send_video', { chatId: USER_JID, videoUrl: 'https://example.com/video.mp4' })
    expect(result.success).toBe(true)
  })

  it('send_document executes via registry', async () => {
    const result = await registry.execute('send_document', {
      chatId: USER_JID,
      documentUrl: 'https://example.com/doc.pdf',
      fileName: 'doc.pdf',
    })
    expect(result.success).toBe(true)
  })

  it('send_audio executes via registry', async () => {
    const result = await registry.execute('send_audio', { chatId: USER_JID, audioUrl: 'https://example.com/audio.mp3' })
    expect(result.success).toBe(true)
  })

  it('send_voice executes via registry', async () => {
    const result = await registry.execute('send_voice', { chatId: USER_JID, voiceUrl: 'https://example.com/voice.ogg' })
    expect(result.success).toBe(true)
  })

  it('send_sticker executes via registry', async () => {
    const result = await registry.execute('send_sticker', { chatId: USER_JID, sticker: 'sticker-id-123' })
    expect(result.success).toBe(true)
  })

  it('send_location executes via registry', async () => {
    const result = await registry.execute('send_location', { chatId: USER_JID, latitude: 48.8566, longitude: 2.3522 })
    expect(result.success).toBe(true)
  })

  it('send_contact executes via registry', async () => {
    const result = await registry.execute('send_contact', { chatId: USER_JID, phoneNumber: '+1234567890', fullName: 'Alice' })
    expect(result.success).toBe(true)
  })

  it('send_contact with organization executes via registry', async () => {
    const result = await registry.execute('send_contact', {
      chatId: USER_JID,
      phoneNumber: '+1234567890',
      fullName: 'Alice',
      organization: 'Acme Corp',
    })
    expect(result.success).toBe(true)
  })

  it('returns error for unregistered action', async () => {
    const result = await registry.execute('nonexistent_action', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('not registered')
  })
})

describe('group admin actions', () => {
  let transport: FakeWhatsAppTransport
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeWhatsAppTransport()
    registry = new ActionRegistry()
    registerGroupAdminActions(registry, transport)
  })

  it('kick_user executes via registry', async () => {
    const result = await registry.execute('kick_user', { chatId: GROUP_JID, userId: OTHER_USER_JID })
    expect(result.success).toBe(true)
    expect(transport.getKickedParticipants()).toHaveLength(1)
    expect(transport.getKickedParticipants()[0]?.groupJid).toBe(GROUP_JID)
    expect(transport.getKickedParticipants()[0]?.userJid).toBe(OTHER_USER_JID)
  })

  it('kick_user fails with missing params', async () => {
    const result = await registry.execute('kick_user', { chatId: GROUP_JID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('promote_user executes via registry', async () => {
    const result = await registry.execute('promote_user', { chatId: GROUP_JID, userId: OTHER_USER_JID })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('demote_user executes via registry', async () => {
    const result = await registry.execute('demote_user', { chatId: GROUP_JID, userId: OTHER_USER_JID })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('get_group_info executes via registry', async () => {
    const result = await registry.execute('get_group_info', { chatId: GROUP_JID })
    expect(result.success).toBe(true)
    const data = result.data as { id: string; subject: string }
    expect(data.id).toBe(GROUP_JID)
    expect(data.subject).toBe('Fake Group')
  })

  it('get_invite_link executes via registry', async () => {
    const result = await registry.execute('get_invite_link', { chatId: GROUP_JID })
    expect(result.success).toBe(true)
    expect(typeof result.data).toBe('string')
    expect(result.data as string).toContain('chat.whatsapp.com')
  })
})

describe('message management actions', () => {
  let transport: FakeWhatsAppTransport
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeWhatsAppTransport()
    registry = new ActionRegistry()
    registerMessageMgmtActions(registry, transport)
  })

  it('forward_message executes via registry', async () => {
    const result = await registry.execute('forward_message', {
      fromChatId: USER_JID,
      toChatId: GROUP_JID,
      messageKey: SAMPLE_KEY,
    })
    expect(result.success).toBe(true)
  })

  it('forward_message fails with missing messageKey', async () => {
    const result = await registry.execute('forward_message', {
      fromChatId: USER_JID,
      toChatId: GROUP_JID,
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('edit_message executes via registry', async () => {
    const result = await registry.execute('edit_message', {
      chatId: USER_JID,
      messageKey: SAMPLE_KEY,
      text: 'edited text',
    })
    expect(result.success).toBe(true)
  })

  it('delete_message executes via registry', async () => {
    const result = await registry.execute('delete_message', {
      chatId: USER_JID,
      messageKey: SAMPLE_KEY,
    })
    expect(result.success).toBe(true)
    expect(transport.getDeletedMessages()).toHaveLength(1)
    expect(transport.getDeletedMessages()[0]?.jid).toBe(USER_JID)
  })

  it('read_history executes via registry', async () => {
    const result = await registry.execute('read_history', { chatId: USER_JID })
    expect(result.success).toBe(true)
  })

  it('read_history with count executes via registry', async () => {
    const result = await registry.execute('read_history', { chatId: USER_JID, count: 100 })
    expect(result.success).toBe(true)
  })
})

describe('presence actions', () => {
  let transport: FakeWhatsAppTransport
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeWhatsAppTransport()
    registry = new ActionRegistry()
    registerPresenceActions(registry, transport)
  })

  it('send_presence executes via registry', async () => {
    const result = await registry.execute('send_presence', { chatId: USER_JID, type: 'composing' })
    expect(result.success).toBe(true)
  })

  it('send_presence with available type executes via registry', async () => {
    const result = await registry.execute('send_presence', { chatId: USER_JID, type: 'available' })
    expect(result.success).toBe(true)
  })

  it('send_presence fails with missing type', async () => {
    const result = await registry.execute('send_presence', { chatId: USER_JID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })
})
