import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  sendMessageSchema,
  sendEmbedSchema,
  sendDMSchema,
  editMessageSchema,
  deleteMessageSchema,
  pinMessageSchema,
  unpinMessageSchema,
  addReactionSchema,
  removeReactionSchema,
  banMemberSchema,
  kickMemberSchema,
  timeoutMemberSchema,
  addRoleSchema,
  removeRoleSchema,
  setNicknameSchema,
  createChannelSchema,
  deleteChannelSchema,
  createThreadSchema,
  sendThreadMessageSchema,
  createRoleSchema,
  createInviteSchema,
  moveMemberSchema,
  createScheduledEventSchema,
} from '../actions/schemas.js'

const CHANNEL_ID = '123456789'
const GUILD_ID = '987654321'
const USER_ID = '111222333'
const MESSAGE_ID = '444555666'

describe('sendMessageSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(sendMessageSchema, { channelId: CHANNEL_ID, content: 'hello' })
    expect(result.success).toBe(true)
  })

  it('rejects missing content', () => {
    const result = v.safeParse(sendMessageSchema, { channelId: CHANNEL_ID })
    expect(result.success).toBe(false)
  })

  it('allows optional fields', () => {
    const result = v.safeParse(sendMessageSchema, {
      channelId: CHANNEL_ID,
      content: 'hi',
      replyToMessageId: MESSAGE_ID,
      tts: true,
      suppressEmbeds: false,
    })
    expect(result.success).toBe(true)
  })
})

describe('sendEmbedSchema', () => {
  it('parses valid embed', () => {
    const result = v.safeParse(sendEmbedSchema, {
      channelId: CHANNEL_ID,
      embed: { title: 'Title', description: 'Desc' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing embed', () => {
    const result = v.safeParse(sendEmbedSchema, { channelId: CHANNEL_ID })
    expect(result.success).toBe(false)
  })
})

describe('sendDMSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(sendDMSchema, { userId: USER_ID, content: 'hey' })
    expect(result.success).toBe(true)
  })

  it('rejects missing content', () => {
    const result = v.safeParse(sendDMSchema, { userId: USER_ID })
    expect(result.success).toBe(false)
  })
})

describe('editMessageSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(editMessageSchema, {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      content: 'edited',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing messageId', () => {
    const result = v.safeParse(editMessageSchema, { channelId: CHANNEL_ID, content: 'edited' })
    expect(result.success).toBe(false)
  })
})

describe('deleteMessageSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(deleteMessageSchema, { channelId: CHANNEL_ID, messageId: MESSAGE_ID })
    expect(result.success).toBe(true)
  })
})

describe('pinMessageSchema / unpinMessageSchema', () => {
  it('pin parses valid input', () => {
    const result = v.safeParse(pinMessageSchema, { channelId: CHANNEL_ID, messageId: MESSAGE_ID })
    expect(result.success).toBe(true)
  })

  it('unpin parses valid input', () => {
    const result = v.safeParse(unpinMessageSchema, { channelId: CHANNEL_ID, messageId: MESSAGE_ID })
    expect(result.success).toBe(true)
  })
})

describe('addReactionSchema / removeReactionSchema', () => {
  it('addReaction parses valid input', () => {
    const result = v.safeParse(addReactionSchema, {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      emoji: '👍',
    })
    expect(result.success).toBe(true)
  })

  it('removeReaction parses valid input', () => {
    const result = v.safeParse(removeReactionSchema, {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      emoji: '👍',
    })
    expect(result.success).toBe(true)
  })
})

describe('banMemberSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(banMemberSchema, { guildId: GUILD_ID, userId: USER_ID })
    expect(result.success).toBe(true)
  })

  it('allows optional reason and deleteMessageDays', () => {
    const result = v.safeParse(banMemberSchema, {
      guildId: GUILD_ID,
      userId: USER_ID,
      reason: 'spam',
      deleteMessageDays: 7,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing userId', () => {
    const result = v.safeParse(banMemberSchema, { guildId: GUILD_ID })
    expect(result.success).toBe(false)
  })
})

