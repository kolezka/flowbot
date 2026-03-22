import { describe, it, expect, beforeEach } from 'vitest'
import { ActionRegistry } from '@flowbot/platform-kit'
import { FakeDiscordClient } from '../sdk/fake-client.js'
import { registerMessagingActions } from '../actions/messaging.js'
import { registerAdminActions } from '../actions/admin.js'
import { registerChannelActions } from '../actions/channel.js'
import { registerGroupsActions } from '../actions/groups.js'

const CHANNEL_ID = '123456789'
const GUILD_ID = '987654321'
const USER_ID = '111222333'
const MESSAGE_ID = '444555666'
const ROLE_ID = '777888999'

describe('messaging actions', () => {
  let transport: FakeDiscordClient
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeDiscordClient()
    registry = new ActionRegistry()
    registerMessagingActions(registry, transport)
  })

  it('discord_send_message executes via registry', async () => {
    const result = await registry.execute('discord_send_message', {
      channelId: CHANNEL_ID,
      content: 'hello',
    })
    expect(result.success).toBe(true)
    expect(transport.getSentMessages()).toHaveLength(1)
    expect(transport.getSentMessages()[0]?.content).toBe('hello')
  })

  it('discord_send_message fails with missing content', async () => {
    const result = await registry.execute('discord_send_message', { channelId: CHANNEL_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('discord_send_message with options executes via registry', async () => {
    const result = await registry.execute('discord_send_message', {
      channelId: CHANNEL_ID,
      content: 'hello',
      replyToMessageId: MESSAGE_ID,
      tts: false,
    })
    expect(result.success).toBe(true)
  })

  it('discord_send_embed executes via registry', async () => {
    const result = await registry.execute('discord_send_embed', {
      channelId: CHANNEL_ID,
      embed: { title: 'Test', description: 'A test embed' },
    })
    expect(result.success).toBe(true)
    expect(transport.getSentEmbeds()).toHaveLength(1)
    expect(transport.getSentEmbeds()[0]?.embed.title).toBe('Test')
  })

  it('discord_send_embed fails with missing embed', async () => {
    const result = await registry.execute('discord_send_embed', { channelId: CHANNEL_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('discord_send_dm executes via registry', async () => {
    const result = await registry.execute('discord_send_dm', {
      userId: USER_ID,
      content: 'hey',
    })
    expect(result.success).toBe(true)
    expect(transport.getSentDMs()).toHaveLength(1)
    expect(transport.getSentDMs()[0]?.userId).toBe(USER_ID)
  })

  it('discord_send_dm fails with missing content', async () => {
    const result = await registry.execute('discord_send_dm', { userId: USER_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('discord_edit_message executes via registry', async () => {
    const result = await registry.execute('discord_edit_message', {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      content: 'edited',
    })
    expect(result.success).toBe(true)
    expect(transport.getEditedMessages()).toHaveLength(1)
    expect(transport.getEditedMessages()[0]?.content).toBe('edited')
  })

  it('discord_edit_message fails with missing messageId', async () => {
    const result = await registry.execute('discord_edit_message', {
      channelId: CHANNEL_ID,
      content: 'edited',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('discord_delete_message executes via registry', async () => {
    const result = await registry.execute('discord_delete_message', {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getDeletedMessages()).toHaveLength(1)
    expect(transport.getDeletedMessages()[0]?.channelId).toBe(CHANNEL_ID)
    expect(transport.getDeletedMessages()[0]?.messageId).toBe(MESSAGE_ID)
  })

  it('discord_pin_message executes via registry', async () => {
    const result = await registry.execute('discord_pin_message', {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getPinnedMessages()).toHaveLength(1)
  })

  it('discord_unpin_message executes via registry', async () => {
    const result = await registry.execute('discord_unpin_message', {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getUnpinnedMessages()).toHaveLength(1)
  })

  it('discord_add_reaction executes via registry', async () => {
    const result = await registry.execute('discord_add_reaction', {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      emoji: '👍',
    })
    expect(result.success).toBe(true)
    expect(transport.getAddedReactions()).toHaveLength(1)
    expect(transport.getAddedReactions()[0]?.emoji).toBe('👍')
  })

  it('discord_remove_reaction executes via registry', async () => {
    const result = await registry.execute('discord_remove_reaction', {
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      emoji: '👍',
    })
    expect(result.success).toBe(true)
    expect(transport.getRemovedReactions()).toHaveLength(1)
  })

  it('discord_send_thread_message executes via registry', async () => {
    const result = await registry.execute('discord_send_thread_message', {
      threadId: CHANNEL_ID,
      content: 'thread reply',
    })
    expect(result.success).toBe(true)
    expect(transport.getSentThreadMessages()).toHaveLength(1)
    expect(transport.getSentThreadMessages()[0]?.content).toBe('thread reply')
  })

  it('returns error for unregistered action', async () => {
    const result = await registry.execute('nonexistent_action', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('not registered')
  })
})

describe('admin actions', () => {
  let transport: FakeDiscordClient
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeDiscordClient()
    registry = new ActionRegistry()
    registerAdminActions(registry, transport)
  })

  it('discord_ban_member executes via registry', async () => {
    const result = await registry.execute('discord_ban_member', {
      guildId: GUILD_ID,
      userId: USER_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getBannedMembers()).toHaveLength(1)
    expect(transport.getBannedMembers()[0]?.guildId).toBe(GUILD_ID)
    expect(transport.getBannedMembers()[0]?.userId).toBe(USER_ID)
  })

  it('discord_ban_member with reason and deleteMessageDays', async () => {
    const result = await registry.execute('discord_ban_member', {
      guildId: GUILD_ID,
      userId: USER_ID,
      reason: 'spam',
      deleteMessageDays: 7,
    })
    expect(result.success).toBe(true)
    expect(transport.getBannedMembers()[0]?.reason).toBe('spam')
    expect(transport.getBannedMembers()[0]?.deleteMessageDays).toBe(7)
  })

  it('discord_ban_member fails with missing userId', async () => {
    const result = await registry.execute('discord_ban_member', { guildId: GUILD_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('discord_kick_member executes via registry', async () => {
    const result = await registry.execute('discord_kick_member', {
      guildId: GUILD_ID,
      userId: USER_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getKickedMembers()).toHaveLength(1)
  })

  it('discord_timeout_member executes via registry', async () => {
    const result = await registry.execute('discord_timeout_member', {
      guildId: GUILD_ID,
      userId: USER_ID,
      durationMs: 60000,
    })
    expect(result.success).toBe(true)
    expect(transport.getTimedOutMembers()).toHaveLength(1)
    expect(transport.getTimedOutMembers()[0]?.durationMs).toBe(60000)
  })

  it('discord_timeout_member fails with missing durationMs', async () => {
    const result = await registry.execute('discord_timeout_member', {
      guildId: GUILD_ID,
      userId: USER_ID,
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('discord_add_role executes via registry', async () => {
    const result = await registry.execute('discord_add_role', {
      guildId: GUILD_ID,
      userId: USER_ID,
      roleId: ROLE_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getAddedRoles()).toHaveLength(1)
    expect(transport.getAddedRoles()[0]?.roleId).toBe(ROLE_ID)
  })

  it('discord_remove_role executes via registry', async () => {
    const result = await registry.execute('discord_remove_role', {
      guildId: GUILD_ID,
      userId: USER_ID,
      roleId: ROLE_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getRemovedRoles()).toHaveLength(1)
  })

  it('discord_set_nickname executes via registry', async () => {
    const result = await registry.execute('discord_set_nickname', {
      guildId: GUILD_ID,
      userId: USER_ID,
      nickname: 'CoolUser',
    })
    expect(result.success).toBe(true)
    expect(transport.getNicknameChanges()).toHaveLength(1)
    expect(transport.getNicknameChanges()[0]?.nickname).toBe('CoolUser')
  })

  it('discord_set_nickname fails with missing nickname', async () => {
    const result = await registry.execute('discord_set_nickname', {
      guildId: GUILD_ID,
      userId: USER_ID,
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })
})

describe('channel actions', () => {
  let transport: FakeDiscordClient
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeDiscordClient()
    registry = new ActionRegistry()
    registerChannelActions(registry, transport)
  })

  it('discord_create_channel executes via registry', async () => {
    const result = await registry.execute('discord_create_channel', {
      guildId: GUILD_ID,
      name: 'general',
      type: 'text',
    })
    expect(result.success).toBe(true)
    expect(transport.getCreatedChannels()).toHaveLength(1)
    expect(transport.getCreatedChannels()[0]?.name).toBe('general')
    expect(transport.getCreatedChannels()[0]?.type).toBe('text')
  })

  it('discord_create_channel defaults to text type', async () => {
    const result = await registry.execute('discord_create_channel', {
      guildId: GUILD_ID,
      name: 'announcements',
    })
    expect(result.success).toBe(true)
    expect(transport.getCreatedChannels()[0]?.type).toBe('text')
  })

  it('discord_create_channel fails with missing name', async () => {
    const result = await registry.execute('discord_create_channel', { guildId: GUILD_ID })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })

  it('discord_delete_channel executes via registry', async () => {
    const result = await registry.execute('discord_delete_channel', {
      channelId: CHANNEL_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getDeletedChannels()).toHaveLength(1)
    expect(transport.getDeletedChannels()[0]).toBe(CHANNEL_ID)
  })

  it('discord_create_thread executes via registry', async () => {
    const result = await registry.execute('discord_create_thread', {
      channelId: CHANNEL_ID,
      name: 'my-thread',
    })
    expect(result.success).toBe(true)
    expect(transport.getCreatedThreads()).toHaveLength(1)
    expect(transport.getCreatedThreads()[0]?.name).toBe('my-thread')
  })

  it('discord_create_role executes via registry', async () => {
    const result = await registry.execute('discord_create_role', {
      guildId: GUILD_ID,
      name: 'Moderator',
    })
    expect(result.success).toBe(true)
    expect(transport.getCreatedRoles()).toHaveLength(1)
    expect(transport.getCreatedRoles()[0]?.name).toBe('Moderator')
  })

  it('discord_create_invite executes via registry', async () => {
    const result = await registry.execute('discord_create_invite', {
      channelId: CHANNEL_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getCreatedInvites()).toHaveLength(1)
    expect(transport.getCreatedInvites()[0]?.channelId).toBe(CHANNEL_ID)
  })

  it('discord_move_member executes via registry', async () => {
    const result = await registry.execute('discord_move_member', {
      guildId: GUILD_ID,
      userId: USER_ID,
      channelId: CHANNEL_ID,
    })
    expect(result.success).toBe(true)
    expect(transport.getMovedMembers()).toHaveLength(1)
  })

  it('discord_create_scheduled_event executes via registry', async () => {
    const result = await registry.execute('discord_create_scheduled_event', {
      guildId: GUILD_ID,
      name: 'Server Meetup',
      scheduledStartTime: new Date(Date.now() + 86400000).toISOString(),
      entityType: 'external',
      location: 'Online',
    })
    expect(result.success).toBe(true)
    expect(transport.getCreatedEvents()).toHaveLength(1)
    expect(transport.getCreatedEvents()[0]?.name).toBe('Server Meetup')
  })

  it('discord_create_scheduled_event fails with missing name', async () => {
    const result = await registry.execute('discord_create_scheduled_event', {
      guildId: GUILD_ID,
      scheduledStartTime: new Date().toISOString(),
      entityType: 'external',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid params')
  })
})

describe('groups actions (discord_list_groups)', () => {
  let transport: FakeDiscordClient
  let registry: ActionRegistry

  beforeEach(() => {
    transport = new FakeDiscordClient()
    registry = new ActionRegistry()
    registerGroupsActions(registry, transport)
  })

  it('discord_list_groups returns empty array when no guilds in cache', async () => {
    const result = await registry.execute('discord_list_groups', {})
    expect(result.success).toBe(true)
    const data = result.data as { groups: unknown[] }
    expect(data.groups).toEqual([])
  })

  it('discord_list_groups returns guilds from cache', async () => {
    transport.addFakeGuild({ id: GUILD_ID, name: 'My Server', memberCount: 42 })
    transport.addFakeGuild({ id: '111222333', name: 'Other Server', memberCount: 100 })
    const result = await registry.execute('discord_list_groups', {})
    expect(result.success).toBe(true)
    const data = result.data as { groups: Array<{ id: string; name: string; memberCount: number }> }
    expect(data.groups).toHaveLength(2)
    expect(data.groups[0]).toMatchObject({ id: GUILD_ID, name: 'My Server', memberCount: 42 })
    expect(data.groups[1]).toMatchObject({ id: '111222333', name: 'Other Server', memberCount: 100 })
  })
})
