import { describe, it, expect, beforeEach } from 'vitest'
import { ActionRegistry } from '@flowbot/platform-kit'
import { FakeTelegramBot } from '../sdk/fake-bot.js'
import { registerMessagingActions } from '../actions/messaging.js'
import { registerAdminActions } from '../actions/admin.js'
import { registerChatActions } from '../actions/chat.js'
import { registerMessageMgmtActions } from '../actions/message-mgmt.js'
import { registerGroupsActions } from '../actions/groups.js'

const CHAT_ID = '-1001234567890'
const USER_ID = 12345
const MESSAGE_ID = 99

describe('messaging actions', () => {
  let transport: FakeTelegramBot
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeTelegramBot()
    registry = new ActionRegistry()
    registerMessagingActions(registry, transport)
  })

  it('send_message executes via registry', async () => {
    const result = await registry.execute('send_message', { chatId: CHAT_ID, text: 'hello' })
    expect(result.success).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(1)
    expect(transport.getSentMessages()[0]?.text).toBe('hello')
  })

  it('send_message fails with missing text', async () => {
    const result = await registry.execute('send_message', { chatId: CHAT_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('send_message with options executes via registry', async () => {
    const result = await registry.execute('send_message', {
      chatId: CHAT_ID,
      text: 'hello',
      parseMode: 'HTML',
      disableNotification: true,
    })
    expect(result.success).toBe(true)
  })

  it('send_photo executes via registry', async () => {
    const result = await registry.execute('send_photo', {
      chatId: CHAT_ID,
      photoUrl: 'https://example.com/photo.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('send_photo with caption executes via registry', async () => {
    const result = await registry.execute('send_photo', {
      chatId: CHAT_ID,
      photoUrl: 'https://example.com/photo.jpg',
      caption: 'A nice photo',
    })
    expect(result.success).toBe(true)
  })

  it('send_photo fails with missing photoUrl', async () => {
    const result = await registry.execute('send_photo', { chatId: CHAT_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('send_video executes via registry', async () => {
    const result = await registry.execute('send_video', {
      chatId: CHAT_ID,
      videoUrl: 'https://example.com/video.mp4',
    })
    expect(result.success).toBe(true)
  })

  it('send_document executes via registry', async () => {
    const result = await registry.execute('send_document', {
      chatId: CHAT_ID,
      documentUrl: 'https://example.com/doc.pdf',
      fileName: 'doc.pdf',
    })
    expect(result.success).toBe(true)
  })

  it('send_audio executes via registry', async () => {
    const result = await registry.execute('send_audio', {
      chatId: CHAT_ID,
      audioUrl: 'https://example.com/audio.mp3',
    })
    expect(result.success).toBe(true)
  })

  it('send_voice executes via registry', async () => {
    const result = await registry.execute('send_voice', {
      chatId: CHAT_ID,
      voiceUrl: 'https://example.com/voice.ogg',
    })
    expect(result.success).toBe(true)
  })

  it('send_sticker executes via registry', async () => {
    const result = await registry.execute('send_sticker', {
      chatId: CHAT_ID,
      sticker: 'CAACAgIA',
    })
    expect(result.success).toBe(true)
  })

  it('send_location executes via registry', async () => {
    const result = await registry.execute('send_location', {
      chatId: CHAT_ID,
      latitude: 48.8566,
      longitude: 2.3522,
    })
    expect(result.success).toBe(true)
  })

  it('send_contact executes via registry', async () => {
    const result = await registry.execute('send_contact', {
      chatId: CHAT_ID,
      phoneNumber: '+1234567890',
      firstName: 'Alice',
    })
    expect(result.success).toBe(true)
  })

  it('send_contact with lastName executes via registry', async () => {
    const result = await registry.execute('send_contact', {
      chatId: CHAT_ID,
      phoneNumber: '+1234567890',
      firstName: 'Alice',
      lastName: 'Smith',
    })
    expect(result.success).toBe(true)
  })

  it('send_poll executes via registry', async () => {
    const result = await registry.execute('send_poll', {
      chatId: CHAT_ID,
      question: 'What is your favourite colour?',
      options: ['Red', 'Blue', 'Green'],
    })
    expect(result.success).toBe(true)
  })

  it('send_poll fails with missing options', async () => {
    const result = await registry.execute('send_poll', {
      chatId: CHAT_ID,
      question: 'What?',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('returns error for unregistered action', async () => {
    const result = await registry.execute('nonexistent_action', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('not registered')
  })
})

describe('admin actions', () => {
  let transport: FakeTelegramBot
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeTelegramBot()
    registry = new ActionRegistry()
    registerAdminActions(registry, transport)
  })

  it('ban_user executes via registry', async () => {
    const result = await registry.execute('ban_user', { chatId: CHAT_ID, userId: USER_ID })
    expect(result.success).toBe(true)
    expect(transport.getBannedUsers()).toHaveLength(1)
    expect(transport.getBannedUsers()[0]?.chatId).toBe(CHAT_ID)
    expect(transport.getBannedUsers()[0]?.userId).toBe(USER_ID)
  })

  it('ban_user fails with missing userId', async () => {
    const result = await registry.execute('ban_user', { chatId: CHAT_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('unban_user executes via registry', async () => {
    const result = await registry.execute('unban_user', { chatId: CHAT_ID, userId: USER_ID })
    expect(result.success).toBe(true)
  })

  it('restrict_user executes via registry', async () => {
    const result = await registry.execute('restrict_user', {
      chatId: CHAT_ID,
      userId: USER_ID,
      canSendMessages: false,
    })
    expect(result.success).toBe(true)
    expect(transport.getRestrictedUsers()).toHaveLength(1)
    expect(transport.getRestrictedUsers()[0]?.userId).toBe(USER_ID)
  })

  it('promote_user executes via registry', async () => {
    const result = await registry.execute('promote_user', {
      chatId: CHAT_ID,
      userId: USER_ID,
      canDeleteMessages: true,
    })
    expect(result.success).toBe(true)
  })

  it('promote_user fails with missing userId', async () => {
    const result = await registry.execute('promote_user', { chatId: CHAT_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })
})

describe('chat actions', () => {
  let transport: FakeTelegramBot
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeTelegramBot()
    registry = new ActionRegistry()
    registerChatActions(registry, transport)
  })

  it('get_chat executes via registry', async () => {
    const result = await registry.execute('get_chat', { chatId: CHAT_ID })
    expect(result.success).toBe(true)
    const data = result.data as { id: number; type: string }
    expect(data.type).toBe('supergroup')
  })

  it('get_chat fails with missing chatId', async () => {
    const result = await registry.execute('get_chat', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('get_chat_member executes via registry', async () => {
    const result = await registry.execute('get_chat_member', { chatId: CHAT_ID, userId: USER_ID })
    expect(result.success).toBe(true)
    const data = result.data as { userId: number; status: string }
    expect(data.userId).toBe(USER_ID)
    expect(data.status).toBe('member')
  })

  it('get_chat_members_count executes via registry', async () => {
    const result = await registry.execute('get_chat_members_count', { chatId: CHAT_ID })
    expect(result.success).toBe(true)
    expect(typeof result.data).toBe('number')
  })

  it('set_chat_title executes via registry', async () => {
    const result = await registry.execute('set_chat_title', { chatId: CHAT_ID, title: 'New Title' })
    expect(result.success).toBe(true)
  })

  it('set_chat_description executes via registry', async () => {
    const result = await registry.execute('set_chat_description', {
      chatId: CHAT_ID,
      description: 'New description',
    })
    expect(result.success).toBe(true)
  })
})

describe('message management actions', () => {
  let transport: FakeTelegramBot
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeTelegramBot()
    registry = new ActionRegistry()
    registerMessageMgmtActions(registry, transport)
  })

  it('edit_message executes via registry', async () => {
    const result = await registry.execute('edit_message', {
      chatId: CHAT_ID,
      messageId: MESSAGE_ID,
      text: 'edited text',
    })
    expect(result.success).toBe(true)
  })

  it('edit_message fails with missing text', async () => {
    const result = await registry.execute('edit_message', { chatId: CHAT_ID, messageId: MESSAGE_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('delete_message executes via registry', async () => {
    const result = await registry.execute('delete_message', { chatId: CHAT_ID, messageId: MESSAGE_ID })
    expect(result.success).toBe(true)
    expect(transport.getDeletedMessages()).toHaveLength(1)
    expect(transport.getDeletedMessages()[0]?.chatId).toBe(CHAT_ID)
    expect(transport.getDeletedMessages()[0]?.messageId).toBe(MESSAGE_ID)
  })

  it('pin_message executes via registry', async () => {
    const result = await registry.execute('pin_message', { chatId: CHAT_ID, messageId: MESSAGE_ID })
    expect(result.success).toBe(true)
  })

  it('unpin_message executes via registry', async () => {
    const result = await registry.execute('unpin_message', { chatId: CHAT_ID })
    expect(result.success).toBe(true)
  })

  it('unpin_message with messageId executes via registry', async () => {
    const result = await registry.execute('unpin_message', { chatId: CHAT_ID, messageId: MESSAGE_ID })
    expect(result.success).toBe(true)
  })

  it('reply_to_message executes via registry', async () => {
    const result = await registry.execute('reply_to_message', {
      chatId: CHAT_ID,
      messageId: MESSAGE_ID,
      text: 'this is a reply',
    })
    expect(result.success).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(1)
    expect(transport.getSentMessages()[0]?.text).toBe('this is a reply')
  })

  it('reply_to_message fails with missing text', async () => {
    const result = await registry.execute('reply_to_message', {
      chatId: CHAT_ID,
      messageId: MESSAGE_ID,
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })
})

describe('groups actions', () => {
  let transport: FakeTelegramBot
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeTelegramBot()
    registry = new ActionRegistry()
    registerGroupsActions(registry, transport)
  })

  it('list_groups returns empty array with note', async () => {
    const result = await registry.execute('list_groups', {})
    expect(result.success).toBe(true)
    const data = result.data as { groups: unknown[]; note: string }
    expect(data.groups).toEqual([])
    expect(data.note).toContain('Telegram Bot API')
  })
})
