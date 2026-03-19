import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FlowContext, NodeResult } from '../lib/flow-engine/types.js'

const { mockTransport } = vi.hoisted(() => {
  const mockTransport = {
    sendMessage: vi.fn().mockResolvedValue({ id: 1, date: 0, peerId: '123' }),
    sendPhoto: vi.fn().mockResolvedValue({ id: 2, date: 0, peerId: '123' }),
    sendVideo: vi.fn().mockResolvedValue({ id: 7, date: 0, peerId: '123' }),
    sendDocument: vi.fn().mockResolvedValue({ id: 8, date: 0, peerId: '123' }),
    sendSticker: vi.fn().mockResolvedValue({ id: 9, date: 0, peerId: '123' }),
    sendVoice: vi.fn().mockResolvedValue({ id: 10, date: 0, peerId: '123' }),
    sendAudio: vi.fn().mockResolvedValue({ id: 11, date: 0, peerId: '123' }),
    sendAnimation: vi.fn().mockResolvedValue({ id: 12, date: 0, peerId: '123' }),
    sendLocation: vi.fn().mockResolvedValue({ id: 13, date: 0, peerId: '123' }),
    sendContact: vi.fn().mockResolvedValue({ id: 14, date: 0, peerId: '123' }),
    sendVenue: vi.fn().mockResolvedValue({ id: 15, date: 0, peerId: '123' }),
    sendDice: vi.fn().mockResolvedValue({ id: 16, date: 0, peerId: '123' }),
    forwardMessage: vi.fn().mockResolvedValue([{ id: 3, date: 0, peerId: '123' }]),
    copyMessage: vi.fn().mockResolvedValue([{ id: 5, date: 0, peerId: '123' }]),
    editMessage: vi.fn().mockResolvedValue({ id: 4, date: 0, peerId: '123' }),
    deleteMessages: vi.fn().mockResolvedValue(true),
    pinMessage: vi.fn().mockResolvedValue(true),
    unpinMessage: vi.fn().mockResolvedValue(true),
    banUser: vi.fn().mockResolvedValue(true),
    restrictUser: vi.fn().mockResolvedValue(true),
    promoteUser: vi.fn().mockResolvedValue(true),
    setChatTitle: vi.fn().mockResolvedValue(true),
    setChatDescription: vi.fn().mockResolvedValue(true),
    exportInviteLink: vi.fn().mockResolvedValue('https://t.me/+abc'),
    getChatMember: vi.fn().mockResolvedValue({ userId: '123', status: 'member' }),
    leaveChat: vi.fn().mockResolvedValue(true),
    createPoll: vi.fn().mockResolvedValue({ id: 6, date: 0, peerId: '123' }),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
  }
  return { mockTransport }
})

