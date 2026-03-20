/**
 * Integration tests for the Discord bot event pipeline.
 *
 * Tests the FULL path: discord.js event data → mapper → EventForwarder → HTTP POST
 *
 * Strategy:
 *   - Build a real EventForwarder backed by a mocked `fetch`
 *   - Feed realistic discord.js-shaped objects into each mapper function
 *   - Assert on the EXACT JSON body POSTed to the API webhook
 *
 * Note: discord.js's Client event system requires a live WebSocket connection
 * to emit events programmatically in unit tests.  The mapper functions are the
 * boundary between discord.js and the pipeline, so we test:
 *   mapper(discordJsObject) → FlowTriggerEvent → forwarder.send() → fetch POST
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Message, GuildMember, PartialGuildMember, VoiceState } from 'discord.js'
import { EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import {
  mapMessageEvent,
  mapMemberJoinEvent,
  mapMemberLeaveEvent,
  mapInteractionEvent,
  mapReactionAddEvent,
  mapReactionRemoveEvent,
  mapVoiceStateEvent,
} from '../events/mapper.js'

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger

const BOT_INSTANCE = 'discord-bot-instance-001'
const API_URL = 'http://api:3000'
const WEBHOOK_URL = `${API_URL}/api/flow/webhook`
const GUILD_ID = '987654321098765432'
const CHANNEL_ID = '123456789012345678'
const USER_ID = '111222333444555666'
const MESSAGE_ID = '444555666777888999'

// ---------------------------------------------------------------------------
// Builder helpers — realistic discord.js-shaped stubs
// ---------------------------------------------------------------------------

function makeMessage(opts: {
  authorBot?: boolean
  guildId?: string | null
  content?: string
  attachmentCount?: number
  userId?: string
  username?: string
} = {}): Message {
  const {
    authorBot = false,
    guildId = GUILD_ID,
    content = 'Hello Discord!',
    attachmentCount = 0,
    userId = USER_ID,
    username = 'testuser',
  } = opts

  return {
    id: MESSAGE_ID,
    content,
    author: { id: userId, username, bot: authorBot },
    channel: { id: CHANNEL_ID },
    guild: guildId !== null ? { id: guildId } : null,
    attachments: { size: attachmentCount },
  } as unknown as Message
}

function makeMember(opts: {
  bot?: boolean
  guildId?: string
  userId?: string
  username?: string
  displayName?: string
  createdAt?: Date
} = {}): GuildMember | PartialGuildMember {
  const {
    bot = false,
    guildId = GUILD_ID,
    userId = USER_ID,
    username = 'membertestuser',
    displayName = 'Member Test User',
    createdAt = new Date('2021-06-15T12:00:00Z'),
  } = opts

  return {
    user: { id: userId, username, bot, createdAt },
    guild: { id: guildId },
    displayName,
  } as unknown as GuildMember
}

function makeInteraction(
  type: 'slash_command' | 'button' | 'modal_submit' | 'select_menu' | 'context_menu' | 'unknown',
  opts: Record<string, unknown> = {},
): unknown {
  const base = {
    id: 'interaction-pipeline-001',
    user: { id: USER_ID, username: 'interactor' },
    guild: { id: GUILD_ID },
    channel: { id: CHANNEL_ID },
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    isStringSelectMenu: () => false,
    isUserContextMenuCommand: () => false,
    isMessageContextMenuCommand: () => false,
    ...opts,
  }

  if (type === 'slash_command') {
    return {
      ...base,
      isChatInputCommand: () => true,
      commandName: 'kick',
      options: {
        data: [
          { name: 'user', value: '123456789', type: 6 },
          { name: 'reason', value: 'spamming', type: 3 },
        ],
      },
    }
  }
  if (type === 'button') {
    return {
      ...base,
      isButton: () => true,
      customId: 'confirm_kick_123456789',
    }
  }
  if (type === 'modal_submit') {
    return {
      ...base,
      isModalSubmit: () => true,
      customId: 'user_report_modal',
      fields: {
        fields: [
          { customId: 'reason_field', value: 'rule violation' },
          { customId: 'evidence_field', value: 'https://example.com/screenshot' },
        ],
      },
    }
  }
  if (type === 'select_menu') {
    return {
      ...base,
      isStringSelectMenu: () => true,
      customId: 'role_select',
      values: ['gamer', 'developer'],
    }
  }
  if (type === 'context_menu') {
    return {
      ...base,
      isMessageContextMenuCommand: () => true,
      commandName: 'Report Message',
      targetId: MESSAGE_ID,
    }
  }
  return { ...base }
}

function makeReaction(opts: { bot?: boolean; guildId?: string | null; emoji?: string; emojiId?: string | null } = {}) {
  const {
    bot = false,
    guildId = GUILD_ID,
    emoji = '🎉',
    emojiId = null,
  } = opts

  return {
    message: {
      id: MESSAGE_ID,
      guild: guildId !== null ? { id: guildId } : null,
      channel: { id: CHANNEL_ID },
    },
    emoji: { name: emoji, id: emojiId },
  }
}

function makeUser(opts: { bot?: boolean; userId?: string } = {}) {
  return {
    id: opts.userId ?? USER_ID,
    bot: opts.bot ?? false,
  }
}

function makeVoiceState(opts: {
  bot?: boolean
  guildId?: string
  userId?: string
  username?: string
  channelId?: string | null
  selfMute?: boolean
  selfDeaf?: boolean
  serverMute?: boolean
  serverDeaf?: boolean
  streaming?: boolean
} = {}): VoiceState {
  const {
    bot = false,
    guildId = GUILD_ID,
    userId = USER_ID,
    username = 'voiceuser',
    channelId = CHANNEL_ID,
    selfMute = false,
    selfDeaf = false,
    serverMute = false,
    serverDeaf = false,
    streaming = false,
  } = opts

  return {
    guild: { id: guildId },
    channelId,
    member: { user: { id: userId, username, bot } },
    selfMute,
    selfDeaf,
    serverMute,
    serverDeaf,
    streaming,
  } as unknown as VoiceState
}

// ---------------------------------------------------------------------------
// Helper: capture events POSTed by the forwarder
// ---------------------------------------------------------------------------

function makeMockFetch() {
  return vi.fn().mockResolvedValue({ ok: true })
}

function capturedEvents(mockFetch: ReturnType<typeof makeMockFetch>): unknown[] {
  return mockFetch.mock.calls.map((call) => {
    const [, init] = call as [string, RequestInit]
    return JSON.parse(init.body as string)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Discord event pipeline', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // -------------------------------------------------------------------------
  // mapMessageEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapMessageEvent → EventForwarder', () => {
    it('posts a correct FlowTriggerEvent for a guild message', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const message = makeMessage({ content: 'Hey everyone!' })
      const event = mapMessageEvent(message, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch).toHaveBeenCalledWith(WEBHOOK_URL, expect.objectContaining({ method: 'POST' }))

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('discord')
      expect(posted.eventType).toBe('message_received')
      expect(posted.communityId).toBe(GUILD_ID)
      expect(posted.accountId).toBe(USER_ID)
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()
      expect(typeof posted.timestamp).toBe('string')

      const data = posted.data as Record<string, unknown>
      expect(data.messageId).toBe(MESSAGE_ID)
      expect(data.channelId).toBe(CHANNEL_ID)
      expect(data.guildId).toBe(GUILD_ID)
      expect(data.content).toBe('Hey everyone!')
      expect(data.authorId).toBe(USER_ID)
      expect(data.authorUsername).toBe('testuser')
      expect(data.hasAttachments).toBe(false)
      expect(data.attachmentCount).toBe(0)
    })

    it('reports hasAttachments=true and correct count when message has attachments', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const message = makeMessage({ attachmentCount: 2 })
      const event = mapMessageEvent(message, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.hasAttachments).toBe(true)
      expect(data.attachmentCount).toBe(2)
    })

    it('does not post for bot messages', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const message = makeMessage({ authorBot: true })
      const event = mapMessageEvent(message, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('does not post for DM messages (no guild)', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const message = makeMessage({ guildId: null })
      const event = mapMessageEvent(message, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('includes both authorId and authorUsername in data', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const message = makeMessage({ userId: '999888777', username: 'poweruser' })
      const event = mapMessageEvent(message, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.authorId).toBe('999888777')
      expect(data.authorUsername).toBe('poweruser')
    })
  })

  // -------------------------------------------------------------------------
  // mapMemberJoinEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapMemberJoinEvent → EventForwarder', () => {
    it('posts a correct member_join FlowTriggerEvent', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const member = makeMember({
        userId: '123456780',
        username: 'newjoinee',
        displayName: 'New Joinee',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      })
      const event = mapMemberJoinEvent(member, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('discord')
      expect(posted.eventType).toBe('member_join')
      expect(posted.communityId).toBe(GUILD_ID)
      expect(posted.accountId).toBe('123456780')
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()

      const data = posted.data as Record<string, unknown>
      expect(data.guildId).toBe(GUILD_ID)
      expect(data.userId).toBe('123456780')
      expect(data.username).toBe('newjoinee')
      expect(data.displayName).toBe('New Joinee')
      expect(data.accountCreatedAt).toBe('2023-01-01T00:00:00.000Z')
    })

    it('does not post for bot members joining', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const member = makeMember({ bot: true })
      const event = mapMemberJoinEvent(member, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // mapMemberLeaveEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapMemberLeaveEvent → EventForwarder', () => {
    it('posts a correct member_leave FlowTriggerEvent', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const member = makeMember({
        userId: '555666777',
        username: 'departinguser',
        displayName: 'Departing User',
      })
      const event = mapMemberLeaveEvent(member, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('discord')
      expect(posted.eventType).toBe('member_leave')
      expect(posted.communityId).toBe(GUILD_ID)
      expect(posted.accountId).toBe('555666777')
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)

      const data = posted.data as Record<string, unknown>
      expect(data.guildId).toBe(GUILD_ID)
      expect(data.userId).toBe('555666777')
      expect(data.username).toBe('departinguser')
      expect(data.displayName).toBe('Departing User')
    })

    it('does not post for bot members leaving', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const member = makeMember({ bot: true })
      const event = mapMemberLeaveEvent(member, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // mapInteractionEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapInteractionEvent → EventForwarder', () => {
    it('posts a correct FlowTriggerEvent for a slash command', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const interaction = makeInteraction('slash_command')
      const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('discord')
      expect(posted.eventType).toBe('interaction')
      expect(posted.communityId).toBe(GUILD_ID)
      expect(posted.accountId).toBe(USER_ID)
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()

      const data = posted.data as Record<string, unknown>
      expect(data.interactionType).toBe('slash_command')
      expect(data.interactionId).toBe('interaction-pipeline-001')
      expect(data.userId).toBe(USER_ID)
      expect(data.username).toBe('interactor')
      expect(data.commandName).toBe('kick')
      expect(data.guildId).toBe(GUILD_ID)

      const options = data.options as Array<{ name: string; value: unknown; type: number }>
      expect(options).toHaveLength(2)
      expect(options[0]).toMatchObject({ name: 'user', value: '123456789', type: 6 })
      expect(options[1]).toMatchObject({ name: 'reason', value: 'spamming', type: 3 })
    })

    it('posts interactionType=button for a button interaction', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const interaction = makeInteraction('button')
      const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.interactionType).toBe('button')
      expect(data.customId).toBe('confirm_kick_123456789')
    })

    it('posts interactionType=modal_submit with fields for a modal', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const interaction = makeInteraction('modal_submit')
      const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.interactionType).toBe('modal_submit')
      expect(data.customId).toBe('user_report_modal')

      const fields = data.fields as Array<{ customId: string; value: string }>
      expect(fields).toHaveLength(2)
      expect(fields[0]).toMatchObject({ customId: 'reason_field', value: 'rule violation' })
      expect(fields[1]).toMatchObject({ customId: 'evidence_field', value: 'https://example.com/screenshot' })
    })

    it('posts interactionType=select_menu with values for a select menu', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const interaction = makeInteraction('select_menu')
      const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.interactionType).toBe('select_menu')
      expect(data.customId).toBe('role_select')
      expect(data.values).toEqual(['gamer', 'developer'])
    })

    it('posts interactionType=context_menu for context menu commands', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const interaction = makeInteraction('context_menu')
      const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.interactionType).toBe('context_menu')
      expect(data.commandName).toBe('Report Message')
      expect(data.targetId).toBe(MESSAGE_ID)
    })

    it('posts interactionType=unknown for unrecognized interaction types', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const interaction = makeInteraction('unknown')
      const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect((posted.data as Record<string, unknown>).interactionType).toBe('unknown')
    })
  })

  // -------------------------------------------------------------------------
  // mapReactionAddEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapReactionAddEvent → EventForwarder', () => {
    it('posts a correct reaction_add FlowTriggerEvent', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const reaction = makeReaction({ emoji: '👍' })
      const user = makeUser()
      const event = mapReactionAddEvent(reaction as any, user as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('discord')
      expect(posted.eventType).toBe('reaction_add')
      expect(posted.communityId).toBe(GUILD_ID)
      expect(posted.accountId).toBe(USER_ID)
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()

      const data = posted.data as Record<string, unknown>
      expect(data.guildId).toBe(GUILD_ID)
      expect(data.channelId).toBe(CHANNEL_ID)
      expect(data.messageId).toBe(MESSAGE_ID)
      expect(data.userId).toBe(USER_ID)
      expect(data.emoji).toBe('👍')
    })

    it('does not post for bot users reacting', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const reaction = makeReaction()
      const user = makeUser({ bot: true })
      const event = mapReactionAddEvent(reaction as any, user as any, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('handles custom emoji reactions (has emojiId)', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const reaction = makeReaction({ emoji: 'custom_emoji', emojiId: '888999000111222333' })
      const user = makeUser()
      const event = mapReactionAddEvent(reaction as any, user as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.emoji).toBe('custom_emoji')
      expect(data.emojiId).toBe('888999000111222333')
    })
  })

  // -------------------------------------------------------------------------
  // mapReactionRemoveEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapReactionRemoveEvent → EventForwarder', () => {
    it('posts a correct reaction_remove FlowTriggerEvent', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const reaction = makeReaction({ emoji: '❌' })
      const user = makeUser()
      const event = mapReactionRemoveEvent(reaction as any, user as any, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('discord')
      expect(posted.eventType).toBe('reaction_remove')
      expect(posted.communityId).toBe(GUILD_ID)
      expect(posted.accountId).toBe(USER_ID)

      const data = posted.data as Record<string, unknown>
      expect(data.emoji).toBe('❌')
      expect(data.messageId).toBe(MESSAGE_ID)
    })

    it('does not post for bot users removing reactions', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const event = mapReactionRemoveEvent(makeReaction() as any, makeUser({ bot: true }) as any, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // mapVoiceStateEvent → EventForwarder
  // -------------------------------------------------------------------------

  describe('mapVoiceStateEvent → EventForwarder', () => {
    it('posts a correct voice_state_update FlowTriggerEvent for joining a channel', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const oldState = makeVoiceState({ channelId: null })
      const newState = makeVoiceState({ channelId: CHANNEL_ID, username: 'voicejoiner' })
      const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      expect(posted.platform).toBe('discord')
      expect(posted.eventType).toBe('voice_state_update')
      expect(posted.communityId).toBe(GUILD_ID)
      expect(posted.accountId).toBe(USER_ID)
      expect(posted.botInstanceId).toBe(BOT_INSTANCE)
      expect(posted.timestamp).toBeDefined()

      const data = posted.data as Record<string, unknown>
      expect(data.guildId).toBe(GUILD_ID)
      expect(data.userId).toBe(USER_ID)
      expect(data.action).toBe('joined')
      expect(data.newChannelId).toBe(CHANNEL_ID)
      expect(data.oldChannelId).toBeUndefined()
      expect(data.selfMute).toBe(false)
      expect(data.selfDeaf).toBe(false)
      expect(data.streaming).toBe(false)
    })

    it('posts action=left when user leaves a voice channel', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const oldState = makeVoiceState({ channelId: CHANNEL_ID })
      const newState = makeVoiceState({ channelId: null })
      const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.action).toBe('left')
      expect(data.oldChannelId).toBe(CHANNEL_ID)
      expect(data.newChannelId).toBeUndefined()
    })

    it('posts action=moved when user switches voice channels', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const OLD_CHANNEL = '111000111000111000'
      const NEW_CHANNEL = '222000222000222000'
      const oldState = makeVoiceState({ channelId: OLD_CHANNEL })
      const newState = makeVoiceState({ channelId: NEW_CHANNEL })
      const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.action).toBe('moved')
      expect(data.oldChannelId).toBe(OLD_CHANNEL)
      expect(data.newChannelId).toBe(NEW_CHANNEL)
    })

    it('posts action=updated for in-channel state changes (mute, deaf, stream)', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const oldState = makeVoiceState({ channelId: CHANNEL_ID, selfMute: false, streaming: false })
      const newState = makeVoiceState({ channelId: CHANNEL_ID, selfMute: true, streaming: true })
      const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [posted] = capturedEvents(mockFetch) as [Record<string, unknown>]
      const data = posted.data as Record<string, unknown>
      expect(data.action).toBe('updated')
      expect(data.selfMute).toBe(true)
      expect(data.streaming).toBe(true)
    })

    it('does not post for bot voice state changes', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const oldState = makeVoiceState({ bot: true, channelId: null })
      const newState = makeVoiceState({ bot: true, channelId: CHANNEL_ID })
      const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

      expect(event).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // HTTP transport
  // -------------------------------------------------------------------------

  describe('HTTP transport', () => {
    it('POSTs to the correct webhook URL with JSON content-type', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const event = mapMessageEvent(makeMessage(), BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(WEBHOOK_URL)
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    })

    it('sends valid parseable JSON', async () => {
      const mockFetch = makeMockFetch()
      globalThis.fetch = mockFetch

      const forwarder = new EventForwarder({ apiUrl: API_URL, logger: mockLogger })
      const event = mapMessageEvent(makeMessage(), BOT_INSTANCE)

      expect(event).not.toBeNull()
      await forwarder.send(event!)

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(() => JSON.parse(init.body as string)).not.toThrow()
    })
  })
})
