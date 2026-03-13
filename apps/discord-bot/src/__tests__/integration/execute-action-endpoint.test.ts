import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Client } from 'discord.js'
import { createServer } from '../../server/index.js'
import type { Config } from '../../config.js'

// ---------------------------------------------------------------------------
// Mock Discord.js Client
// ---------------------------------------------------------------------------

function createMockMessage(id = 'msg-1') {
  return {
    id,
    channelId: 'ch-1',
    createdTimestamp: Date.now(),
    edit: vi.fn().mockResolvedValue({ id, channelId: 'ch-1', createdTimestamp: Date.now() }),
    delete: vi.fn().mockResolvedValue(undefined),
    pin: vi.fn().mockResolvedValue(undefined),
    unpin: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    reactions: {
      resolve: vi.fn().mockReturnValue({
        users: { remove: vi.fn().mockResolvedValue(undefined) },
      }),
    },
  }
}

function createMockChannel() {
  const mockMsg = createMockMessage()
  return {
    id: 'ch-1',
    isTextBased: vi.fn().mockReturnValue(true),
    isDMBased: vi.fn().mockReturnValue(false),
    send: vi.fn().mockResolvedValue(mockMsg),
    messages: {
      fetch: vi.fn().mockResolvedValue(mockMsg),
    },
    threads: {
      create: vi.fn().mockResolvedValue({ id: 'thread-1', name: 'New Thread' }),
    },
    createInvite: vi.fn().mockResolvedValue({ code: 'abc123', url: 'https://discord.gg/abc123' }),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockMember() {
  return {
    kick: vi.fn().mockResolvedValue(undefined),
    timeout: vi.fn().mockResolvedValue(undefined),
    setNickname: vi.fn().mockResolvedValue(undefined),
    roles: {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    voice: {
      setChannel: vi.fn().mockResolvedValue(undefined),
    },
  }
}

function createMockGuild() {
  const mockMember = createMockMember()
  return {
    members: {
      ban: vi.fn().mockResolvedValue(undefined),
      kick: vi.fn().mockResolvedValue(undefined),
      fetch: vi.fn().mockResolvedValue(mockMember),
    },
    roles: {
      create: vi.fn().mockResolvedValue({ id: 'role-1', name: 'New Role' }),
    },
    channels: {
      create: vi.fn().mockResolvedValue({ id: 'new-ch-1', name: 'new-channel' }),
    },
    scheduledEvents: {
      create: vi.fn().mockResolvedValue({ id: 'event-1', name: 'New Event' }),
    },
    _mockMember: mockMember,
  }
}

function createMockUser() {
  return {
    send: vi.fn().mockResolvedValue(createMockMessage('dm-msg-1')),
  }
}

function createMockClient() {
  const mockChannel = createMockChannel()
  const mockGuild = createMockGuild()
  const mockUser = createMockUser()

  return {
    isReady: vi.fn().mockReturnValue(true),
    user: { tag: 'TestBot#1234', id: 'bot-user-id' },
    guilds: {
      cache: { size: 1 },
      fetch: vi.fn().mockResolvedValue(mockGuild),
    },
    channels: {
      fetch: vi.fn().mockResolvedValue(mockChannel),
    },
    users: {
      fetch: vi.fn().mockResolvedValue(mockUser),
    },
    _mockChannel: mockChannel,
    _mockGuild: mockGuild,
    _mockUser: mockUser,
  } as unknown as Client & {
    _mockChannel: ReturnType<typeof createMockChannel>
    _mockGuild: ReturnType<typeof createMockGuild>
    _mockUser: ReturnType<typeof createMockUser>
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const config: Config = {
  discordBotToken: 'test-token',
  discordClientId: 'test-client-id',
  databaseUrl: 'postgres://localhost/test',
  apiUrl: 'http://localhost:3000',
  port: 3003,
}

describe('POST /api/execute-action', () => {
  let client: ReturnType<typeof createMockClient>
  let app: ReturnType<typeof createServer>

  beforeEach(() => {
    vi.clearAllMocks()
    client = createMockClient()
    app = createServer(client as unknown as Client, config)
  })

  // --- Helper ---
  async function executeAction(action: string, params: Record<string, unknown> = {}) {
    const req = new Request('http://localhost/api/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
    })
    return app.fetch(req)
  }

  // --- Error cases ---

  it('returns 400 when action is missing', async () => {
    const req = new Request('http://localhost/api/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: {} }),
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('action is required')
  })

  it('returns 400 for unknown action', async () => {
    const res = await executeAction('discord_unknown_action', {})
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('Unknown action')
  })

  it('returns 500 when method throws', async () => {
    client._mockChannel.send.mockRejectedValueOnce(new Error('Discord API error'))
    const res = await executeAction('discord_send_message', { channelId: 'ch-1', content: 'Hello' })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Discord API error')
  })

  // --- Messaging actions ---

  it('discord_send_message sends a message to a channel', async () => {
    const res = await executeAction('discord_send_message', { channelId: 'ch-1', content: 'Hello' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.messageId).toBeDefined()
    expect(client._mockChannel.send).toHaveBeenCalledWith('Hello')
  })

  it('discord_send_embed sends an embed to a channel', async () => {
    const res = await executeAction('discord_send_embed', {
      channelId: 'ch-1',
      embed: { title: 'Test', description: 'A test embed' },
      content: 'Check this:',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.messageId).toBeDefined()
    expect(client._mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Check this:' }),
    )
  })

  it('discord_send_dm sends a DM to a user', async () => {
    const res = await executeAction('discord_send_dm', { userId: 'u-1', content: 'Hi there' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.messageId).toBeDefined()
    expect(client._mockUser.send).toHaveBeenCalledWith('Hi there')
  })

  it('discord_edit_message edits a message', async () => {
    const res = await executeAction('discord_edit_message', {
      channelId: 'ch-1',
      messageId: 'msg-1',
      content: 'Updated text',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.edited).toBe(true)
  })

  it('discord_delete_message deletes a message', async () => {
    const res = await executeAction('discord_delete_message', {
      channelId: 'ch-1',
      messageId: 'msg-1',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.deleted).toBe(true)
  })

  // --- Reactions ---

  it('discord_add_reaction adds a reaction', async () => {
    const res = await executeAction('discord_add_reaction', {
      channelId: 'ch-1',
      messageId: 'msg-1',
      emoji: '👍',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.reacted).toBe(true)
  })

  it('discord_remove_reaction removes a reaction', async () => {
    const res = await executeAction('discord_remove_reaction', {
      channelId: 'ch-1',
      messageId: 'msg-1',
      emoji: '👍',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.removed).toBe(true)
  })

  // --- Pin/Unpin ---

  it('discord_pin_message pins a message', async () => {
    const res = await executeAction('discord_pin_message', {
      channelId: 'ch-1',
      messageId: 'msg-1',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.pinned).toBe(true)
  })

  it('discord_unpin_message unpins a message', async () => {
    const res = await executeAction('discord_unpin_message', {
      channelId: 'ch-1',
      messageId: 'msg-1',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.unpinned).toBe(true)
  })

  // --- Member management ---

  it('discord_ban_member bans a member', async () => {
    const res = await executeAction('discord_ban_member', {
      guildId: 'g-1',
      userId: 'u-1',
      reason: 'Spam',
      deleteMessageDays: 7,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.banned).toBe(true)
    expect(client._mockGuild.members.ban).toHaveBeenCalledWith('u-1', {
      reason: 'Spam',
      deleteMessageSeconds: 604800,
    })
  })

  it('discord_kick_member kicks a member', async () => {
    const res = await executeAction('discord_kick_member', {
      guildId: 'g-1',
      userId: 'u-1',
      reason: 'Rule violation',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.kicked).toBe(true)
  })

  it('discord_timeout_member times out a member', async () => {
    const res = await executeAction('discord_timeout_member', {
      guildId: 'g-1',
      userId: 'u-1',
      duration: 60,
      reason: 'Cool down',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.timedOut).toBe(true)
  })

  // --- Role management ---

  it('discord_add_role adds a role to a member', async () => {
    const res = await executeAction('discord_add_role', {
      guildId: 'g-1',
      userId: 'u-1',
      roleId: 'r-1',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.roleAdded).toBe(true)
  })

  it('discord_remove_role removes a role from a member', async () => {
    const res = await executeAction('discord_remove_role', {
      guildId: 'g-1',
      userId: 'u-1',
      roleId: 'r-1',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.roleRemoved).toBe(true)
  })

  it('discord_create_role creates a new role', async () => {
    const res = await executeAction('discord_create_role', {
      guildId: 'g-1',
      name: 'Moderator',
      color: 0xFF0000,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.roleId).toBe('role-1')
    expect(body.result.roleName).toBe('New Role')
  })

  it('discord_set_nickname sets a nickname', async () => {
    const res = await executeAction('discord_set_nickname', {
      guildId: 'g-1',
      userId: 'u-1',
      nickname: 'CoolNick',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.nicknameSet).toBe(true)
  })

  // --- Channel management ---

  it('discord_create_channel creates a channel', async () => {
    const res = await executeAction('discord_create_channel', {
      guildId: 'g-1',
      name: 'general',
      type: 'text',
      topic: 'General chat',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.channelId).toBe('new-ch-1')
  })

  it('discord_delete_channel deletes a channel', async () => {
    const res = await executeAction('discord_delete_channel', { channelId: 'ch-1' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.deleted).toBe(true)
  })

  it('discord_move_member moves a member to a voice channel', async () => {
    const res = await executeAction('discord_move_member', {
      guildId: 'g-1',
      userId: 'u-1',
      channelId: 'vc-1',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.moved).toBe(true)
  })

  // --- Thread management ---

  it('discord_create_thread creates a thread', async () => {
    const res = await executeAction('discord_create_thread', {
      channelId: 'ch-1',
      name: 'Discussion',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.threadId).toBe('thread-1')
  })

  it('discord_send_thread_message sends a message in a thread', async () => {
    const res = await executeAction('discord_send_thread_message', {
      threadId: 'th-1',
      content: 'Thread message',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.messageId).toBeDefined()
  })

  // --- Invite ---

  it('discord_create_invite creates an invite', async () => {
    const res = await executeAction('discord_create_invite', {
      channelId: 'ch-1',
      maxAge: 3600,
      maxUses: 10,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.inviteCode).toBe('abc123')
    expect(body.result.inviteUrl).toBe('https://discord.gg/abc123')
  })

  // --- Scheduled Events ---

  it('discord_create_scheduled_event creates an event', async () => {
    const res = await executeAction('discord_create_scheduled_event', {
      guildId: 'g-1',
      name: 'Game Night',
      startTime: '2026-06-01T20:00:00Z',
      location: 'Online',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.eventId).toBe('event-1')
    expect(body.result.eventName).toBe('New Event')
  })
})