describe('kickMemberSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(kickMemberSchema, { guildId: GUILD_ID, userId: USER_ID })
    expect(result.success).toBe(true)
  })
})

describe('timeoutMemberSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(timeoutMemberSchema, {
      guildId: GUILD_ID,
      userId: USER_ID,
      durationMs: 60000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing durationMs', () => {
    const result = v.safeParse(timeoutMemberSchema, { guildId: GUILD_ID, userId: USER_ID })
    expect(result.success).toBe(false)
  })
})

describe('addRoleSchema / removeRoleSchema', () => {
  it('addRole parses valid input', () => {
    const result = v.safeParse(addRoleSchema, {
      guildId: GUILD_ID,
      userId: USER_ID,
      roleId: '999888777',
    })
    expect(result.success).toBe(true)
  })

  it('removeRole parses valid input', () => {
    const result = v.safeParse(removeRoleSchema, {
      guildId: GUILD_ID,
      userId: USER_ID,
      roleId: '999888777',
    })
    expect(result.success).toBe(true)
  })

  it('addRole rejects missing roleId', () => {
    const result = v.safeParse(addRoleSchema, { guildId: GUILD_ID, userId: USER_ID })
    expect(result.success).toBe(false)
  })
})

describe('setNicknameSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(setNicknameSchema, {
      guildId: GUILD_ID,
      userId: USER_ID,
      nickname: 'CoolUser',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing nickname', () => {
    const result = v.safeParse(setNicknameSchema, { guildId: GUILD_ID, userId: USER_ID })
    expect(result.success).toBe(false)
  })
})

describe('createChannelSchema', () => {
  it('parses valid input with defaults', () => {
    const result = v.safeParse(createChannelSchema, { guildId: GUILD_ID, name: 'general' })
    expect(result.success).toBe(true)
  })

  it('parses valid input with explicit type', () => {
    const result = v.safeParse(createChannelSchema, {
      guildId: GUILD_ID,
      name: 'general',
      type: 'text',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid channel type', () => {
    const result = v.safeParse(createChannelSchema, {
      guildId: GUILD_ID,
      name: 'general',
      type: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('deleteChannelSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(deleteChannelSchema, { channelId: CHANNEL_ID })
    expect(result.success).toBe(true)
  })
})

describe('createThreadSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(createThreadSchema, { channelId: CHANNEL_ID, name: 'my-thread' })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = v.safeParse(createThreadSchema, { channelId: CHANNEL_ID })
    expect(result.success).toBe(false)
  })

  it('rejects invalid autoArchiveDuration', () => {
    const result = v.safeParse(createThreadSchema, {
      channelId: CHANNEL_ID,
      name: 'thread',
      autoArchiveDuration: 999,
    })
    expect(result.success).toBe(false)
  })
})

describe('sendThreadMessageSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(sendThreadMessageSchema, { threadId: CHANNEL_ID, content: 'hi' })
    expect(result.success).toBe(true)
  })
})

describe('createRoleSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(createRoleSchema, { guildId: GUILD_ID, name: 'Moderator' })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = v.safeParse(createRoleSchema, { guildId: GUILD_ID })
    expect(result.success).toBe(false)
  })
})

describe('createInviteSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(createInviteSchema, { channelId: CHANNEL_ID })
    expect(result.success).toBe(true)
  })
})

describe('moveMemberSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(moveMemberSchema, {
      guildId: GUILD_ID,
      userId: USER_ID,
      channelId: CHANNEL_ID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing channelId', () => {
    const result = v.safeParse(moveMemberSchema, { guildId: GUILD_ID, userId: USER_ID })
    expect(result.success).toBe(false)
  })
})

describe('createScheduledEventSchema', () => {
  it('parses valid input', () => {
    const result = v.safeParse(createScheduledEventSchema, {
      guildId: GUILD_ID,
      name: 'Server Event',
      scheduledStartTime: new Date().toISOString(),
      entityType: 'external',
      location: 'Online',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid entityType', () => {
    const result = v.safeParse(createScheduledEventSchema, {
      guildId: GUILD_ID,
      name: 'Event',
      scheduledStartTime: new Date().toISOString(),
      entityType: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})