vi.mock('@trigger.dev/sdk/v3', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('../lib/telegram.js', () => ({
  getTelegramTransport: vi.fn().mockResolvedValue(mockTransport),
}))

vi.mock('../lib/flow-engine/user-actions.js', () => ({
  dispatchUserAction: vi.fn().mockResolvedValue({ nodeId: '', dispatched: true, response: {} }),
}))

import { dispatchActions } from '../lib/flow-engine/dispatcher.js'

function makeCtx(
  nodeResults: Array<{ id: string; action: string; params?: Record<string, unknown> }>,
): FlowContext {
  const results = new Map<string, NodeResult>()
  for (const nr of nodeResults) {
    results.set(nr.id, {
      nodeId: nr.id,
      status: 'success',
      output: { action: nr.action, executed: true, ...(nr.params ?? {}) },
      startedAt: new Date(),
      completedAt: new Date(),
    })
  }
  return {
    flowId: 'test-flow',
    executionId: 'test-exec',
    variables: new Map(),
    triggerData: {},
    nodeResults: results,
  }
}

describe('dispatchActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Messaging actions ---

  it('dispatches send_message to transport.sendMessage', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hello', parseMode: 'HTML' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('123', 'Hello', expect.objectContaining({ parseMode: 'html' }))
  })

  it('dispatches send_photo to transport.sendPhoto', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_photo', params: { chatId: '123', photoUrl: 'https://example.com/photo.jpg', caption: 'test' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendPhoto).toHaveBeenCalledWith(
      '123',
      'https://example.com/photo.jpg',
      expect.objectContaining({ caption: 'test' }),
    )
  })

  it('dispatches send_video to transport.sendVideo', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_video', params: { chatId: '123', videoUrl: 'https://example.com/vid.mp4', caption: 'vid' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendVideo).toHaveBeenCalledWith(
      '123',
      'https://example.com/vid.mp4',
      expect.objectContaining({ caption: 'vid' }),
    )
  })

  it('dispatches send_document to transport.sendDocument', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_document', params: { chatId: '123', documentUrl: 'https://example.com/f.pdf', fileName: 'f.pdf' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendDocument).toHaveBeenCalledWith(
      '123',
      'https://example.com/f.pdf',
      expect.objectContaining({ fileName: 'f.pdf' }),
    )
  })

  it('dispatches send_sticker to transport.sendSticker', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_sticker', params: { chatId: '123', sticker: 'sticker-id' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendSticker).toHaveBeenCalledWith('123', 'sticker-id')
  })

  it('dispatches send_location to transport.sendLocation', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_location', params: { chatId: '123', latitude: 51.5, longitude: -0.1 } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendLocation).toHaveBeenCalledWith('123', 51.5, -0.1, expect.any(Object))
  })

  it('dispatches send_contact to transport.sendContact', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_contact', params: { chatId: '123', phoneNumber: '+1234', firstName: 'John', lastName: 'Doe' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendContact).toHaveBeenCalledWith('123', '+1234', 'John', 'Doe')
  })

  it('dispatches send_venue to transport.sendVenue', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_venue', params: { chatId: '123', latitude: 51.5, longitude: -0.1, title: 'Place', address: '123 St' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendVenue).toHaveBeenCalledWith('123', 51.5, -0.1, 'Place', '123 St')
  })

  it('dispatches send_dice to transport.sendDice', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_dice', params: { chatId: '123', emoji: '🎲' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.sendDice).toHaveBeenCalledWith('123', '🎲')
  })

  // --- Message management ---

  it('dispatches forward_message correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'forward_message', params: { fromChatId: '111', toChatId: '222', messageId: 42 } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.forwardMessage).toHaveBeenCalledWith('111', '222', [42])
  })

  it('dispatches copy_message correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'copy_message', params: { fromChatId: '111', toChatId: '222', messageId: 99 } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.copyMessage).toHaveBeenCalledWith('111', '222', 99)
  })

  it('dispatches edit_message correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'edit_message', params: { chatId: '123', messageId: 55, text: 'Updated', parseMode: 'MarkdownV2' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.editMessage).toHaveBeenCalledWith('123', 55, 'Updated', expect.objectContaining({ parseMode: 'markdown' }))
  })

  it('dispatches delete_message correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'delete_message', params: { chatId: '123', messageId: 77 } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.deleteMessages).toHaveBeenCalledWith('123', [77])
  })

  it('dispatches pin_message correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'pin_message', params: { chatId: '123', messageId: 88, disableNotification: true } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.pinMessage).toHaveBeenCalledWith('123', 88, true)
  })

  it('dispatches unpin_message correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'unpin_message', params: { chatId: '123', messageId: 88 } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.unpinMessage).toHaveBeenCalledWith('123', 88)
  })

  // --- User management ---

  it('dispatches ban_user to transport.banUser', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'ban_user', params: { chatId: '-100123', userId: '456' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.banUser).toHaveBeenCalledWith('-100123', '456')
  })

  it('dispatches mute_user to transport.restrictUser with canSendMessages false', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'mute_user', params: { chatId: '123', userId: '456', duration: 3600 } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.restrictUser).toHaveBeenCalledWith('123', '456', { canSendMessages: false }, 3600)
  })

  it('dispatches restrict_user with permissions', async () => {
    const perms = { canSendMessages: false, canSendMedia: false }
    const ctx = makeCtx([
      { id: 'n1', action: 'restrict_user', params: { chatId: '123', userId: '456', permissions: perms, untilDate: 3600 } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.restrictUser).toHaveBeenCalledWith('123', '456', perms, 3600)
  })

  it('dispatches promote_user to transport.promoteUser', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'promote_user', params: { chatId: '123', userId: '456', privileges: { canDeleteMessages: true } } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.promoteUser).toHaveBeenCalledWith('123', '456', { canDeleteMessages: true })
  })

  // --- Chat management ---

  it('dispatches set_chat_title correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'set_chat_title', params: { chatId: '123', title: 'New Title' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.setChatTitle).toHaveBeenCalledWith('123', 'New Title')
  })

  it('dispatches set_chat_description correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'set_chat_description', params: { chatId: '123', description: 'Desc' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.setChatDescription).toHaveBeenCalledWith('123', 'Desc')
  })

  it('dispatches export_invite_link correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'export_invite_link', params: { chatId: '123' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.exportInviteLink).toHaveBeenCalledWith('123')
  })

  it('dispatches leave_chat correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'leave_chat', params: { chatId: '123' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.leaveChat).toHaveBeenCalledWith('123')
  })

  // --- Interactive ---

  it('dispatches create_poll to transport.createPoll', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'create_poll', params: { chatId: '123', question: 'Test?', options: ['Yes', 'No'], isAnonymous: true } },
    ])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.createPoll).toHaveBeenCalledWith(
      '123',
      'Test?',
      ['Yes', 'No'],
      expect.objectContaining({ isAnonymous: true }),
    )
  })

  it('dispatches answer_callback_query correctly', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'answer_callback_query', params: { callbackQueryId: 'qid', text: 'Done', showAlert: true } },
    ])
    const results = await dispatchActions(ctx)
    expect(results[0].dispatched).toBe(true)
    expect(mockTransport.answerCallbackQuery).toHaveBeenCalledWith(
      'qid',
      expect.objectContaining({ text: 'Done', showAlert: true }),
    )
  })

  // --- Skipping behavior ---

  it('skips internal actions (delay, api_call, db_query, transform, loop, switch)', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'delay', params: {} },
      { id: 'n2', action: 'api_call', params: {} },
      { id: 'n3', action: 'db_query', params: {} },
      { id: 'n4', action: 'transform', params: {} },
      { id: 'n5', action: 'loop', params: {} },
      { id: 'n6', action: 'switch', params: {} },
      { id: 'n7', action: 'parallel_branch', params: {} },
      { id: 'n8', action: 'notification', params: {} },
    ])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(0)
    expect(mockTransport.sendMessage).not.toHaveBeenCalled()
  })

  it('skips bot_action (already executed)', async () => {
    const ctx = makeCtx([{ id: 'n1', action: 'bot_action', params: {} }])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(0)
  })

  it('skips nodes with error status', async () => {
    const nodeResults = new Map<string, NodeResult>()
    nodeResults.set('n1', {
      nodeId: 'n1',
      status: 'error',
      output: { action: 'send_message', executed: true, chatId: '123', text: 'Hi' },
      error: 'some error',
      startedAt: new Date(),
      completedAt: new Date(),
    })
    const ctx: FlowContext = {
      flowId: 'f',
      executionId: 'e',
      variables: new Map(),
      triggerData: {},
      nodeResults,
    }
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(0)
  })

  it('skips nodes without executed flag', async () => {
    const nodeResults = new Map<string, NodeResult>()
    nodeResults.set('n1', {
      nodeId: 'n1',
      status: 'success',
      output: { action: 'send_message', chatId: '123', text: 'Hi' }, // no executed: true
      startedAt: new Date(),
      completedAt: new Date(),
    })
    const ctx: FlowContext = {
      flowId: 'f',
      executionId: 'e',
      variables: new Map(),
      triggerData: {},
      nodeResults,
    }
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(0)
  })

  it('skips nodes with no output', async () => {
    const nodeResults = new Map<string, NodeResult>()
    nodeResults.set('n1', {
      nodeId: 'n1',
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
    })
    const ctx: FlowContext = {
      flowId: 'f',
      executionId: 'e',
      variables: new Map(),
      triggerData: {},
      nodeResults,
    }
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(0)
  })

  it('returns empty array when no action nodes exist', async () => {
    const ctx: FlowContext = {
      flowId: 'f',
      executionId: 'e',
      variables: new Map(),
      triggerData: {},
      nodeResults: new Map(),
    }
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(0)
  })

  // --- Error handling ---

  it('handles transport errors gracefully', async () => {
    mockTransport.sendMessage.mockRejectedValueOnce(new Error('Connection failed'))
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Hi' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(1)
    expect(results[0].dispatched).toBe(false)
    expect(results[0].error).toBe('Connection failed')
  })

  it('continues dispatching after one action fails', async () => {
    mockTransport.sendMessage.mockRejectedValueOnce(new Error('Failed'))
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Fail' } },
      { id: 'n2', action: 'ban_user', params: { chatId: '123', userId: '456' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(2)
    expect(results[0]!.dispatched).toBe(false)
    expect(results[1]!.dispatched).toBe(true)
  })

  // --- Multiple actions ---

  it('dispatches multiple actions in sequence', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'First' } },
      { id: 'n2', action: 'ban_user', params: { chatId: '123', userId: '456' } },
      { id: 'n3', action: 'send_photo', params: { chatId: '123', photoUrl: 'https://example.com/photo.jpg' } },
    ])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(3)
    expect(results.every((r) => r.dispatched)).toBe(true)
  })

  // --- Unknown action ---

  it('logs warning for unknown action types and returns not_implemented', async () => {
    const { logger: mockLogger } = await import('@trigger.dev/sdk/v3')
    const ctx = makeCtx([{ id: 'n1', action: 'unknown_action', params: { chatId: '123' } }])
    const results = await dispatchActions(ctx)
    expect(results).toHaveLength(1)
    expect(results[0]!.dispatched).toBe(true)
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  // --- Parse mode mapping ---

  it('maps MarkdownV2 parseMode to markdown', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Test', parseMode: 'MarkdownV2' } },
    ])
    await dispatchActions(ctx)
    expect(mockTransport.sendMessage).toHaveBeenCalledWith(
      '123',
      'Test',
      expect.objectContaining({ parseMode: 'markdown' }),
    )
  })

  it('maps empty parseMode to undefined', async () => {
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'Test' } },
    ])
    await dispatchActions(ctx)
    expect(mockTransport.sendMessage).toHaveBeenCalledWith(
      '123',
      'Test',
      expect.objectContaining({ parseMode: undefined }),
    )
  })

  // --- Lazy transport init ---

  it('only initializes transport once for multiple actions', async () => {
    const { getTelegramTransport } = await import('../lib/telegram.js')
    const ctx = makeCtx([
      { id: 'n1', action: 'send_message', params: { chatId: '123', text: 'A' } },
      { id: 'n2', action: 'send_message', params: { chatId: '123', text: 'B' } },
    ])
    await dispatchActions(ctx)
    expect(getTelegramTransport).toHaveBeenCalledTimes(1)
  })

  it('does not initialize transport when all actions are internal', async () => {
    const { getTelegramTransport } = await import('../lib/telegram.js')
    const ctx = makeCtx([
      { id: 'n1', action: 'delay', params: {} },
      { id: 'n2', action: 'api_call', params: {} },
    ])
    await dispatchActions(ctx)
    expect(getTelegramTransport).not.toHaveBeenCalled()
  })
})
