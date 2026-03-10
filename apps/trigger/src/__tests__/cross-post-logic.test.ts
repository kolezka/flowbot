import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/telegram.js', () => ({
  getTelegramTransport: vi.fn(),
  getTelegramLogger: vi.fn(() => ({
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
    }),
  })),
}))

vi.mock('@trigger.dev/sdk/v3', () => ({
  task: (opts: any) => opts,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { crossPostTask } = await import('../trigger/cross-post.js') as any
import { getTelegramTransport } from '../lib/telegram.js'

function createMockTransport() {
  return {
    sendMessage: vi.fn(),
  }
}

describe('cross-post task logic', () => {
  let mockTransport: ReturnType<typeof createMockTransport>

  beforeEach(() => {
    mockTransport = createMockTransport()
    vi.mocked(getTelegramTransport).mockResolvedValue(mockTransport as any)
  })

  it('should send message to multiple chats successfully', async () => {
    mockTransport.sendMessage
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ id: 20 })
      .mockResolvedValueOnce({ id: 30 })

    const result = await crossPostTask.run({
      templateId: 'tpl-1',
      messageText: 'Hello cross-post!',
      targetChatIds: ['100', '200', '300'],
    })

    expect(result.results).toHaveLength(3)
    expect(result.results[0]).toEqual({ chatId: '100', success: true, messageId: 10 })
    expect(result.results[1]).toEqual({ chatId: '200', success: true, messageId: 20 })
    expect(result.results[2]).toEqual({ chatId: '300', success: true, messageId: 30 })
    expect(mockTransport.sendMessage).toHaveBeenCalledTimes(3)
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('100', 'Hello cross-post!')
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('200', 'Hello cross-post!')
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('300', 'Hello cross-post!')
  })

  it('should handle partial failures', async () => {
    mockTransport.sendMessage
      .mockResolvedValueOnce({ id: 10 })
      .mockRejectedValueOnce(new Error('Chat not found'))
      .mockResolvedValueOnce({ id: 30 })

    const result = await crossPostTask.run({
      messageText: 'Test',
      targetChatIds: ['100', '200', '300'],
    })

    expect(result.results).toHaveLength(3)
    expect(result.results[0]).toEqual({ chatId: '100', success: true, messageId: 10 })
    expect(result.results[1]).toEqual({ chatId: '200', success: false, error: 'Chat not found' })
    expect(result.results[2]).toEqual({ chatId: '300', success: true, messageId: 30 })
  })

  it('should return empty results for empty target list', async () => {
    const result = await crossPostTask.run({
      messageText: 'Test',
      targetChatIds: [],
    })

    expect(result.results).toHaveLength(0)
    expect(mockTransport.sendMessage).not.toHaveBeenCalled()
  })

  it('should handle non-Error thrown objects', async () => {
    mockTransport.sendMessage.mockRejectedValue('string error')

    const result = await crossPostTask.run({
      messageText: 'Test',
      targetChatIds: ['100'],
    })

    expect(result.results[0]).toEqual({ chatId: '100', success: false, error: 'Unknown error' })
  })

  it('should handle all messages failing', async () => {
    mockTransport.sendMessage
      .mockRejectedValueOnce(new Error('Rate limited'))
      .mockRejectedValueOnce(new Error('Timeout'))

    const result = await crossPostTask.run({
      templateId: 'tpl-2',
      messageText: 'Failing',
      targetChatIds: ['100', '200'],
    })

    expect(result.results).toHaveLength(2)
    expect(result.results.every((r: any) => !r.success)).toBe(true)
    expect(result.results[0].error).toBe('Rate limited')
    expect(result.results[1].error).toBe('Timeout')
  })
})
