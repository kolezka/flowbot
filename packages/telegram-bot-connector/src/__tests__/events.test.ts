import { describe, it, expect } from 'vitest'
import { mapMessageEvent, mapMemberJoinEvent, mapMemberLeaveEvent, mapCallbackQueryEvent } from '../events/mapper.js'
import type { Context } from 'grammy'

const BOT_INSTANCE = 'bot-instance-test'

// ---------------------------------------------------------------------------
// Context builder helpers
// ---------------------------------------------------------------------------

function makeMessageCtx(overrides: Partial<{
  chatType: string
  chatId: number
  fromId: number
  firstName: string
  username: string
  text: string
  messageId: number
  photo: boolean
  video: boolean
  document: boolean
}> = {}): Context {
  const opts = {
    chatType: 'supergroup',
    chatId: -100123456,
    fromId: 42,
    firstName: 'Alice',
    username: 'alice',
    text: 'hello',
    messageId: 10,
    ...overrides,
  }

  return {
    chat: { id: opts.chatId, type: opts.chatType },
    from: { id: opts.fromId, first_name: opts.firstName, username: opts.username, is_bot: false },
    message: {
      message_id: opts.messageId,
      text: opts.photo || opts.video || opts.document ? undefined : opts.text,
      photo: opts.photo ? [{}] : undefined,
      video: opts.video ? {} : undefined,
      document: opts.document ? {} : undefined,
    },
    callbackQuery: undefined,
    chatMember: undefined,
  } as unknown as Context
}

function makeChatMemberCtx(opts: {
  chatId: number
  userId: number
  username: string
  firstName: string
  isBot: boolean
  oldStatus: string
  newStatus: string
}): Context {
  return {
    chat: { id: opts.chatId, type: 'supergroup' },
    from: { id: 99, first_name: 'Admin', is_bot: false },
    chatMember: {
      old_chat_member: { status: opts.oldStatus, user: { id: opts.userId, first_name: opts.firstName, is_bot: opts.isBot } },
      new_chat_member: { status: opts.newStatus, user: { id: opts.userId, first_name: opts.firstName, username: opts.username, is_bot: opts.isBot } },
    },
    message: undefined,
    callbackQuery: undefined,
  } as unknown as Context
}

function makeCallbackQueryCtx(opts: {
  fromId: number
  username: string
  callbackQueryId: string
  data: string
  chatId?: number
  messageId?: number
}): Context {
  return {
    chat: opts.chatId ? { id: opts.chatId, type: 'supergroup' } : undefined,
    from: { id: opts.fromId, first_name: 'Bob', username: opts.username, is_bot: false },
    message: undefined,
    chatMember: undefined,
    callbackQuery: {
      id: opts.callbackQueryId,
      data: opts.data,
      message: opts.chatId
        ? { chat: { id: opts.chatId }, message_id: opts.messageId }
        : undefined,
    },
  } as unknown as Context
}

// ---------------------------------------------------------------------------
// mapMessageEvent
// ---------------------------------------------------------------------------

