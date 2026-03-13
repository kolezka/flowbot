import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDiscordTransport } from '../transport/FakeDiscordTransport.js'
import { CircuitBreaker, CircuitOpenError, CircuitState } from '../transport/CircuitBreaker.js'

// =============================================================================
// FakeDiscordTransport
// =============================================================================

describe('FakeDiscordTransport', () => {
  let transport: FakeDiscordTransport

  beforeEach(() => {
    transport = new FakeDiscordTransport()
  })

  // --- Connection ---

  it('starts disconnected', () => {
    expect(transport.isConnected()).toBe(false)
  })

  it('connect / disconnect toggles state', async () => {
    await transport.connect()
    expect(transport.isConnected()).toBe(true)
    await transport.disconnect()
    expect(transport.isConnected()).toBe(false)
  })

  // --- Messaging ---

  it('tracks sendMessage calls', async () => {
    const result = await transport.sendMessage('ch1', 'Hello', { tts: true })
    expect(result).toEqual(expect.objectContaining({ id: '1', channelId: 'ch1' }))
    expect(transport.getSentMessages()).toHaveLength(1)
    expect(transport.getSentMessages()[0]).toEqual(
      expect.objectContaining({ channelId: 'ch1', content: 'Hello', options: { tts: true } }),
    )
  })

  it('tracks sendEmbed calls', async () => {
    const embed = { title: 'Test', description: 'desc' }
    const result = await transport.sendEmbed('ch1', embed, 'body')
    expect(result.id).toBe('1')
    expect(transport.getSentEmbeds()).toHaveLength(1)
    expect(transport.getSentEmbeds()[0]).toEqual(
      expect.objectContaining({ channelId: 'ch1', embed, content: 'body' }),
    )
  })

  it('tracks sendDM calls', async () => {
    const result = await transport.sendDM('user1', 'Hi there')
    expect(result.channelId).toBe('dm-user1')
    expect(transport.getSentDMs()).toHaveLength(1)
    expect(transport.getSentDMs()[0]).toEqual(
      expect.objectContaining({ userId: 'user1', content: 'Hi there' }),
    )
  })

  // --- Message management ---

  it('tracks editMessage calls', async () => {
    const result = await transport.editMessage('ch1', 'msg1', 'Updated')
    expect(result.channelId).toBe('ch1')
    expect(transport.getEditedMessages()).toHaveLength(1)
    expect(transport.getEditedMessages()[0]).toEqual(
      expect.objectContaining({ channelId: 'ch1', messageId: 'msg1', content: 'Updated' }),
    )
  })

  it('tracks deleteMessage calls', async () => {
    const result = await transport.deleteMessage('ch1', 'msg1')
    expect(result).toBe(true)
    expect(transport.getDeletedMessages()).toHaveLength(1)
    expect(transport.getDeletedMessages()[0]).toEqual({ channelId: 'ch1', messageId: 'msg1' })
  })

  it('tracks pinMessage calls', async () => {
    expect(await transport.pinMessage('ch1', 'msg1')).toBe(true)
    expect(transport.getPinnedMessages()).toHaveLength(1)
    expect(transport.getPinnedMessages()[0]).toEqual({ channelId: 'ch1', messageId: 'msg1' })
  })

  it('tracks unpinMessage calls', async () => {
    expect(await transport.unpinMessage('ch1', 'msg1')).toBe(true)
    expect(transport.getUnpinnedMessages()).toHaveLength(1)
    expect(transport.getUnpinnedMessages()[0]).toEqual({ channelId: 'ch1', messageId: 'msg1' })
  })

  // --- Reactions ---

  it('tracks addReaction calls', async () => {
    expect(await transport.addReaction('ch1', 'msg1', '👍')).toBe(true)
    expect(transport.getAddedReactions()).toHaveLength(1)
    expect(transport.getAddedReactions()[0]).toEqual({ channelId: 'ch1', messageId: 'msg1', emoji: '👍' })
  })

  it('tracks removeReaction calls', async () => {
    expect(await transport.removeReaction('ch1', 'msg1', '👍')).toBe(true)
    expect(transport.getRemovedReactions()).toHaveLength(1)
    expect(transport.getRemovedReactions()[0]).toEqual({ channelId: 'ch1', messageId: 'msg1', emoji: '👍' })
  })

  // --- Member management ---

  it('tracks banMember calls', async () => {
    expect(await transport.banMember('g1', 'u1', 'spam', 7)).toBe(true)
    expect(transport.getBannedMembers()).toHaveLength(1)
    expect(transport.getBannedMembers()[0]).toEqual({ guildId: 'g1', userId: 'u1', reason: 'spam', deleteMessageDays: 7 })
  })

  it('tracks kickMember calls', async () => {
    expect(await transport.kickMember('g1', 'u1', 'rule violation')).toBe(true)
    expect(transport.getKickedMembers()).toHaveLength(1)
    expect(transport.getKickedMembers()[0]).toEqual({ guildId: 'g1', userId: 'u1', reason: 'rule violation' })
  })

  it('tracks timeoutMember calls', async () => {
    expect(await transport.timeoutMember('g1', 'u1', 60000, 'cool down')).toBe(true)
    expect(transport.getTimedOutMembers()).toHaveLength(1)
    expect(transport.getTimedOutMembers()[0]).toEqual({ guildId: 'g1', userId: 'u1', durationMs: 60000, reason: 'cool down' })
  })

  it('tracks addRole calls', async () => {
    expect(await transport.addRole('g1', 'u1', 'r1')).toBe(true)
    expect(transport.getAddedRoles()).toHaveLength(1)
    expect(transport.getAddedRoles()[0]).toEqual({ guildId: 'g1', userId: 'u1', roleId: 'r1' })
  })

  it('tracks removeRole calls', async () => {
    expect(await transport.removeRole('g1', 'u1', 'r1')).toBe(true)
    expect(transport.getRemovedRoles()).toHaveLength(1)
    expect(transport.getRemovedRoles()[0]).toEqual({ guildId: 'g1', userId: 'u1', roleId: 'r1' })
  })

  it('tracks setNickname calls', async () => {
    expect(await transport.setNickname('g1', 'u1', 'NewNick')).toBe(true)
    expect(transport.getNicknameChanges()).toHaveLength(1)
    expect(transport.getNicknameChanges()[0]).toEqual({ guildId: 'g1', userId: 'u1', nickname: 'NewNick' })
  })

  // --- Channel management ---

  it('tracks createChannel calls', async () => {
    const id = await transport.createChannel('g1', 'general', 'text', { topic: 'chat' })
    expect(id).toBe('1')
    expect(transport.getCreatedChannels()).toHaveLength(1)
    expect(transport.getCreatedChannels()[0]).toEqual(
      expect.objectContaining({ guildId: 'g1', name: 'general', type: 'text', options: { topic: 'chat' } }),
    )
  })

  it('tracks deleteChannel calls', async () => {
    expect(await transport.deleteChannel('ch1')).toBe(true)
    expect(transport.getDeletedChannels()).toEqual(['ch1'])
  })

  it('tracks createThread calls', async () => {
    const id = await transport.createThread('ch1', 'Discussion')
    expect(id).toBe('1')
    expect(transport.getCreatedThreads()).toHaveLength(1)
    expect(transport.getCreatedThreads()[0]).toEqual(
      expect.objectContaining({ channelId: 'ch1', name: 'Discussion' }),
    )
  })

  it('tracks sendThreadMessage calls', async () => {
    const result = await transport.sendThreadMessage('th1', 'Thread reply')
    expect(result.channelId).toBe('th1')
    expect(transport.getSentThreadMessages()).toHaveLength(1)
    expect(transport.getSentThreadMessages()[0]).toEqual(
      expect.objectContaining({ channelId: 'th1', content: 'Thread reply' }),
    )
  })

  // --- Guild management ---

  it('tracks createRole calls', async () => {
    const id = await transport.createRole('g1', 'Moderator', { color: 0xFF0000 })
    expect(id).toBe('1')
    expect(transport.getCreatedRoles()).toHaveLength(1)
    expect(transport.getCreatedRoles()[0]).toEqual(
      expect.objectContaining({ guildId: 'g1', name: 'Moderator', options: { color: 0xFF0000 } }),
    )
  })

  it('tracks createInvite calls', async () => {
    const url = await transport.createInvite('ch1', { maxAge: 86400 })
    expect(url).toMatch(/^https:\/\/discord\.gg\/fake_/)
    expect(transport.getCreatedInvites()).toHaveLength(1)
    expect(transport.getCreatedInvites()[0]).toEqual(
      expect.objectContaining({ channelId: 'ch1', options: { maxAge: 86400 } }),
    )
  })

  it('tracks moveMember calls', async () => {
    expect(await transport.moveMember('g1', 'u1', 'vc1')).toBe(true)
    expect(transport.getMovedMembers()).toHaveLength(1)
    expect(transport.getMovedMembers()[0]).toEqual({ guildId: 'g1', userId: 'u1', channelId: 'vc1' })
  })

  it('tracks createScheduledEvent calls', async () => {
    const opts = {
      scheduledStartTime: new Date('2026-06-01T10:00:00Z'),
      entityType: 'external' as const,
      location: 'Online',
    }
    const id = await transport.createScheduledEvent('g1', 'Game Night', opts)
    expect(id).toBe('1')
    expect(transport.getCreatedEvents()).toHaveLength(1)
    expect(transport.getCreatedEvents()[0]).toEqual(
      expect.objectContaining({ guildId: 'g1', name: 'Game Night', options: opts }),
    )
  })

  // --- IDs are auto-incremented ---

  it('generates incrementing IDs across different methods', async () => {
    const r1 = await transport.sendMessage('ch1', 'msg1')
    const r2 = await transport.sendMessage('ch1', 'msg2')
    const chId = await transport.createChannel('g1', 'ch', 'text')
    expect(r1.id).toBe('1')
    expect(r2.id).toBe('2')
    expect(chId).toBe('3')
  })

  // --- Reset ---

  it('reset() clears all tracked state and resets ID counter', async () => {
    await transport.sendMessage('ch1', 'hello')
    await transport.sendEmbed('ch1', { title: 'E' })
    await transport.sendDM('u1', 'dm')
    await transport.editMessage('ch1', 'm1', 'edit')
    await transport.deleteMessage('ch1', 'm1')
    await transport.pinMessage('ch1', 'm1')
    await transport.unpinMessage('ch1', 'm1')
    await transport.addReaction('ch1', 'm1', '👍')
    await transport.removeReaction('ch1', 'm1', '👍')
    await transport.banMember('g1', 'u1')
    await transport.kickMember('g1', 'u1')
    await transport.timeoutMember('g1', 'u1', 60000)
    await transport.addRole('g1', 'u1', 'r1')
    await transport.removeRole('g1', 'u1', 'r1')
    await transport.setNickname('g1', 'u1', 'nick')
    await transport.createChannel('g1', 'ch', 'text')
    await transport.deleteChannel('ch1')
    await transport.createThread('ch1', 'Thread')
    await transport.sendThreadMessage('th1', 'msg')
    await transport.createRole('g1', 'role')
    await transport.createInvite('ch1')
    await transport.moveMember('g1', 'u1', 'vc1')
    await transport.createScheduledEvent('g1', 'evt', {
      scheduledStartTime: new Date(),
      entityType: 'external',
    })

    transport.reset()

    expect(transport.getSentMessages()).toHaveLength(0)
    expect(transport.getSentEmbeds()).toHaveLength(0)
    expect(transport.getSentDMs()).toHaveLength(0)
    expect(transport.getEditedMessages()).toHaveLength(0)
    expect(transport.getDeletedMessages()).toHaveLength(0)
    expect(transport.getPinnedMessages()).toHaveLength(0)
    expect(transport.getUnpinnedMessages()).toHaveLength(0)
    expect(transport.getAddedReactions()).toHaveLength(0)
    expect(transport.getRemovedReactions()).toHaveLength(0)
    expect(transport.getBannedMembers()).toHaveLength(0)
    expect(transport.getKickedMembers()).toHaveLength(0)
    expect(transport.getTimedOutMembers()).toHaveLength(0)
    expect(transport.getAddedRoles()).toHaveLength(0)
    expect(transport.getRemovedRoles()).toHaveLength(0)
    expect(transport.getNicknameChanges()).toHaveLength(0)
    expect(transport.getCreatedChannels()).toHaveLength(0)
    expect(transport.getDeletedChannels()).toHaveLength(0)
    expect(transport.getCreatedThreads()).toHaveLength(0)
    expect(transport.getSentThreadMessages()).toHaveLength(0)
    expect(transport.getCreatedRoles()).toHaveLength(0)
    expect(transport.getCreatedInvites()).toHaveLength(0)
    expect(transport.getMovedMembers()).toHaveLength(0)
    expect(transport.getCreatedEvents()).toHaveLength(0)

    // ID counter resets
    const r = await transport.sendMessage('ch1', 'after-reset')
    expect(r.id).toBe('1')
  })
})

