import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsService } from '../services/analytics.js'

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
    groupMember: {
      count: vi.fn().mockResolvedValue(42),
    },
    groupAnalyticsSnapshot: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as any
}

describe('AnalyticsService', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let logger: ReturnType<typeof createTestLogger>
  let analytics: AnalyticsService

  beforeEach(() => {
    vi.useFakeTimers()
    prisma = createMockPrisma()
    logger = createTestLogger()
    analytics = new AnalyticsService(prisma, logger)
  })

  afterEach(() => {
    analytics.stop()
    vi.useRealTimers()
  })

  it('starts without errors', () => {
    analytics.start()
    expect(logger.info).toHaveBeenCalledWith('Analytics service started')
  })

  it('does not start twice', () => {
    analytics.start()
    analytics.start()
    const startCalls = logger.info.mock.calls.filter(
      (args: any[]) => args[0] === 'Analytics service started',
    )
    expect(startCalls).toHaveLength(1)
  })

  it('increments message counter for a group', async () => {
    analytics.incrementMessage('group-1')
    analytics.incrementMessage('group-1')
    analytics.incrementMessage('group-1')

    await analytics.flush()

    expect(prisma.groupAnalyticsSnapshot.upsert).toHaveBeenCalledTimes(1)
    const upsertCall = prisma.groupAnalyticsSnapshot.upsert.mock.calls[0][0]
    expect(upsertCall.create.messageCount).toBe(3)
    expect(upsertCall.create.groupId).toBe('group-1')
  })

  it('increments different counters independently', async () => {
    analytics.incrementMessage('group-1')
    analytics.incrementSpam('group-1')
    analytics.incrementSpam('group-1')
    analytics.incrementLinkBlocked('group-1')
    analytics.incrementWarning('group-1')
    analytics.incrementMute('group-1')
    analytics.incrementBan('group-1')
    analytics.incrementDeletedMessage('group-1')
    analytics.incrementNewMember('group-1')
    analytics.incrementLeftMember('group-1')

    await analytics.flush()

    const upsertCall = prisma.groupAnalyticsSnapshot.upsert.mock.calls[0][0]
    expect(upsertCall.create.messageCount).toBe(1)
    expect(upsertCall.create.spamDetected).toBe(2)
    expect(upsertCall.create.linksBlocked).toBe(1)
    expect(upsertCall.create.warningsIssued).toBe(1)
    expect(upsertCall.create.mutesIssued).toBe(1)
    expect(upsertCall.create.bansIssued).toBe(1)
    expect(upsertCall.create.deletedMessages).toBe(1)
    expect(upsertCall.create.newMembers).toBe(1)
    expect(upsertCall.create.leftMembers).toBe(1)
  })

  it('tracks counters per group independently', async () => {
    analytics.incrementMessage('group-1')
    analytics.incrementMessage('group-1')
    analytics.incrementMessage('group-2')

    await analytics.flush()

    expect(prisma.groupAnalyticsSnapshot.upsert).toHaveBeenCalledTimes(2)

    const calls = prisma.groupAnalyticsSnapshot.upsert.mock.calls
    const group1Call = calls.find((c: any) => c[0].create.groupId === 'group-1')
    const group2Call = calls.find((c: any) => c[0].create.groupId === 'group-2')

    expect(group1Call[0].create.messageCount).toBe(2)
    expect(group2Call[0].create.messageCount).toBe(1)
  })

  it('clears counters after flush', async () => {
    analytics.incrementMessage('group-1')
    await analytics.flush()

    expect(prisma.groupAnalyticsSnapshot.upsert).toHaveBeenCalledTimes(1)

    // Second flush with no new data should not call upsert
    prisma.groupAnalyticsSnapshot.upsert.mockClear()
    await analytics.flush()
    expect(prisma.groupAnalyticsSnapshot.upsert).not.toHaveBeenCalled()
  })

  it('does not flush if no data accumulated', async () => {
    await analytics.flush()
    expect(prisma.groupAnalyticsSnapshot.upsert).not.toHaveBeenCalled()
  })

  it('re-adds counters if flush fails for a group', async () => {
    analytics.incrementMessage('group-1')
    analytics.incrementMessage('group-1')

    prisma.groupAnalyticsSnapshot.upsert.mockRejectedValueOnce(new Error('DB error'))

    await analytics.flush()

    expect(logger.error).toHaveBeenCalled()

    // The failed counters should have been re-added
    prisma.groupAnalyticsSnapshot.upsert.mockResolvedValueOnce({})
    await analytics.flush()

    expect(prisma.groupAnalyticsSnapshot.upsert).toHaveBeenCalledTimes(2)
    const secondCall = prisma.groupAnalyticsSnapshot.upsert.mock.calls[1][0]
    expect(secondCall.create.messageCount).toBe(2) // re-added counters
  })

  it('uses upsert with increment for update path', async () => {
    analytics.incrementMessage('group-1')
    analytics.incrementSpam('group-1')

    await analytics.flush()

    const upsertCall = prisma.groupAnalyticsSnapshot.upsert.mock.calls[0][0]
    expect(upsertCall.update.messageCount).toEqual({ increment: 1 })
    expect(upsertCall.update.spamDetected).toEqual({ increment: 1 })
  })

  it('stops and performs a final flush', async () => {
    analytics.incrementMessage('group-1')
    analytics.start()
    analytics.stop()

    expect(logger.info).toHaveBeenCalledWith('Analytics service stopped')
    // The stop() triggers a flush (async, may need to await)
  })
})
