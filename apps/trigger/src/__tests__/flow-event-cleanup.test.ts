import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  getPrisma: vi.fn(() => ({})),
}))

import { cleanupExpiredEvents } from '../trigger/flow-event-cleanup.js'

describe('flow-event-cleanup logic', () => {
  it('deletes events where expiresAt < now', async () => {
    const mockPrisma = {
      flowEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 42 }),
      },
    }

    const result = await cleanupExpiredEvents(mockPrisma as any)

    expect(mockPrisma.flowEvent.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    })
    expect(result).toEqual({ deletedCount: 42 })
  })

  it('returns 0 when no expired events', async () => {
    const mockPrisma = {
      flowEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    }

    const result = await cleanupExpiredEvents(mockPrisma as any)
    expect(result).toEqual({ deletedCount: 0 })
  })
})
