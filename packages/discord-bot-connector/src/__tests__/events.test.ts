import { describe, it, expect } from 'vitest'
import {
  mapMessageEvent,
  mapMemberJoinEvent,
  mapMemberLeaveEvent,
  mapInteractionEvent,
  mapReactionAddEvent,
  mapReactionRemoveEvent,
  mapVoiceStateEvent,
} from '../events/mapper.js'
import type { Message, GuildMember, PartialGuildMember, VoiceState } from 'discord.js'

const BOT_INSTANCE = 'discord-bot-test'
const GUILD_ID = '987654321'
const CHANNEL_ID = '123456789'
const USER_ID = '111222333'
const MESSAGE_ID = '444555666'

// ---------------------------------------------------------------------------
// Builder helpers — build minimal stubs matching discord.js types
// ---------------------------------------------------------------------------

function makeMessage(opts: {
  authorBot?: boolean
  guildId?: string | null
  content?: string
  attachmentCount?: number
} = {}): Message {
  const {
    authorBot = false,
    guildId = GUILD_ID,
    content = 'hello',
    attachmentCount = 0,
  } = opts

  return {
    id: MESSAGE_ID,
    content,
    author: { id: USER_ID, username: 'testuser', bot: authorBot },
    channel: { id: CHANNEL_ID },
    guild: guildId ? { id: guildId } : null,
    attachments: { size: attachmentCount },
  } as unknown as Message
}

function makeMember(opts: {
  bot?: boolean
  guildId?: string
  userId?: string
  username?: string
  displayName?: string
} = {}): GuildMember | PartialGuildMember {
  const {
    bot = false,
    guildId = GUILD_ID,
    userId = USER_ID,
    username = 'memberuser',
    displayName = 'Member User',
  } = opts

  return {
    user: {
      id: userId,
      username,
      bot,
      createdAt: new Date('2020-01-01'),
    },
    guild: { id: guildId },
    displayName,
  } as unknown as GuildMember
}

function makeInteraction(type: string, opts: Record<string, unknown> = {}): object {
  const base = {
    id: 'interaction-001',
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
      commandName: 'ping',
      options: { data: [{ name: 'target', value: 'world', type: 3 }] },
    }
  }
  if (type === 'button') {
    return {
      ...base,
      isButton: () => true,
      customId: 'confirm_action',
    }
  }
  if (type === 'modal_submit') {
    return {
      ...base,
      isModalSubmit: () => true,
      customId: 'my_modal',
      fields: {
        fields: [{ customId: 'input1', value: 'test value' }],
      },
    }
  }
  if (type === 'select_menu') {
    return {
      ...base,
      isStringSelectMenu: () => true,
      customId: 'color_select',
      values: ['red', 'blue'],
    }
  }
  return { ...base }
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
// mapMessageEvent
// ---------------------------------------------------------------------------

describe('mapMessageEvent', () => {
  it('maps a guild message to FlowTriggerEvent', () => {
    const event = mapMessageEvent(makeMessage(), BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.platform).toBe('discord')
    expect(event!.eventType).toBe('message_received')
    expect(event!.communityId).toBe(GUILD_ID)
    expect(event!.accountId).toBe(USER_ID)
    expect(event!.botInstanceId).toBe(BOT_INSTANCE)
    expect(event!.data!['content']).toBe('hello')
    expect(event!.data!['guildId']).toBe(GUILD_ID)
  })

  it('returns null for bot messages', () => {
    const event = mapMessageEvent(makeMessage({ authorBot: true }), BOT_INSTANCE)
    expect(event).toBeNull()
  })

  it('returns null for DM messages (no guild)', () => {
    const event = mapMessageEvent(makeMessage({ guildId: null }), BOT_INSTANCE)
    expect(event).toBeNull()
  })

  it('reports attachment count', () => {
    const event = mapMessageEvent(makeMessage({ attachmentCount: 3 }), BOT_INSTANCE)
    expect(event).not.toBeNull()
    expect(event!.data!['hasAttachments']).toBe(true)
    expect(event!.data!['attachmentCount']).toBe(3)
  })

  it('includes messageId and channelId in data', () => {
    const event = mapMessageEvent(makeMessage(), BOT_INSTANCE)
    expect(event!.data!['messageId']).toBe(MESSAGE_ID)
    expect(event!.data!['channelId']).toBe(CHANNEL_ID)
  })
})

// ---------------------------------------------------------------------------
// mapMemberJoinEvent
// ---------------------------------------------------------------------------