describe('mapMessageEvent', () => {
  it('maps a group text message to FlowTriggerEvent', () => {
    const ctx = makeMessageCtx({ text: 'hello world' })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.platform).toBe('telegram')
    expect(event!.eventType).toBe('message_received')
    expect(event!.communityId).toBe(String(-100123456))
    expect(event!.accountId).toBe(String(42))
    expect(event!.botInstanceId).toBe(BOT_INSTANCE)
    expect(event!.data!.text).toBe('hello world')
    expect(event!.data!.isDirectMessage).toBe(false)
    expect(event!.data!.mediaType).toBeNull()
  })

  it('sets communityId to null for private chats', () => {
    const ctx = makeMessageCtx({ chatType: 'private', chatId: 42 })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.communityId).toBeNull()
    expect(event!.data!.isDirectMessage).toBe(true)
  })

  it('detects photo media type', () => {
    const ctx = makeMessageCtx({ photo: true })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!.mediaType).toBe('photo')
  })

  it('detects video media type', () => {
    const ctx = makeMessageCtx({ video: true })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!.mediaType).toBe('video')
  })

  it('detects document media type', () => {
    const ctx = makeMessageCtx({ document: true })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!.mediaType).toBe('document')
  })

  it('extracts command from text starting with /', () => {
    const ctx = makeMessageCtx({ text: '/start arg1 arg2' })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!.command).toBe('/start')
    expect(event!.data!.commandArgs).toBe('arg1 arg2')
  })

  it('strips @botname from commands', () => {
    const ctx = makeMessageCtx({ text: '/start@MyBot' })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!.command).toBe('/start')
  })

  it('sets command to null for non-command messages', () => {
    const ctx = makeMessageCtx({ text: 'just a message' })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!.command).toBeNull()
  })

  it('includes senderName and username', () => {
    const ctx = makeMessageCtx({ firstName: 'Alice', username: 'alice123' })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!.senderName).toBe('Alice')
    expect(event!.data!.username).toBe('alice123')
  })

  it('includes messageId in data', () => {
    const ctx = makeMessageCtx({ messageId: 55 })
    const event = mapMessageEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!.messageId).toBe(55)
  })

  it('returns null when message is absent', () => {
    const ctx = {
      chat: { id: 1, type: 'supergroup' },
      from: { id: 1 },
      message: undefined,
      chatMember: undefined,
      callbackQuery: undefined,
    } as unknown as Context

    expect(mapMessageEvent(ctx, BOT_INSTANCE)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapMemberJoinEvent
// ---------------------------------------------------------------------------

describe('mapMemberJoinEvent', () => {
  it('maps left -> member transition to member_join event', () => {
    const ctx = makeChatMemberCtx({
      chatId: -100555,
      userId: 77,
      username: 'newmember',
      firstName: 'New',
      isBot: false,
      oldStatus: 'left',
      newStatus: 'member',
    })

    const event = mapMemberJoinEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.eventType).toBe('member_join')
    expect(event!.platform).toBe('telegram')
    expect(event!.communityId).toBe(String(-100555))
    expect(event!.accountId).toBe(String(77))
    expect(event!.botInstanceId).toBe(BOT_INSTANCE)
    expect(event!.data!.username).toBe('newmember')
  })

  it('maps kicked -> member transition to member_join event', () => {
    const ctx = makeChatMemberCtx({
      chatId: -100555,
      userId: 77,
      username: 'unbanned',
      firstName: 'Back',
      isBot: false,
      oldStatus: 'kicked',
      newStatus: 'member',
    })

    const event = mapMemberJoinEvent(ctx, BOT_INSTANCE)
    expect(event).not.toBeNull()
    expect(event!.eventType).toBe('member_join')
  })

  it('returns null for bots joining', () => {
    const ctx = makeChatMemberCtx({
      chatId: -100555,
      userId: 777,
      username: 'somebot',
      firstName: 'Bot',
      isBot: true,
      oldStatus: 'left',
      newStatus: 'member',
    })

    expect(mapMemberJoinEvent(ctx, BOT_INSTANCE)).toBeNull()
  })

  it('returns null when member is already in the group', () => {
    const ctx = makeChatMemberCtx({
      chatId: -100555,
      userId: 77,
      username: 'already',
      firstName: 'Already',
      isBot: false,
      oldStatus: 'member',
      newStatus: 'administrator',
    })

    expect(mapMemberJoinEvent(ctx, BOT_INSTANCE)).toBeNull()
  })

  it('returns null when chatMember is absent', () => {
    const ctx = {
      chat: { id: 1, type: 'supergroup' },
      message: undefined,
      chatMember: undefined,
    } as unknown as Context

    expect(mapMemberJoinEvent(ctx, BOT_INSTANCE)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapMemberLeaveEvent
// ---------------------------------------------------------------------------

describe('mapMemberLeaveEvent', () => {
  it('maps member -> left transition to member_leave event', () => {
    const ctx = makeChatMemberCtx({
      chatId: -100555,
      userId: 88,
      username: 'leaving',
      firstName: 'Leaver',
      isBot: false,
      oldStatus: 'member',
      newStatus: 'left',
    })

    const event = mapMemberLeaveEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.eventType).toBe('member_leave')
    expect(event!.platform).toBe('telegram')
    expect(event!.communityId).toBe(String(-100555))
    expect(event!.accountId).toBe(String(88))
    expect(event!.data!.wasKicked).toBe(false)
  })

  it('sets wasKicked to true for kicked members', () => {
    const ctx = makeChatMemberCtx({
      chatId: -100555,
      userId: 88,
      username: 'kicked',
      firstName: 'Kicked',
      isBot: false,
      oldStatus: 'member',
      newStatus: 'kicked',
    })

    const event = mapMemberLeaveEvent(ctx, BOT_INSTANCE)
    expect(event).not.toBeNull()
    expect(event!.data!.wasKicked).toBe(true)
  })

  it('returns null for bots leaving', () => {
    const ctx = makeChatMemberCtx({
      chatId: -100555,
      userId: 999,
      username: 'leavingbot',
      firstName: 'Bot',
      isBot: true,
      oldStatus: 'member',
      newStatus: 'left',
    })

    expect(mapMemberLeaveEvent(ctx, BOT_INSTANCE)).toBeNull()
  })

  it('returns null when member was not in the group', () => {
    const ctx = makeChatMemberCtx({
      chatId: -100555,
      userId: 88,
      username: 'nothere',
      firstName: 'Ghost',
      isBot: false,
      oldStatus: 'left',
      newStatus: 'kicked',
    })

    expect(mapMemberLeaveEvent(ctx, BOT_INSTANCE)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapCallbackQueryEvent
// ---------------------------------------------------------------------------

describe('mapCallbackQueryEvent', () => {
  it('maps callback query to FlowTriggerEvent', () => {
    const ctx = makeCallbackQueryCtx({
      fromId: 55,
      username: 'clicker',
      callbackQueryId: 'cq-001',
      data: 'button_click',
      chatId: -100999,
      messageId: 77,
    })

    const event = mapCallbackQueryEvent(ctx, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.eventType).toBe('callback_query')
    expect(event!.platform).toBe('telegram')
    expect(event!.accountId).toBe(String(55))
    expect(event!.communityId).toBe(String(-100999))
    expect(event!.botInstanceId).toBe(BOT_INSTANCE)
    expect(event!.data!.callbackQueryId).toBe('cq-001')
    expect(event!.data!.data).toBe('button_click')
    expect(event!.data!.messageId).toBe(77)
    expect(event!.data!.username).toBe('clicker')
  })

  it('sets communityId to null when message has no chat', () => {
    const ctx = makeCallbackQueryCtx({
      fromId: 55,
      username: 'anon',
      callbackQueryId: 'cq-002',
      data: 'some_action',
    })

    const event = mapCallbackQueryEvent(ctx, BOT_INSTANCE)
    expect(event).not.toBeNull()
    expect(event!.communityId).toBeNull()
  })

  it('returns null when callbackQuery is absent', () => {
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      message: undefined,
      chatMember: undefined,
      callbackQuery: undefined,
    } as unknown as Context

    expect(mapCallbackQueryEvent(ctx, BOT_INSTANCE)).toBeNull()
  })
})
