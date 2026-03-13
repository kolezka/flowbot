import { describe, expect, it, vi } from 'vitest'
import { createApiServer } from '../../server/index.js'

function createMockBotApi() {
  return {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
    sendPhoto: vi.fn().mockResolvedValue({ message_id: 2 }),
    sendVideo: vi.fn().mockResolvedValue({ message_id: 3 }),
    sendDocument: vi.fn().mockResolvedValue({ message_id: 4 }),
    sendSticker: vi.fn().mockResolvedValue({ message_id: 5 }),
    sendVoice: vi.fn().mockResolvedValue({ message_id: 6 }),
    sendAudio: vi.fn().mockResolvedValue({ message_id: 7 }),
    sendAnimation: vi.fn().mockResolvedValue({ message_id: 8 }),
    sendLocation: vi.fn().mockResolvedValue({ message_id: 9 }),
    sendContact: vi.fn().mockResolvedValue({ message_id: 10 }),
    sendVenue: vi.fn().mockResolvedValue({ message_id: 11 }),
    sendDice: vi.fn().mockResolvedValue({ message_id: 12 }),
    forwardMessage: vi.fn().mockResolvedValue({ message_id: 13 }),
    copyMessage: vi.fn().mockResolvedValue({ message_id: 14 }),
    editMessageText: vi.fn().mockResolvedValue(true),
    deleteMessage: vi.fn().mockResolvedValue(true),
    pinChatMessage: vi.fn().mockResolvedValue(true),
    unpinChatMessage: vi.fn().mockResolvedValue(true),
    unpinAllChatMessages: vi.fn().mockResolvedValue(true),
    banChatMember: vi.fn().mockResolvedValue(true),
    restrictChatMember: vi.fn().mockResolvedValue(true),
    promoteChatMember: vi.fn().mockResolvedValue(true),
    setChatTitle: vi.fn().mockResolvedValue(true),
    setChatDescription: vi.fn().mockResolvedValue(true),
    exportChatInviteLink: vi.fn().mockResolvedValue('https://t.me/+invite'),
    getChatMember: vi.fn().mockResolvedValue({ user: { id: 42 }, status: 'member' }),
    leaveChat: vi.fn().mockResolvedValue(true),
    sendPoll: vi.fn().mockResolvedValue({ message_id: 15 }),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
  } as any
}

function createMockDeps(botApi = createMockBotApi()) {
  return {
    botApi,
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
    prisma: { managedGroup: { count: vi.fn().mockResolvedValue(0) } } as any,
  }
}

