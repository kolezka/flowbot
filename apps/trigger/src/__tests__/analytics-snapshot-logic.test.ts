import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@trigger.dev/sdk/v3', () => ({
  schedules: { task: (opts: any) => opts },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { analyticsSnapshotTask } = await import('../trigger/analytics-snapshot.js') as any
import { getPrisma } from '../lib/prisma.js'

function createMockPrisma() {
  return {
    managedGroup: {
      findMany: vi.fn(),
    },
    moderationLog: {
      findMany: vi.fn(),
    },
    groupMember: {
      count: vi.fn(),
    },
    groupAnalyticsSnapshot: {
      upsert: vi.fn(),
    },
  }
}

describe('analytics-snapshot task logic', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)
  })

  it('should return zeros when no active groups', async () => {
    mockPrisma.managedGroup.findMany.mockResolvedValue([])

    const result = await analyticsSnapshotTask.run()

    expect(result).toEqual({
      totalGroups: 0,
      succeeded: 0,
      failed: 0,
    })
  })

  it('should aggregate action counts from moderation logs', async () => {
    mockPrisma.managedGroup.findMany.mockResolvedValue([
      { id: 'g1', chatId: BigInt(100), title: 'Group 1' },
    ])
    mockPrisma.moderationLog.findMany.mockResolvedValue([
      { action: 'warn' },
      { action: 'warn' },
      { action: 'ban' },
      { action: 'spam_detected' },
      { action: 'spam_detected' },
      { action: 'spam_detected' },
    ])
    mockPrisma.groupMember.count.mockResolvedValue(50)
    mockPrisma.groupAnalyticsSnapshot.upsert.mockResolvedValue({})

    const result = await analyticsSnapshotTask.run()

    expect(result).toEqual({
      totalGroups: 1,
      succeeded: 1,
      failed: 0,
    })

    const upsertCall = mockPrisma.groupAnalyticsSnapshot.upsert.mock.calls[0]![0] as any
    expect(upsertCall.create.warningsIssued).toBe(2)
    expect(upsertCall.create.bansIssued).toBe(1)
    expect(upsertCall.create.spamDetected).toBe(3)
    expect(upsertCall.create.memberCount).toBe(50)
  })

  it('should calculate member delta from join/leave logs', async () => {
    mockPrisma.managedGroup.findMany.mockResolvedValue([
      { id: 'g1', chatId: BigInt(100), title: 'Group 1' },
    ])
    mockPrisma.moderationLog.findMany.mockResolvedValue([
      { action: 'member_join' },
      { action: 'member_join' },
      { action: 'member_join' },
      { action: 'member_leave' },
    ])
    mockPrisma.groupMember.count.mockResolvedValue(25)
    mockPrisma.groupAnalyticsSnapshot.upsert.mockResolvedValue({})

    await analyticsSnapshotTask.run()

    const upsertCall = mockPrisma.groupAnalyticsSnapshot.upsert.mock.calls[0]![0] as any
    expect(upsertCall.create.newMembers).toBe(3)
    expect(upsertCall.create.leftMembers).toBe(1)
  })

  it('should upsert snapshot with correct groupId and date', async () => {
    mockPrisma.managedGroup.findMany.mockResolvedValue([
      { id: 'g1', chatId: BigInt(100), title: 'Group 1' },
    ])
    mockPrisma.moderationLog.findMany.mockResolvedValue([])
    mockPrisma.groupMember.count.mockResolvedValue(10)
    mockPrisma.groupAnalyticsSnapshot.upsert.mockResolvedValue({})

    await analyticsSnapshotTask.run()

    const upsertCall = mockPrisma.groupAnalyticsSnapshot.upsert.mock.calls[0]![0] as any
    expect(upsertCall.where.groupId_date.groupId).toBe('g1')
    expect(upsertCall.where.groupId_date.date).toBeInstanceOf(Date)
    expect(upsertCall.create.groupId).toBe('g1')
    expect(upsertCall.create.memberCount).toBe(10)
    // Defaults to 0 for missing actions
    expect(upsertCall.create.spamDetected).toBe(0)
    expect(upsertCall.create.linksBlocked).toBe(0)
    expect(upsertCall.create.warningsIssued).toBe(0)
    expect(upsertCall.create.mutesIssued).toBe(0)
    expect(upsertCall.create.bansIssued).toBe(0)
    expect(upsertCall.create.deletedMessages).toBe(0)
    expect(upsertCall.create.messageCount).toBe(0)
  })

  it('should handle multiple groups', async () => {
    mockPrisma.managedGroup.findMany.mockResolvedValue([
      { id: 'g1', chatId: BigInt(100), title: 'Group 1' },
      { id: 'g2', chatId: BigInt(200), title: 'Group 2' },
    ])
    mockPrisma.moderationLog.findMany.mockResolvedValue([])
    mockPrisma.groupMember.count.mockResolvedValue(5)
    mockPrisma.groupAnalyticsSnapshot.upsert.mockResolvedValue({})

    const result = await analyticsSnapshotTask.run()

    expect(result).toEqual({
      totalGroups: 2,
      succeeded: 2,
      failed: 0,
    })
    expect(mockPrisma.groupAnalyticsSnapshot.upsert).toHaveBeenCalledTimes(2)
  })

  it('should handle errors for individual groups without failing all', async () => {
    mockPrisma.managedGroup.findMany.mockResolvedValue([
      { id: 'g1', chatId: BigInt(100), title: 'Group 1' },
      { id: 'g2', chatId: BigInt(200), title: 'Group 2' },
    ])
    // First group succeeds
    mockPrisma.moderationLog.findMany
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('DB timeout'))
    mockPrisma.groupMember.count.mockResolvedValue(5)
    mockPrisma.groupAnalyticsSnapshot.upsert.mockResolvedValue({})

    const result = await analyticsSnapshotTask.run()

    expect(result).toEqual({
      totalGroups: 2,
      succeeded: 1,
      failed: 1,
    })
  })
})