// =============================================================================
// CircuitBreaker
// =============================================================================

describe('CircuitBreaker', () => {
  let transport: FakeDiscordTransport
  let breaker: CircuitBreaker

  const fastConfig = {
    failureThreshold: 3,
    resetTimeoutMs: 1000,
    windowMs: 5000,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    transport = new FakeDiscordTransport()
    breaker = new CircuitBreaker(transport, fastConfig)
  })

  // --- Proxy behavior ---

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('proxies connect/disconnect/isConnected to underlying transport', async () => {
    expect(breaker.isConnected()).toBe(false)
    await breaker.connect()
    expect(breaker.isConnected()).toBe(true)
    expect(transport.isConnected()).toBe(true)
    await breaker.disconnect()
    expect(breaker.isConnected()).toBe(false)
  })

  it('proxies sendMessage through to transport', async () => {
    const result = await breaker.sendMessage('ch1', 'Hello')
    expect(result.channelId).toBe('ch1')
    expect(transport.getSentMessages()).toHaveLength(1)
  })

  it('proxies sendEmbed through to transport', async () => {
    const result = await breaker.sendEmbed('ch1', { title: 'Test' })
    expect(result.channelId).toBe('ch1')
    expect(transport.getSentEmbeds()).toHaveLength(1)
  })

  it('proxies sendDM through to transport', async () => {
    const result = await breaker.sendDM('user1', 'Hi')
    expect(result.channelId).toBe('dm-user1')
    expect(transport.getSentDMs()).toHaveLength(1)
  })

  it('proxies editMessage through to transport', async () => {
    const result = await breaker.editMessage('ch1', 'msg1', 'Updated')
    expect(result.channelId).toBe('ch1')
    expect(transport.getEditedMessages()).toHaveLength(1)
  })

  it('proxies deleteMessage through to transport', async () => {
    expect(await breaker.deleteMessage('ch1', 'msg1')).toBe(true)
    expect(transport.getDeletedMessages()).toHaveLength(1)
  })

  it('proxies pinMessage and unpinMessage through to transport', async () => {
    expect(await breaker.pinMessage('ch1', 'msg1')).toBe(true)
    expect(await breaker.unpinMessage('ch1', 'msg2')).toBe(true)
    expect(transport.getPinnedMessages()).toHaveLength(1)
    expect(transport.getUnpinnedMessages()).toHaveLength(1)
  })

  it('proxies addReaction and removeReaction through to transport', async () => {
    expect(await breaker.addReaction('ch1', 'msg1', '👍')).toBe(true)
    expect(await breaker.removeReaction('ch1', 'msg1', '👎')).toBe(true)
    expect(transport.getAddedReactions()).toHaveLength(1)
    expect(transport.getRemovedReactions()).toHaveLength(1)
  })

  it('proxies banMember through to transport', async () => {
    expect(await breaker.banMember('g1', 'u1', 'spam')).toBe(true)
    expect(transport.getBannedMembers()).toHaveLength(1)
  })

  it('proxies kickMember through to transport', async () => {
    expect(await breaker.kickMember('g1', 'u1')).toBe(true)
    expect(transport.getKickedMembers()).toHaveLength(1)
  })

  it('proxies timeoutMember through to transport', async () => {
    expect(await breaker.timeoutMember('g1', 'u1', 60000)).toBe(true)
    expect(transport.getTimedOutMembers()).toHaveLength(1)
  })

  it('proxies addRole and removeRole through to transport', async () => {
    expect(await breaker.addRole('g1', 'u1', 'r1')).toBe(true)
    expect(await breaker.removeRole('g1', 'u1', 'r1')).toBe(true)
    expect(transport.getAddedRoles()).toHaveLength(1)
    expect(transport.getRemovedRoles()).toHaveLength(1)
  })

  it('proxies setNickname through to transport', async () => {
    expect(await breaker.setNickname('g1', 'u1', 'Nick')).toBe(true)
    expect(transport.getNicknameChanges()).toHaveLength(1)
  })

  it('proxies createChannel and deleteChannel through to transport', async () => {
    const id = await breaker.createChannel('g1', 'general', 'text')
    expect(id).toBeTruthy()
    expect(await breaker.deleteChannel(id)).toBe(true)
    expect(transport.getCreatedChannels()).toHaveLength(1)
    expect(transport.getDeletedChannels()).toHaveLength(1)
  })

  it('proxies createThread and sendThreadMessage through to transport', async () => {
    const id = await breaker.createThread('ch1', 'Thread')
    expect(id).toBeTruthy()
    const msg = await breaker.sendThreadMessage(id, 'reply')
    expect(msg.channelId).toBe(id)
    expect(transport.getCreatedThreads()).toHaveLength(1)
    expect(transport.getSentThreadMessages()).toHaveLength(1)
  })

  it('proxies createRole through to transport', async () => {
    const id = await breaker.createRole('g1', 'Mod')
    expect(id).toBeTruthy()
    expect(transport.getCreatedRoles()).toHaveLength(1)
  })

  it('proxies createInvite through to transport', async () => {
    const url = await breaker.createInvite('ch1')
    expect(url).toMatch(/discord\.gg/)
    expect(transport.getCreatedInvites()).toHaveLength(1)
  })

  it('proxies moveMember through to transport', async () => {
    expect(await breaker.moveMember('g1', 'u1', 'vc1')).toBe(true)
    expect(transport.getMovedMembers()).toHaveLength(1)
  })

  it('proxies createScheduledEvent through to transport', async () => {
    const id = await breaker.createScheduledEvent('g1', 'Event', {
      scheduledStartTime: new Date(),
      entityType: 'external',
    })
    expect(id).toBeTruthy()
    expect(transport.getCreatedEvents()).toHaveLength(1)
  })

  // --- Circuit breaker logic ---

  it('trips after failure threshold is reached', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('ch1', 'hi')).rejects.toThrow('fail')
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('stays CLOSED when failures are below threshold', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    for (let i = 0; i < fastConfig.failureThreshold - 1; i++) {
      await expect(breaker.sendMessage('ch1', 'hi')).rejects.toThrow('fail')
    }

    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('rejects calls with CircuitOpenError when OPEN', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('ch1', 'hi')).rejects.toThrow('fail')
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN)
    await expect(breaker.sendMessage('ch1', 'hi')).rejects.toThrow(CircuitOpenError)
    // underlying transport should not be called when circuit is OPEN
    expect(transport.sendMessage).toHaveBeenCalledTimes(fastConfig.failureThreshold)
  })

  it('recovers after resetTimeout when probe succeeds', async () => {
    const sendSpy = vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('ch1', 'hi')).rejects.toThrow('fail')
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    const realDateNow = Date.now
    Date.now = vi.fn(() => realDateNow() + fastConfig.resetTimeoutMs + 100)

    sendSpy.mockRestore()

    const result = await breaker.sendMessage('ch1', 'probe')
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect(result.channelId).toBe('ch1')

    Date.now = realDateNow
  })

  it('goes back to OPEN if probe fails in HALF_OPEN', async () => {
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    for (let i = 0; i < fastConfig.failureThreshold; i++) {
      await expect(breaker.sendMessage('ch1', 'hi')).rejects.toThrow('fail')
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    const realDateNow = Date.now
    Date.now = vi.fn(() => realDateNow() + fastConfig.resetTimeoutMs + 100)

    await expect(breaker.sendMessage('ch1', 'probe')).rejects.toThrow('fail')
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    Date.now = realDateNow
  })

  it('failures outside window do not count toward threshold', async () => {
    const shortWindowBreaker = new CircuitBreaker(transport, {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      windowMs: 100,
    })
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))

    const realDateNow = Date.now
    let currentTime = realDateNow()
    Date.now = vi.fn(() => currentTime)

    await expect(shortWindowBreaker.sendMessage('ch1', 'hi')).rejects.toThrow('fail')
    await expect(shortWindowBreaker.sendMessage('ch1', 'hi')).rejects.toThrow('fail')

    // advance past window
    currentTime += 200

    await expect(shortWindowBreaker.sendMessage('ch1', 'hi')).rejects.toThrow('fail')
    expect(shortWindowBreaker.getState()).toBe(CircuitState.CLOSED)

    Date.now = realDateNow
  })

  it('uses default config when none provided', () => {
    const defaultBreaker = new CircuitBreaker(transport)
    expect(defaultBreaker.getState()).toBe(CircuitState.CLOSED)
  })
})
