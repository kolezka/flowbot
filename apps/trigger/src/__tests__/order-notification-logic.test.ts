import { describe, it, expect, vi, beforeEach } from 'vitest'

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
const { orderNotificationTask } = await import('../trigger/order-notification.js') as any
import { getPrisma } from '../lib/prisma.js'
import { getTelegramTransport } from '../lib/telegram.js'

function createMockPrisma() {
  return {
    orderEvent: {
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

describe('order-notification task logic', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>
  let mockTransport: ReturnType<typeof createMockTransport>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockTransport = createMockTransport()
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)
    vi.mocked(getTelegramTransport).mockResolvedValue(mockTransport as any)
  })

  it('should throw if order event is not found', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue(null)

    await expect(
      orderNotificationTask.run({ orderEventId: 'missing' }),
    ).rejects.toThrow('OrderEvent missing not found')
  })

  it('should skip already processed events', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue({
      id: 'oe1',
      processed: true,
      eventType: 'order_placed',
      orderData: {},
      targetChatIds: [],
    })

    const result = await orderNotificationTask.run({ orderEventId: 'oe1' })

    expect(result).toEqual({ skipped: true, reason: 'Already processed' })
  })

  it('should format order_placed message correctly', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue({
      id: 'oe1',
      processed: false,
      eventType: 'order_placed',
      orderData: { productName: 'Cool Shoes' },
      targetChatIds: [BigInt(111)],
    })
    mockTransport.sendMessage.mockResolvedValue({})
    mockPrisma.orderEvent.update.mockResolvedValue({})

    await orderNotificationTask.run({ orderEventId: 'oe1' })

    expect(mockTransport.sendMessage).toHaveBeenCalledWith(
      '111',
      'Someone just purchased Cool Shoes!',
    )
  })

  it('should format order_shipped message correctly', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue({
      id: 'oe1',
      processed: false,
      eventType: 'order_shipped',
      orderData: { productName: 'Widget' },
      targetChatIds: [BigInt(111)],
    })
    mockTransport.sendMessage.mockResolvedValue({})
    mockPrisma.orderEvent.update.mockResolvedValue({})

    await orderNotificationTask.run({ orderEventId: 'oe1' })

    expect(mockTransport.sendMessage).toHaveBeenCalledWith(
      '111',
      'An order of Widget has been shipped!',
    )
  })

  it('should format unknown event types with default message', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue({
      id: 'oe1',
      processed: false,
      eventType: 'order_cancelled',
      orderData: { productName: 'Gadget' },
      targetChatIds: [BigInt(111)],
    })
    mockTransport.sendMessage.mockResolvedValue({})
    mockPrisma.orderEvent.update.mockResolvedValue({})

    await orderNotificationTask.run({ orderEventId: 'oe1' })

    expect(mockTransport.sendMessage).toHaveBeenCalledWith(
      '111',
      'New order event: order_cancelled for Gadget',
    )
  })

  it('should use fallback product name when not provided', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue({
      id: 'oe1',
      processed: false,
      eventType: 'order_placed',
      orderData: {},
      targetChatIds: [BigInt(111)],
    })
    mockTransport.sendMessage.mockResolvedValue({})
    mockPrisma.orderEvent.update.mockResolvedValue({})

    await orderNotificationTask.run({ orderEventId: 'oe1' })

    expect(mockTransport.sendMessage).toHaveBeenCalledWith(
      '111',
      'Someone just purchased an item!',
    )
  })

  it('should mark event as processed after sending', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue({
      id: 'oe1',
      processed: false,
      eventType: 'order_placed',
      orderData: { productName: 'Test' },
      targetChatIds: [BigInt(111)],
    })
    mockTransport.sendMessage.mockResolvedValue({})
    mockPrisma.orderEvent.update.mockResolvedValue({})

    await orderNotificationTask.run({ orderEventId: 'oe1' })

    expect(mockPrisma.orderEvent.update).toHaveBeenCalledWith({
      where: { id: 'oe1' },
      data: { processed: true },
    })
  })

  it('should handle send failures gracefully and still mark as processed', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue({
      id: 'oe1',
      processed: false,
      eventType: 'order_placed',
      orderData: { productName: 'Test' },
      targetChatIds: [BigInt(111), BigInt(222)],
    })
    mockTransport.sendMessage
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Failed'))
    mockPrisma.orderEvent.update.mockResolvedValue({})

    const result = await orderNotificationTask.run({ orderEventId: 'oe1' })

    expect(result.results).toHaveLength(2)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(false)
    expect(result.results[1].error).toBe('Failed')
    // Still marks as processed
    expect(mockPrisma.orderEvent.update).toHaveBeenCalledWith({
      where: { id: 'oe1' },
      data: { processed: true },
    })
  })

  it('should handle non-Error thrown objects', async () => {
    mockPrisma.orderEvent.findUnique.mockResolvedValue({
      id: 'oe1',
      processed: false,
      eventType: 'order_placed',
      orderData: {},
      targetChatIds: [BigInt(111)],
    })
    mockTransport.sendMessage.mockRejectedValue(42)
    mockPrisma.orderEvent.update.mockResolvedValue({})

    const result = await orderNotificationTask.run({ orderEventId: 'oe1' })

    expect(result.results[0].error).toBe('Unknown error')
  })
})
