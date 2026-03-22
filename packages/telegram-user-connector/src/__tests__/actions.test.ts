import { describe, it, expect, beforeEach } from 'vitest'
import { ActionRegistry } from '@flowbot/platform-kit'
import { FakeTelegramUserTransport } from '../sdk/fake-client.js'
import { registerMessagingActions } from '../actions/messaging.js'
import { registerUserActions } from '../actions/user-actions.js'
import { registerGroupsActions } from '../actions/groups.js'

const PEER = 'channel123'
const USER_ID = 'user456'
const FROM_PEER = 'chat_a'
const TO_PEER = 'chat_b'

describe('messaging actions', () => {
  let transport: FakeTelegramUserTransport
  let registry: ActionRegistry

  beforeEach(async () => {
    transport = new FakeTelegramUserTransport()
    await transport.connect()
    registry = new ActionRegistry()
    registerMessagingActions(registry, transport)
  })

  it('send_message executes via registry', async () => {
    const result = await registry.execute('send_message', { peer: PEER, text: 'hello' })
    expect(result.success).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(1)
    expect(transport.getSentMessages()[0]?.text).toBe('hello')
  })

  it('send_message fails with missing params', async () => {
    const result = await registry.execute('send_message', { peer: PEER })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('send_message accepts optional options', async () => {
    const result = await registry.execute('send_message', {
      peer: PEER,
      text: 'styled',
      options: { parseMode: 'html', silent: true },
    })
    expect(result.success).toBe(true)
  })

  it('send_photo executes via registry', async () => {
    const result = await registry.execute('send_photo', { peer: PEER, photoUrl: 'https://example.com/img.jpg' })
    expect(result.success).toBe(true)
  })

  it('send_video executes via registry', async () => {
    const result = await registry.execute('send_video', { peer: PEER, videoUrl: 'https://example.com/vid.mp4' })
    expect(result.success).toBe(true)
  })

  it('send_document executes via registry', async () => {
    const result = await registry.execute('send_document', {
      peer: PEER,
      documentUrl: 'https://example.com/doc.pdf',
      options: { fileName: 'doc.pdf' },
    })
    expect(result.success).toBe(true)
  })

  it('send_sticker executes via registry', async () => {
    const result = await registry.execute('send_sticker', { peer: PEER, sticker: 'sticker-file-id' })
    expect(result.success).toBe(true)
  })

  it('send_voice executes via registry', async () => {
    const result = await registry.execute('send_voice', { peer: PEER, voiceUrl: 'https://example.com/voice.ogg' })
    expect(result.success).toBe(true)
  })

  it('send_audio executes via registry', async () => {
    const result = await registry.execute('send_audio', { peer: PEER, audioUrl: 'https://example.com/audio.mp3' })
    expect(result.success).toBe(true)
  })

  it('send_animation executes via registry', async () => {
    const result = await registry.execute('send_animation', { peer: PEER, animationUrl: 'https://example.com/anim.gif' })
    expect(result.success).toBe(true)
  })

  it('send_location executes via registry', async () => {
    const result = await registry.execute('send_location', { peer: PEER, latitude: 48.8566, longitude: 2.3522 })
    expect(result.success).toBe(true)
  })

  it('send_contact executes via registry', async () => {
    const result = await registry.execute('send_contact', { peer: PEER, phoneNumber: '+1234567890', firstName: 'Alice' })
    expect(result.success).toBe(true)
  })

  it('send_contact with lastName executes via registry', async () => {
    const result = await registry.execute('send_contact', {
      peer: PEER,
      phoneNumber: '+1234567890',
      firstName: 'Alice',
      lastName: 'Smith',
    })
    expect(result.success).toBe(true)
  })

  it('send_venue executes via registry', async () => {
    const result = await registry.execute('send_venue', {
      peer: PEER,
      latitude: 48.8566,
      longitude: 2.3522,
      title: 'Eiffel Tower',
      address: 'Paris',
    })
    expect(result.success).toBe(true)
  })

  it('send_dice executes via registry', async () => {
    const result = await registry.execute('send_dice', { peer: PEER })
    expect(result.success).toBe(true)
  })

  it('send_dice with emoji executes via registry', async () => {
    const result = await registry.execute('send_dice', { peer: PEER, emoji: '🎲' })
    expect(result.success).toBe(true)
  })

  it('forward_message executes via registry', async () => {
    const result = await registry.execute('forward_message', {
      fromPeer: FROM_PEER,
      toPeer: TO_PEER,
      messageIds: [1, 2, 3],
    })
    expect(result.success).toBe(true)
    const forwarded = transport.getForwardedMessages()
    expect(forwarded).toHaveLength(1)
    expect(forwarded[0]?.fromPeer).toBe(FROM_PEER)
    expect(forwarded[0]?.toPeer).toBe(TO_PEER)
    expect(forwarded[0]?.messageIds).toEqual([1, 2, 3])
  })

  it('forward_message fails with missing params', async () => {
    const result = await registry.execute('forward_message', { fromPeer: FROM_PEER })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('send_media_group executes via registry', async () => {
    const result = await registry.execute('send_media_group', {
      peer: PEER,
      media: [
        { type: 'photo', url: 'https://example.com/img.jpg', caption: 'A photo' },
        { type: 'video', url: 'https://example.com/vid.mp4' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('resolve_username executes via registry', async () => {
    const result = await registry.execute('resolve_username', { username: 'telegram' })
    expect(result.success).toBe(true)
    const data = result.data as { id: bigint; type: string }
    expect(data.type).toBe('user')
  })

  it('returns error for unregistered action', async () => {
    const result = await registry.execute('nonexistent_action', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('not registered')
  })
})

describe('user actions', () => {
  let transport: FakeTelegramUserTransport
  let registry: ActionRegistry

  beforeEach(async () => {
    transport = new FakeTelegramUserTransport()
    await transport.connect()
    registry = new ActionRegistry()
    registerUserActions(registry, transport)
  })

  it('edit_message executes via registry', async () => {
    const result = await registry.execute('edit_message', { peer: PEER, messageId: 42, text: 'edited text' })
    expect(result.success).toBe(true)
  })

  it('edit_message fails with missing params', async () => {
    const result = await registry.execute('edit_message', { peer: PEER })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('delete_message executes via registry', async () => {
    const result = await registry.execute('delete_message', { peer: PEER, messageIds: [1, 2, 3] })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('pin_message executes via registry', async () => {
    const result = await registry.execute('pin_message', { peer: PEER, messageId: 42 })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('pin_message with silent=true executes via registry', async () => {
    const result = await registry.execute('pin_message', { peer: PEER, messageId: 42, silent: true })
    expect(result.success).toBe(true)
  })

  it('unpin_message executes via registry', async () => {
    const result = await registry.execute('unpin_message', { peer: PEER })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('copy_message executes via registry', async () => {
    const result = await registry.execute('copy_message', { fromPeer: FROM_PEER, toPeer: TO_PEER, messageId: 99 })
    expect(result.success).toBe(true)
  })

  it('ban_user executes via registry', async () => {
    const result = await registry.execute('ban_user', { peer: PEER, userId: USER_ID })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('ban_user fails with missing userId', async () => {
    const result = await registry.execute('ban_user', { peer: PEER })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('restrict_user executes via registry', async () => {
    const result = await registry.execute('restrict_user', {
      peer: PEER,
      userId: USER_ID,
      permissions: { canSendMessages: false },
    })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('promote_user executes via registry', async () => {
    const result = await registry.execute('promote_user', {
      peer: PEER,
      userId: USER_ID,
      privileges: { canDeleteMessages: true },
    })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('set_chat_title executes via registry', async () => {
    const result = await registry.execute('set_chat_title', { peer: PEER, title: 'New Title' })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('set_chat_description executes via registry', async () => {
    const result = await registry.execute('set_chat_description', { peer: PEER, description: 'New description' })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('export_invite_link executes via registry', async () => {
    const result = await registry.execute('export_invite_link', { peer: PEER })
    expect(result.success).toBe(true)
    expect(typeof result.data).toBe('string')
    expect(result.data as string).toContain('t.me')
  })

  it('get_chat_member executes via registry', async () => {
    const result = await registry.execute('get_chat_member', { peer: PEER, userId: USER_ID })
    expect(result.success).toBe(true)
    const data = result.data as { userId: string; status: string }
    expect(data.userId).toBe(USER_ID)
    expect(data.status).toBe('member')
  })

  it('leave_chat executes via registry', async () => {
    const result = await registry.execute('leave_chat', { peer: PEER })
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })

  it('create_poll executes via registry', async () => {
    const result = await registry.execute('create_poll', {
      peer: PEER,
      question: 'Favorite color?',
      answers: ['Red', 'Blue', 'Green'],
    })
    expect(result.success).toBe(true)
  })

  it('create_poll with options executes via registry', async () => {
    const result = await registry.execute('create_poll', {
      peer: PEER,
      question: 'Best language?',
      answers: ['TypeScript', 'Rust'],
      isAnonymous: false,
      multipleChoice: true,
    })
    expect(result.success).toBe(true)
  })

  it('create_forum_topic executes via registry', async () => {
    const result = await registry.execute('create_forum_topic', { peer: PEER, name: 'General' })
    expect(result.success).toBe(true)
    expect(typeof result.data).toBe('number')
  })

  it('create_forum_topic with icon options executes via registry', async () => {
    const result = await registry.execute('create_forum_topic', {
      peer: PEER,
      name: 'News',
      iconColor: 0xff0000,
      iconEmojiId: 'emoji123',
    })
    expect(result.success).toBe(true)
  })
})

describe('groups actions (user_list_groups)', () => {
  let transport: FakeTelegramUserTransport
  let registry: ActionRegistry

  beforeEach(async () => {
    transport = new FakeTelegramUserTransport()
    await transport.connect()
    registry = new ActionRegistry()
    registerGroupsActions(registry, transport)
  })

  it('user_list_groups returns empty list when no dialogs exist', async () => {
    const result = await registry.execute('user_list_groups', {})
    expect(result.success).toBe(true)
    const data = result.data as { groups: unknown[] }
    expect(data.groups).toEqual([])
  })

  it('user_list_groups returns groups filtered from dialogs', async () => {
    transport.setFakeDialogs([
      { entity: { className: 'Channel', id: '-100111', title: 'My Channel', participantsCount: 50 } },
      { entity: { className: 'Chat', id: '-100222', title: 'My Group', participantsCount: 10 } },
      { entity: { className: 'User', id: '999', title: 'Direct User' } },
    ])
    const result = await registry.execute('user_list_groups', {})
    expect(result.success).toBe(true)
    const data = result.data as { groups: Array<{ id: string; name: string; memberCount: number }> }
    expect(data.groups).toHaveLength(2)
    expect(data.groups[0]).toMatchObject({ id: '-100111', name: 'My Channel', memberCount: 50 })
    expect(data.groups[1]).toMatchObject({ id: '-100222', name: 'My Group', memberCount: 10 })
  })

  it('user_list_groups ignores dialogs with null entity', async () => {
    transport.setFakeDialogs([
      { entity: null },
      { entity: { className: 'Channel', id: '-100333', title: 'Valid Channel', participantsCount: 5 } },
    ])
    const result = await registry.execute('user_list_groups', {})
    expect(result.success).toBe(true)
    const data = result.data as { groups: unknown[] }
    expect(data.groups).toHaveLength(1)
  })
})
