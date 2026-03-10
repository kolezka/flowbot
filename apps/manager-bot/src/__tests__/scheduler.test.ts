import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SchedulerService } from '../services/scheduler.js'

function createTestLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as any
}

function createMockPrisma() {
  return {
    scheduledMessage: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any
}

function createMockApi() {
  return {
    sendMessage: vi.fn().mockResolvedValue({}),
  } as any
}

describe('SchedulerService', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let api: ReturnType<typeof createMockApi>
  let logger: ReturnType<typeof createTestLogger>
  let scheduler: SchedulerService

  beforeEach(() => {
    vi.useFakeTimers()
    prisma = createMockPrisma()
    api = createMockApi()
    logger = createTestLogger()
    scheduler = new SchedulerService(prisma, api, logger)
  })

  afterEach(() => {
    scheduler.stop()
    vi.useRealTimers()
  })

  it('starts polling loop with setInterval', () => {
    scheduler.start()
    expect(logger.info).toHaveBeenCalledWith('Scheduler started')
  })

  it('does not start twice', () => {
    scheduler.start()
    scheduler.start()
    // Logger should only log "Scheduler started" once
    const startCalls = logger.info.mock.calls.filter(
      (args: any[]) => args[0] === 'Scheduler started',
    )
    expect(startCalls).toHaveLength(1)
  })

  it('polls for pending messages and dispatches them', async () => {
    const pendingMessages = [
      { id: 'msg-1', chatId: BigInt(12345), text: '<b>Hello</b>', sendAt: new Date() },
      { id: 'msg-2', chatId: BigInt(67890), text: 'World', sendAt: new Date() },
    ]
    prisma.scheduledMessage.findMany.mockResolvedValue(pendingMessages)

    scheduler.start()

    // Let the initial poll (which runs immediately) complete
    await vi.advanceTimersByTimeAsync(0)

    expect(prisma.scheduledMessage.findMany).toHaveBeenCalled()
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    expect(api.sendMessage).toHaveBeenCalledWith(12345, '<b>Hello</b>', { parse_mode: 'HTML' })
    expect(api.sendMessage).toHaveBeenCalledWith(67890, 'World', { parse_mode: 'HTML' })

    // Messages should be marked as sent
    expect(prisma.scheduledMessage.update).toHaveBeenCalledTimes(2)
    expect(prisma.scheduledMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ sent: true }),
      }),
    )
  })

  it('handles errors for individual messages without stopping the loop', async () => {
    const pendingMessages = [
      { id: 'msg-1', chatId: BigInt(12345), text: 'Hello', sendAt: new Date() },
      { id: 'msg-2', chatId: BigInt(67890), text: 'World', sendAt: new Date() },
    ]
    prisma.scheduledMessage.findMany.mockResolvedValue(pendingMessages)
    api.sendMessage
      .mockRejectedValueOnce(new Error('chat not found'))
      .mockResolvedValueOnce({})

    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)

    // First message failed, second succeeded
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    expect(prisma.scheduledMessage.update).toHaveBeenCalledTimes(1) // only the second one
    expect(logger.error).toHaveBeenCalled()
  })

  it('polls again after the interval', async () => {
    prisma.scheduledMessage.findMany.mockResolvedValue([])

    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(prisma.scheduledMessage.findMany).toHaveBeenCalledTimes(1)

    // Advance by 30 seconds (POLL_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(prisma.scheduledMessage.findMany).toHaveBeenCalledTimes(2)
  })

  it('stops cleanly', () => {
    scheduler.start()
    scheduler.stop()
    expect(logger.info).toHaveBeenCalledWith('Scheduler stopped')
  })
})