function execAction(app: ReturnType<typeof createApiServer>, action: string, params: Record<string, unknown> = {}) {
  return app.request('/api/execute-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
}

describe('POST /api/execute-action', () => {
  // --- Messaging ---

  describe('messaging actions', () => {
    it('send_message', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'send_message', { chatId: '100', text: 'hi' })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json).toEqual({ success: true, result: { messageId: 1 } })
      expect(deps.botApi.sendMessage).toHaveBeenCalledWith('100', 'hi', expect.objectContaining({ parse_mode: 'HTML' }))
    })

    it('send_photo', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'send_photo', { chatId: '100', photoUrl: 'https://img.png', caption: 'nice' })

      expect(res.status).toBe(200)
      expect(deps.botApi.sendPhoto).toHaveBeenCalledWith('100', 'https://img.png', expect.objectContaining({ caption: 'nice' }))
    })

    it('send_video', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'send_video', { chatId: '100', videoUrl: 'https://vid.mp4' })

      expect(res.status).toBe(200)
      expect(deps.botApi.sendVideo).toHaveBeenCalledWith('100', 'https://vid.mp4', expect.any(Object))
    })

    it('send_location', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'send_location', { chatId: '100', latitude: 51.5, longitude: -0.1 })

      expect(res.status).toBe(200)
      expect(deps.botApi.sendLocation).toHaveBeenCalledWith('100', 51.5, -0.1)
    })

    it('send_contact', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'send_contact', { chatId: '100', phoneNumber: '+1234', firstName: 'John', lastName: 'Doe' })

      expect(res.status).toBe(200)
      expect(deps.botApi.sendContact).toHaveBeenCalledWith('100', '+1234', 'John', { last_name: 'Doe' })
    })

    it('send_dice', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'send_dice', { chatId: '100' })

      expect(res.status).toBe(200)
      expect(deps.botApi.sendDice).toHaveBeenCalledWith('100', '\u{1F3B2}')
    })
  })

  // --- Message management ---

  describe('message management actions', () => {
    it('forward_message', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'forward_message', { toChatId: '200', fromChatId: '100', messageId: 5 })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ messageId: 13 })
      expect(deps.botApi.forwardMessage).toHaveBeenCalledWith('200', '100', 5)
    })

    it('copy_message', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'copy_message', { toChatId: '200', fromChatId: '100', messageId: 5 })

      expect(res.status).toBe(200)
      expect(deps.botApi.copyMessage).toHaveBeenCalledWith('200', '100', 5)
    })

    it('edit_message', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'edit_message', { chatId: '100', messageId: 5, text: 'updated' })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ edited: true })
      expect(deps.botApi.editMessageText).toHaveBeenCalledWith('100', 5, 'updated', expect.any(Object))
    })

    it('delete_message', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'delete_message', { chatId: '100', messageId: 5 })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ deleted: true })
      expect(deps.botApi.deleteMessage).toHaveBeenCalledWith('100', 5)
    })

    it('pin_message', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'pin_message', { chatId: '100', messageId: 5 })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ pinned: true })
      expect(deps.botApi.pinChatMessage).toHaveBeenCalledWith('100', 5, expect.any(Object))
    })

    it('unpin_message with messageId', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'unpin_message', { chatId: '100', messageId: 5 })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ unpinned: true })
      expect(deps.botApi.unpinChatMessage).toHaveBeenCalledWith('100', 5)
    })

    it('unpin_message without messageId unpins all', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'unpin_message', { chatId: '100' })

      expect(res.status).toBe(200)
      expect(deps.botApi.unpinAllChatMessages).toHaveBeenCalledWith('100')
    })
  })

  // --- User management ---

  describe('user management actions', () => {
    it('ban_user', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'ban_user', { chatId: '100', userId: 42 })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ banned: true })
      expect(deps.botApi.banChatMember).toHaveBeenCalledWith('100', 42)
    })

    it('mute_user', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'mute_user', { chatId: '100', userId: 42, permissions: {} })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ restricted: true })
      expect(deps.botApi.restrictChatMember).toHaveBeenCalled()
    })

    it('promote_user', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'promote_user', { chatId: '100', userId: 42, privileges: { canManageChat: true } })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ promoted: true })
      expect(deps.botApi.promoteChatMember).toHaveBeenCalledWith('100', 42, expect.objectContaining({ can_manage_chat: true }))
    })
  })

  // --- Chat management ---

  describe('chat management actions', () => {
    it('set_chat_title', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'set_chat_title', { chatId: '100', title: 'New Title' })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ updated: true })
      expect(deps.botApi.setChatTitle).toHaveBeenCalledWith('100', 'New Title')
    })

    it('set_chat_description', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'set_chat_description', { chatId: '100', description: 'A group' })

      expect(res.status).toBe(200)
      expect(deps.botApi.setChatDescription).toHaveBeenCalledWith('100', 'A group')
    })

    it('export_invite_link', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'export_invite_link', { chatId: '100' })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ inviteLink: 'https://t.me/+invite' })
    })

    it('leave_chat', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'leave_chat', { chatId: '100' })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ left: true })
      expect(deps.botApi.leaveChat).toHaveBeenCalledWith('100')
    })
  })

  // --- Interactive ---

  describe('interactive actions', () => {
    it('create_poll', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'create_poll', {
        chatId: '100',
        question: 'Favorite?',
        options: ['A', 'B', 'C'],
        isAnonymous: true,
      })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ messageId: 15 })
      expect(deps.botApi.sendPoll).toHaveBeenCalledWith(
        '100',
        'Favorite?',
        [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
        expect.objectContaining({ is_anonymous: true }),
      )
    })

    it('answer_callback_query', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'answer_callback_query', {
        chatId: '100',
        callbackQueryId: 'cq-1',
        text: 'Done!',
        showAlert: true,
      })

      expect(res.status).toBe(200)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.result).toEqual({ answered: true })
      expect(deps.botApi.answerCallbackQuery).toHaveBeenCalledWith('cq-1', expect.objectContaining({ text: 'Done!', show_alert: true }))
    })
  })

  // --- Error cases ---

  describe('error cases', () => {
    it('should return 400 when action is missing', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await app.request('/api/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: {} }),
      })

      expect(res.status).toBe(400)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.success).toBe(false)
      expect(json.error).toContain('action')
    })

    it('should return 400 for unknown action', async () => {
      const deps = createMockDeps()
      const app = createApiServer(deps)
      const res = await execAction(app, 'nonexistent_action', { chatId: '100' })

      expect(res.status).toBe(400)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.success).toBe(false)
      expect(json.error).toContain('Unknown action')
    })

    it('should return 500 when bot method throws', async () => {
      const deps = createMockDeps()
      deps.botApi.sendMessage.mockRejectedValue(new Error('Bot token revoked'))
      const app = createApiServer(deps)
      const res = await execAction(app, 'send_message', { chatId: '100', text: 'hi' })

      expect(res.status).toBe(500)
      const json = (await res.json()) as Record<string, unknown>
      expect(json.success).toBe(false)
      expect(json.error).toBe('Bot token revoked')
    })
  })
})
