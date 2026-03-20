import { describe, it, expect, beforeEach } from 'vitest'
import { pino } from 'pino'
import { DiscordBotConnector } from '../connector.js'
import { FakeDiscordClient } from '../sdk/fake-client.js'

const logger = pino({ level: 'silent' })

const CHANNEL_ID = '123456789'
const GUILD_ID = '987654321'
const USER_ID = '111222333'
const MESSAGE_ID = '444555666'
const ROLE_ID = '777888999'

function makeConnector(transport?: FakeDiscordClient) {
  return new DiscordBotConnector({
    botToken: 'test-bot-token',
    botInstanceId: 'test-bot-instance',
    logger,
    apiUrl: 'http://localhost:3000',
    transport,
  })
}

describe('DiscordBotConnector', () => {
  let transport: FakeDiscordClient
  let connector: DiscordBotConnector

  beforeEach(() => {
    transport = new FakeDiscordClient()
    connector = makeConnector(transport)
  })

  it('creates a registry before connect()', () => {
    expect(connector.registry).toBeDefined()
    // Registry is empty before connect — actions only registered after transport is set
    expect(connector.registry.getActions()).toHaveLength(0)
  })

  it('isConnected() returns false before connect()', () => {
    expect(connector.isConnected()).toBe(false)
  })

  it('getTransport() returns null before connect()', () => {
    expect(connector.getTransport()).toBeNull()
  })

  describe('after connect()', () => {
    beforeEach(async () => {
      await connector.connect()
    })

    it('isConnected() returns true', () => {
      expect(connector.isConnected()).toBe(true)
    })

    it('getTransport() returns the injected transport', () => {
      expect(connector.getTransport()).toBe(transport)
    })

    it('registry has all expected messaging actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('discord_send_message')
      expect(actions).toContain('discord_send_embed')
      expect(actions).toContain('discord_send_dm')
      expect(actions).toContain('discord_edit_message')
      expect(actions).toContain('discord_delete_message')
      expect(actions).toContain('discord_pin_message')
      expect(actions).toContain('discord_unpin_message')
      expect(actions).toContain('discord_add_reaction')
      expect(actions).toContain('discord_remove_reaction')
      expect(actions).toContain('discord_send_thread_message')
    })

    it('registry has all expected admin actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('discord_ban_member')
      expect(actions).toContain('discord_kick_member')
      expect(actions).toContain('discord_timeout_member')
      expect(actions).toContain('discord_add_role')
      expect(actions).toContain('discord_remove_role')
      expect(actions).toContain('discord_set_nickname')
    })

    it('registry has all expected channel actions', () => {
      const actions = connector.registry.getActions()
      expect(actions).toContain('discord_create_channel')
      expect(actions).toContain('discord_delete_channel')
      expect(actions).toContain('discord_create_thread')
      expect(actions).toContain('discord_create_role')
      expect(actions).toContain('discord_create_invite')
      expect(actions).toContain('discord_move_member')
      expect(actions).toContain('discord_create_scheduled_event')
    })

    it('registry can execute discord_send_message against the fake transport', async () => {
      const result = await connector.registry.execute('discord_send_message', {
        channelId: CHANNEL_ID,
        content: 'hello from connector',
      })
      expect(result.success).toBe(true)
      expect(transport.getSentMessages()).toHaveLength(1)
      expect(transport.getSentMessages()[0]?.content).toBe('hello from connector')
    })

    it('registry can execute discord_ban_member against the fake transport', async () => {
      const result = await connector.registry.execute('discord_ban_member', {
        guildId: GUILD_ID,
        userId: USER_ID,
      })
      expect(result.success).toBe(true)
      expect(transport.getBannedMembers()).toHaveLength(1)
      expect(transport.getBannedMembers()[0]?.userId).toBe(USER_ID)
    })

    it('registry can execute discord_delete_message against the fake transport', async () => {
      const result = await connector.registry.execute('discord_delete_message', {
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      })
      expect(result.success).toBe(true)
      expect(transport.getDeletedMessages()).toHaveLength(1)
      expect(transport.getDeletedMessages()[0]?.messageId).toBe(MESSAGE_ID)
    })

    it('registry can execute discord_add_role against the fake transport', async () => {
      const result = await connector.registry.execute('discord_add_role', {
        guildId: GUILD_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
      })
      expect(result.success).toBe(true)
      expect(transport.getAddedRoles()).toHaveLength(1)
    })

    it('registry can execute discord_create_channel against the fake transport', async () => {
      const result = await connector.registry.execute('discord_create_channel', {
        guildId: GUILD_ID,
        name: 'new-channel',
        type: 'text',
      })
      expect(result.success).toBe(true)
      expect(transport.getCreatedChannels()).toHaveLength(1)
    })

    it('registry returns error for unregistered action', async () => {
      const result = await connector.registry.execute('nonexistent', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('not registered')
    })
  })

  describe('disconnect()', () => {
    it('isConnected() returns false after disconnect', async () => {
      await connector.connect()
      expect(connector.isConnected()).toBe(true)
      await connector.disconnect()
      expect(connector.isConnected()).toBe(false)
    })

    it('disconnect() is safe to call before connect()', async () => {
      // Should not throw
      await expect(connector.disconnect()).resolves.toBeUndefined()
    })
  })
})
