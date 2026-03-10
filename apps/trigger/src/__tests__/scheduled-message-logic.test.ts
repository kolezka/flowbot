import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('../lib/manager-bot.js', () => ({
  sendMessageViaManagerBot: vi.fn(),
}))

vi.mock('@trigger.dev/sdk/v3', () => ({
  schedules: { task: (opts: any) => opts },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { scheduledMessageTask } = await import('../trigger/scheduled-message.js') as any
import { getPrisma } from '../lib/prisma.js'
import { sendMessageViaManagerBot } from '../lib/manager-bot.js'

function createMockPrisma() {
  return {
    scheduledMessage: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  }
}

describe('scheduled-message task logic', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)
  })

  it('should return processed: 0 when no due messages', async () => {
    mockPrisma.scheduledMessage.findMany.mockResolvedValue([])

    const result = await scheduledMessageTask.run()

    expect(result).toEqual({ processed: 0 })
    expect(sendMessageViaManagerBot).not.toHaveBeenCalled()
  })

  it('should send due messages and mark them as sent', async () => {
    mockPrisma.scheduledMessage.findMany.mockResolvedValue([
      { id: 'msg-1', chatId: BigInt(111), text: 'Hello!' },
      { id: 'msg-2', chatId: BigInt(222), text: 'World!' },
    ])
    vi.mocked(sendMessageViaManagerBot)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
    mockPrisma.scheduledMessage.update.mockResolvedValue({})

    const result = await scheduledMessageTask.run()

    expect(result.processed).toBe(2)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(0)
    expect(sendMessageViaManagerBot).toHaveBeenCalledWith('111', 'Hello!')
    expect(sendMessageViaManagerBot).toHaveBeenCalledWith('222', 'World!')
    expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledTimes(2)
    expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { sent: true, sentAt: expect.any(Date) },
    })
  })

  it('should handle failed sends without marking as sent', async () => {
    mockPrisma.scheduledMessage.findMany.mockResolvedValue([
      { id: 'msg-1', chatId: BigInt(111), text: 'Hello!' },
    ])
    vi.mocked(sendMessageViaManagerBot).mockResolvedValue({
      success: false,
      error: 'Bot unreachable',
    })

    const result = await scheduledMessageTask.run()

    expect(result.processed).toBe(1)
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(1)
    expect(mockPrisma.scheduledMessage.update).not.toHaveBeenCalled()
  })

  it('should handle mixed success and failure', async () => {
    mockPrisma.scheduledMessage.findMany.mockResolvedValue([
      { id: 'msg-1', chatId: BigInt(111), text: 'OK' },
      { id: 'msg-2', chatId: BigInt(222), text: 'Fail' },
      { id: 'msg-3', chatId: BigInt(333), text: 'OK too' },
    ])
    vi.mocked(sendMessageViaManagerBot)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'Timeout' })
      .mockResolvedValueOnce({ success: true })
    mockPrisma.scheduledMessage.update.mockResolvedValue({})

    const result = await scheduledMessageTask.run()

    expect(result.processed).toBe(3)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledTimes(2)
    expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { sent: true, sentAt: expect.any(Date) },
    })
    expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-3' },
      data: { sent: true, sentAt: expect.any(Date) },
    })
  })

  it('should query only unsent messages that are due', async () => {
    mockPrisma.scheduledMessage.findMany.mockResolvedValue([])

    await scheduledMessageTask.run()

    expect(mockPrisma.scheduledMessage.findMany).toHaveBeenCalledWith({
      where: {
        sent: false,
        sendAt: { lte: expect.any(Date) },
      },
      take: 50,
      orderBy: { sendAt: 'asc' },
    })
  })
})
