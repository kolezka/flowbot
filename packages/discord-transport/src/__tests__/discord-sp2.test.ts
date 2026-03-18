import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDiscordTransport } from '../transport/FakeDiscordTransport.js'
import { CircuitBreaker, CircuitState } from '../transport/CircuitBreaker.js'

// =============================================================================
// SP2 Methods on FakeDiscordTransport
// =============================================================================

describe('FakeDiscordTransport — SP2 Interaction methods', () => {
  let transport: FakeDiscordTransport

  beforeEach(() => {
    transport = new FakeDiscordTransport()
  })

  it('replyInteraction resolves without error', async () => {
    await expect(
      transport.replyInteraction('int-1', { content: 'Hello', ephemeral: true }),
    ).resolves.toBeUndefined()
  })

  it('replyInteraction accepts embeds and components', async () => {
    await expect(
      transport.replyInteraction('int-2', {
        content: 'With extras',
        embeds: [{ title: 'Embed' }],
        components: [{ type: 1, components: [] }],
        ephemeral: false,
      }),
    ).resolves.toBeUndefined()
  })

  it('showModal resolves without error', async () => {
    await expect(
      transport.showModal('int-3', {
        customId: 'feedback-modal',
        title: 'Give Feedback',
        components: [{ type: 4, customId: 'input-1', label: 'Message', style: 1 }],
      }),
    ).resolves.toBeUndefined()
  })

  it('sendComponents returns a message result', async () => {
    const result = await transport.sendComponents('ch-1', {
      content: 'Click below',
      components: [{ type: 1, components: [{ type: 2, label: 'Click', customId: 'btn-1' }] }],
    })

    expect(result).toEqual(
      expect.objectContaining({ id: '1', channelId: 'ch-1' }),
    )
  })

  it('editInteraction resolves without error', async () => {
    await expect(
      transport.editInteraction('int-4', { content: 'Updated reply' }),
    ).resolves.toBeUndefined()
  })

  it('deferReply resolves without error', async () => {
    await expect(transport.deferReply('int-5', true)).resolves.toBeUndefined()
    await expect(transport.deferReply('int-6')).resolves.toBeUndefined()
  })
})

describe('FakeDiscordTransport — SP2 Channel & Forum methods', () => {
  let transport: FakeDiscordTransport

  beforeEach(() => {
    transport = new FakeDiscordTransport()
  })

  it('setChannelPermissions resolves without error', async () => {
    await expect(
      transport.setChannelPermissions('ch-1', 'role-1', 'SendMessages', 'ManageChannels'),
    ).resolves.toBeUndefined()
  })

  it('createForumPost returns a thread ID', async () => {
    const id = await transport.createForumPost('forum-ch', {
      name: 'Bug Report',
      content: 'Found a bug',
      tags: ['bug', 'critical'],
    })

    expect(id).toBe('1')
  })

  it('createForumPost without tags', async () => {
    const id = await transport.createForumPost('forum-ch', {
      name: 'Discussion',
      content: 'Let us talk',
    })

    expect(id).toBe('1')
  })

  it('registerCommands resolves without error', async () => {
    await expect(
      transport.registerCommands('guild-1', [
        { name: 'ping', description: 'Pong!' },
        { name: 'help', description: 'Show help' },
      ]),
    ).resolves.toBeUndefined()
  })
})

describe('FakeDiscordTransport — SP2 ID generation', () => {
  it('sendComponents increments IDs alongside other methods', async () => {
    const transport = new FakeDiscordTransport()

    const msg = await transport.sendMessage('ch1', 'first')
    expect(msg.id).toBe('1')

    const comp = await transport.sendComponents('ch1', { components: [] })
    expect(comp.id).toBe('2')

    const forum = await transport.createForumPost('ch1', { name: 'Post', content: 'text' })
    expect(forum).toBe('3')
  })
})

// =============================================================================
// SP2 Methods on CircuitBreaker
// =============================================================================

describe('CircuitBreaker — SP2 method proxying', () => {
  let transport: FakeDiscordTransport
  let breaker: CircuitBreaker

  beforeEach(() => {
    transport = new FakeDiscordTransport()
    breaker = new CircuitBreaker(transport, {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      windowMs: 5000,
    })
  })

  it('proxies replyInteraction', async () => {
    await expect(
      breaker.replyInteraction('int-1', { content: 'Hi' }),
    ).resolves.toBeUndefined()
  })

  it('proxies showModal', async () => {
    await expect(
      breaker.showModal('int-2', { customId: 'modal', title: 'Form', components: [] }),
    ).resolves.toBeUndefined()
  })

  it('proxies sendComponents', async () => {
    const result = await breaker.sendComponents('ch-1', { components: [] })
    expect(result.channelId).toBe('ch-1')
  })

  it('proxies editInteraction', async () => {
    await expect(
      breaker.editInteraction('int-3', { content: 'edited' }),
    ).resolves.toBeUndefined()
  })

  it('proxies deferReply', async () => {
    await expect(breaker.deferReply('int-4', false)).resolves.toBeUndefined()
  })

  it('proxies setChannelPermissions', async () => {
    await expect(
      breaker.setChannelPermissions('ch-1', 'role-1', 'SendMessages'),
    ).resolves.toBeUndefined()
  })

  it('proxies createForumPost', async () => {
    const id = await breaker.createForumPost('ch-1', { name: 'Post', content: 'text' })
    expect(id).toBeTruthy()
  })

  it('proxies registerCommands', async () => {
    await expect(
      breaker.registerCommands('guild-1', [{ name: 'test', description: 'Test' }]),
    ).resolves.toBeUndefined()
  })

  it('SP2 methods respect circuit breaker state', async () => {
    // Trip the breaker
    vi.spyOn(transport, 'sendMessage').mockRejectedValue(new Error('fail'))
    for (let i = 0; i < 3; i++) {
      await expect(breaker.sendMessage('ch1', 'x')).rejects.toThrow()
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // SP2 methods should also be rejected
    await expect(
      breaker.replyInteraction('int-1', { content: 'x' }),
    ).rejects.toThrow('Circuit breaker is OPEN')

    await expect(
      breaker.sendComponents('ch1', { components: [] }),
    ).rejects.toThrow('Circuit breaker is OPEN')

    await expect(
      breaker.createForumPost('ch1', { name: 'x', content: 'x' }),
    ).rejects.toThrow('Circuit breaker is OPEN')
  })
})
