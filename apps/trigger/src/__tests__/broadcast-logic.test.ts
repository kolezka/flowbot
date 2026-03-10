import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before imports
vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(),
}))

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
const { broadcastTask } = await import('../trigger/broadcast.js') as any
import { getPrisma } from '../lib/prisma.js'
import { getTelegramTransport } from '../lib/telegram.js'

function createMockPrisma() {
  return {
    broadcastMessage: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }
}

function createMockTransport() {
  return {
    sendMessage: vi.fn(),
  }
}

describe('broadcast task logic', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>
  let mockTransport: ReturnType<typeof createMockTransport>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockTransport = createMockTransport()
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)
    vi.mocked(getTelegramTransport).mockResolvedValue(mockTransport as any)
  })

  it('should throw if broadcast is not found', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue(null)

    await expect(broadcastTask.run({ broadcastId: 'missing' })).rejects.toThrow(
      'BroadcastMessage missing not found',
    )
  })

  it('should skip non-pending broadcasts', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'completed',
      targetChatIds: [],
      text: 'hello',
    })

    const result = await broadcastTask.run({ broadcastId: 'b1' })

    expect(result).toEqual({ skipped: true, reason: 'Status is completed' })
    expect(mockPrisma.broadcastMessage.update).not.toHaveBeenCalled()
  })

  it('should mark broadcast as sending then completed on success', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'pending',
      targetChatIds: [BigInt(111), BigInt(222)],
      text: 'Hello!',
    })
    mockTransport.sendMessage.mockResolvedValue({ id: 42 })
    mockPrisma.broadcastMessage.update.mockResolvedValue({})

    const result = await broadcastTask.run({ broadcastId: 'b1' })

    // First update: mark as sending
    expect(mockPrisma.broadcastMessage.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: 'sending' },
    })
    // Second update: mark as completed with results
    expect(mockPrisma.broadcastMessage.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: {
        status: 'completed',
        results: expect.arrayContaining([
          expect.objectContaining({ chatId: '111', success: true, messageId: 42 }),
          expect.objectContaining({ chatId: '222', success: true, messageId: 42 }),
        ]),
      },
    })
    expect(result.status).toBe('completed')
    expect(result.results).toHaveLength(2)
  })

  it('should mark broadcast as failed if any message fails', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'pending',
      targetChatIds: [BigInt(111)],
      text: 'Hello!',
    })
    mockTransport.sendMessage.mockRejectedValue(new Error('Rate limited'))
    mockPrisma.broadcastMessage.update.mockResolvedValue({})

    const result = await broadcastTask.run({ broadcastId: 'b1' })

    expect(mockPrisma.broadcastMessage.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: {
        status: 'failed',
        results: [
          { chatId: '111', success: false, error: 'Rate limited' },
        ],
      },
    })
    expect(result.status).toBe('failed')
  })

  it('should send messages to all target chat IDs', async () => {
    const targetIds = [BigInt(100), BigInt(200), BigInt(300)]
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'pending',
      targetChatIds: targetIds,
      text: 'Broadcast!',
    })
    mockTransport.sendMessage.mockResolvedValue({ id: 1 })
    mockPrisma.broadcastMessage.update.mockResolvedValue({})

    await broadcastTask.run({ broadcastId: 'b1' })

    expect(mockTransport.sendMessage).toHaveBeenCalledTimes(3)
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('100', 'Broadcast!')
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('200', 'Broadcast!')
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('300', 'Broadcast!')
  })

  it('should handle partial failures (some succeed, some fail)', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'pending',
      targetChatIds: [BigInt(111), BigInt(222)],
      text: 'Hello!',
    })
    mockTransport.sendMessage
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error('Chat not found'))
    mockPrisma.broadcastMessage.update.mockResolvedValue({})

    const result = await broadcastTask.run({ broadcastId: 'b1' })

    // Not all succeeded, so status is failed
    expect(result.status).toBe('failed')
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toEqual(expect.objectContaining({ chatId: '111', success: true }))
    expect(result.results[1]).toEqual(expect.objectContaining({ chatId: '222', success: false }))
  })

  it('should handle non-Error thrown objects', async () => {
    mockPrisma.broadcastMessage.findUnique.mockResolvedValue({
      id: 'b1',
      status: 'pending',
      targetChatIds: [BigInt(111)],
      text: 'Hello!',
    })
    mockTransport.sendMessage.mockRejectedValue('string error')
    mockPrisma.broadcastMessage.update.mockResolvedValue({})

    const result = await broadcastTask.run({ broadcastId: 'b1' })

    expect(result.results[0].error).toBe('Unknown error')
  })
})