describe('mapMemberJoinEvent', () => {
  it('maps a member join to FlowTriggerEvent', () => {
    const event = mapMemberJoinEvent(makeMember(), BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.platform).toBe('discord')
    expect(event!.eventType).toBe('member_join')
    expect(event!.communityId).toBe(GUILD_ID)
    expect(event!.accountId).toBe(USER_ID)
    expect(event!.botInstanceId).toBe(BOT_INSTANCE)
    expect(event!.data!['username']).toBe('memberuser')
  })

  it('returns null for bot members', () => {
    const event = mapMemberJoinEvent(makeMember({ bot: true }), BOT_INSTANCE)
    expect(event).toBeNull()
  })

  it('includes displayName and accountCreatedAt', () => {
    const event = mapMemberJoinEvent(makeMember({ displayName: 'Cool User' }), BOT_INSTANCE)
    expect(event!.data!['displayName']).toBe('Cool User')
    expect(typeof event!.data!['accountCreatedAt']).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// mapMemberLeaveEvent
// ---------------------------------------------------------------------------

describe('mapMemberLeaveEvent', () => {
  it('maps a member leave to FlowTriggerEvent', () => {
    const event = mapMemberLeaveEvent(makeMember(), BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.platform).toBe('discord')
    expect(event!.eventType).toBe('member_leave')
    expect(event!.communityId).toBe(GUILD_ID)
    expect(event!.accountId).toBe(USER_ID)
  })

  it('returns null for bot members', () => {
    const event = mapMemberLeaveEvent(makeMember({ bot: true }), BOT_INSTANCE)
    expect(event).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapInteractionEvent
// ---------------------------------------------------------------------------

describe('mapInteractionEvent', () => {
  it('maps slash command interaction', () => {
    const interaction = makeInteraction('slash_command')
    const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.platform).toBe('discord')
    expect(event!.eventType).toBe('interaction')
    expect(event!.communityId).toBe(GUILD_ID)
    expect(event!.accountId).toBe(USER_ID)
    expect(event!.data!['interactionType']).toBe('slash_command')
    expect(event!.data!['commandName']).toBe('ping')
  })

  it('maps button interaction', () => {
    const interaction = makeInteraction('button')
    const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!['interactionType']).toBe('button')
    expect(event!.data!['customId']).toBe('confirm_action')
  })

  it('maps modal submit interaction', () => {
    const interaction = makeInteraction('modal_submit')
    const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!['interactionType']).toBe('modal_submit')
    expect(event!.data!['customId']).toBe('my_modal')
    const fields = event!.data!['fields'] as Array<{ customId: string, value: string }>
    expect(fields).toHaveLength(1)
    expect(fields[0]?.customId).toBe('input1')
  })

  it('maps select menu interaction', () => {
    const interaction = makeInteraction('select_menu')
    const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!['interactionType']).toBe('select_menu')
    expect(event!.data!['values']).toEqual(['red', 'blue'])
  })

  it('maps unknown interaction type', () => {
    const interaction = makeInteraction('unknown')
    const event = mapInteractionEvent(interaction as any, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!['interactionType']).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// mapReactionAddEvent / mapReactionRemoveEvent
// ---------------------------------------------------------------------------

function makeReaction(opts: { bot?: boolean, guildId?: string | null } = {}) {
  return {
    message: {
      id: MESSAGE_ID,
      guild: opts.guildId !== null ? { id: opts.guildId ?? GUILD_ID } : null,
      channel: { id: CHANNEL_ID },
    },
    emoji: { name: '👍', id: null },
  }
}

function makeUser(opts: { bot?: boolean } = {}) {
  return {
    id: USER_ID,
    bot: opts.bot ?? false,
  }
}

describe('mapReactionAddEvent', () => {
  it('maps reaction add to FlowTriggerEvent', () => {
    const event = mapReactionAddEvent(makeReaction() as any, makeUser() as any, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.platform).toBe('discord')
    expect(event!.eventType).toBe('reaction_add')
    expect(event!.communityId).toBe(GUILD_ID)
    expect(event!.accountId).toBe(USER_ID)
    expect(event!.data!['emoji']).toBe('👍')
  })

  it('returns null for bot users', () => {
    const event = mapReactionAddEvent(makeReaction() as any, makeUser({ bot: true }) as any, BOT_INSTANCE)
    expect(event).toBeNull()
  })
})

describe('mapReactionRemoveEvent', () => {
  it('maps reaction remove to FlowTriggerEvent', () => {
    const event = mapReactionRemoveEvent(makeReaction() as any, makeUser() as any, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.eventType).toBe('reaction_remove')
    expect(event!.data!['emoji']).toBe('👍')
  })
})

// ---------------------------------------------------------------------------
// mapVoiceStateEvent
// ---------------------------------------------------------------------------

describe('mapVoiceStateEvent', () => {
  it('maps voice join (no old channel, new channel)', () => {
    const oldState = makeVoiceState({ channelId: null })
    const newState = makeVoiceState({ channelId: CHANNEL_ID })
    const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.platform).toBe('discord')
    expect(event!.eventType).toBe('voice_state_update')
    expect(event!.communityId).toBe(GUILD_ID)
    expect(event!.data!['action']).toBe('joined')
    expect(event!.data!['newChannelId']).toBe(CHANNEL_ID)
  })

  it('maps voice leave (old channel, no new channel)', () => {
    const oldState = makeVoiceState({ channelId: CHANNEL_ID })
    const newState = makeVoiceState({ channelId: null })
    const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!['action']).toBe('left')
    expect(event!.data!['oldChannelId']).toBe(CHANNEL_ID)
  })

  it('maps voice move (different channels)', () => {
    const oldState = makeVoiceState({ channelId: '111' })
    const newState = makeVoiceState({ channelId: '222' })
    const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!['action']).toBe('moved')
  })

  it('maps voice update (same channel, state change)', () => {
    const oldState = makeVoiceState({ channelId: CHANNEL_ID, selfMute: false })
    const newState = makeVoiceState({ channelId: CHANNEL_ID, selfMute: true })
    const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)

    expect(event).not.toBeNull()
    expect(event!.data!['action']).toBe('updated')
    expect(event!.data!['selfMute']).toBe(true)
  })

  it('returns null for bot users', () => {
    const oldState = makeVoiceState({ bot: true, channelId: null })
    const newState = makeVoiceState({ bot: true, channelId: CHANNEL_ID })
    const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)
    expect(event).toBeNull()
  })

  it('returns null when no userId found', () => {
    const oldState = { guild: { id: GUILD_ID }, channelId: null, member: null, selfMute: false, selfDeaf: false, serverMute: false, serverDeaf: false, streaming: false } as unknown as VoiceState
    const newState = { guild: { id: GUILD_ID }, channelId: CHANNEL_ID, member: null, selfMute: false, selfDeaf: false, serverMute: false, serverDeaf: false, streaming: false } as unknown as VoiceState
    const event = mapVoiceStateEvent(oldState, newState, BOT_INSTANCE)
    expect(event).toBeNull()
  })
})
