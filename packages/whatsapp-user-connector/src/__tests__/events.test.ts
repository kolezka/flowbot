import { describe, it, expect } from 'vitest'
import { mapMessageUpsert, mapGroupParticipantsUpdate, mapGroupsUpdate, mapPresenceUpdate } from '../events/mapper.js'

describe('mapMessageUpsert', () => {
  it('maps a text message to FlowTriggerEvent', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg1' },
        message: { conversation: 'hello' },
        pushName: 'Alice',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-instance-id')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      platform: 'whatsapp',
      communityId: 'group@g.us',
      accountId: expect.any(String),
      eventType: 'message_received',
      data: expect.objectContaining({ text: 'hello', isDirectMessage: false }),
      timestamp: expect.any(String),
      botInstanceId: 'bot-instance-id',
    })
  })

  it('sets communityId to null for DMs', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: '123@s.whatsapp.net', fromMe: false, id: 'msg2' },
        message: { conversation: 'hi' },
        pushName: 'Bob',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-instance-id')

    expect(events[0]!.communityId).toBeNull()
    expect(events[0]!.data!.isDirectMessage).toBe(true)
  })

  it('skips fromMe messages', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: true, id: 'msg3' },
        message: { conversation: 'echo' },
        pushName: 'Me',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')
    expect(events).toHaveLength(0)
  })

  it('extracts text from extendedTextMessage', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg4' },
        message: { extendedTextMessage: { text: 'extended hello' } },
        pushName: 'Carol',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')

    expect(events).toHaveLength(1)
    expect(events[0]!.data!.text).toBe('extended hello')
  })

  it('detects image media type', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg5' },
        message: { imageMessage: { caption: 'a photo' } },
        pushName: 'Dave',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')

    expect(events).toHaveLength(1)
    expect(events[0]!.data!.mediaType).toBe('image')
  })

  it('detects video media type', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg6' },
        message: { videoMessage: {} },
        pushName: 'Dave',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')
    expect(events[0]!.data!.mediaType).toBe('video')
  })

  it('detects audio media type', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg7' },
        message: { audioMessage: {} },
        pushName: 'Dave',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')
    expect(events[0]!.data!.mediaType).toBe('audio')
  })

  it('detects document media type', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg8' },
        message: { documentMessage: {} },
        pushName: 'Dave',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')
    expect(events[0]!.data!.mediaType).toBe('document')
  })

  it('detects sticker media type', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg9' },
        message: { stickerMessage: {} },
        pushName: 'Dave',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')
    expect(events[0]!.data!.mediaType).toBe('sticker')
  })

  it('includes pushName in data', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg10' },
        message: { conversation: 'hey' },
        pushName: 'Eve',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')
    expect(events[0]!.data!.senderName).toBe('Eve')
  })

  it('includes messageId in data', () => {
    const events = mapMessageUpsert({
      messages: [{
        key: { remoteJid: 'group@g.us', fromMe: false, id: 'msg-xyz' },
        message: { conversation: 'test' },
        pushName: 'Frank',
        messageTimestamp: 1234567890,
      }],
      type: 'notify',
    }, 'bot-id')
    expect(events[0]!.data!.messageId).toBe('msg-xyz')
  })
})

describe('mapGroupParticipantsUpdate', () => {
  it('maps add to member_join', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'group@g.us', participants: ['123@s.whatsapp.net'], action: 'add' },
      'bot-id',
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.eventType).toBe('member_join')
  })

  it('maps remove to member_leave', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'group@g.us', participants: ['123@s.whatsapp.net'], action: 'remove' },
      'bot-id',
    )
    expect(events[0]!.eventType).toBe('member_leave')
  })

  it('maps promote to member_promoted', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'group@g.us', participants: ['123@s.whatsapp.net'], action: 'promote' },
      'bot-id',
    )
    expect(events[0]!.eventType).toBe('member_promoted')
  })

  it('maps demote to member_demoted', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'group@g.us', participants: ['123@s.whatsapp.net'], action: 'demote' },
      'bot-id',
    )
    expect(events[0]!.eventType).toBe('member_demoted')
  })

  it('emits one event per participant', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'group@g.us', participants: ['user1@s.whatsapp.net', 'user2@s.whatsapp.net'], action: 'add' },
      'bot-id',
    )
    expect(events).toHaveLength(2)
  })

  it('sets communityId to group JID', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'mygroup@g.us', participants: ['user@s.whatsapp.net'], action: 'add' },
      'bot-id',
    )
    expect(events[0]!.communityId).toBe('mygroup@g.us')
  })

  it('sets platform to whatsapp', () => {
    const events = mapGroupParticipantsUpdate(
      { id: 'group@g.us', participants: ['user@s.whatsapp.net'], action: 'remove' },
      'bot-id',
    )
    expect(events[0]!.platform).toBe('whatsapp')
  })
})

describe('mapGroupsUpdate', () => {
  it('maps group metadata change to group_updated event', () => {
    const events = mapGroupsUpdate(
      [{ id: 'group@g.us', subject: 'New Name' }],
      'bot-id',
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.eventType).toBe('group_updated')
    expect(events[0]!.communityId).toBe('group@g.us')
    expect(events[0]!.platform).toBe('whatsapp')
  })

  it('emits one event per group update', () => {
    const events = mapGroupsUpdate(
      [{ id: 'group1@g.us', subject: 'G1' }, { id: 'group2@g.us', description: 'desc' }],
      'bot-id',
    )
    expect(events).toHaveLength(2)
  })
})

describe('mapPresenceUpdate', () => {
  it('maps presence update to presence_update event', () => {
    const events = mapPresenceUpdate(
      { id: 'user@s.whatsapp.net', presences: { 'user@s.whatsapp.net': { lastKnownPresence: 'available' } } },
      'bot-id',
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.eventType).toBe('presence_update')
    expect(events[0]!.accountId).toBe('user@s.whatsapp.net')
    expect(events[0]!.platform).toBe('whatsapp')
  })
})
