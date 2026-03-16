import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getContext, setContext, deleteContext, listContextKeys } from '../lib/flow-engine/context-store.js'

const mockPrisma = {
  userFlowContext: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
}

describe('context-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getContext', () => {
    it('returns value when key exists', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue({
        id: '1',
        platformUserId: 'user-123',
        platform: 'telegram',
        key: 'language',
        value: 'pl',
      })

      const result = await getContext(mockPrisma as any, 'user-123', 'telegram', 'language')
      expect(result).toBe('pl')
      expect(mockPrisma.userFlowContext.findUnique).toHaveBeenCalledWith({
        where: {
          platformUserId_platform_key: {
            platformUserId: 'user-123',
            platform: 'telegram',
            key: 'language',
          },
        },
      })
    })

    it('returns defaultValue when key does not exist', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)

      const result = await getContext(mockPrisma as any, 'user-123', 'telegram', 'language', 'en')
      expect(result).toBe('en')
    })

    it('returns undefined when key does not exist and no default', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)

      const result = await getContext(mockPrisma as any, 'user-123', 'telegram', 'language')
      expect(result).toBeUndefined()
    })
  })

  describe('setContext', () => {
    it('upserts value for user+platform+key', async () => {
      mockPrisma.userFlowContext.upsert.mockResolvedValue({
        id: '1',
        platformUserId: 'user-123',
        platform: 'telegram',
        key: 'language',
        value: 'pl',
      })

      await setContext(mockPrisma as any, 'user-123', 'telegram', 'language', 'pl')
      expect(mockPrisma.userFlowContext.upsert).toHaveBeenCalledWith({
        where: {
          platformUserId_platform_key: {
            platformUserId: 'user-123',
            platform: 'telegram',
            key: 'language',
          },
        },
        update: { value: 'pl' },
        create: {
          platformUserId: 'user-123',
          platform: 'telegram',
          key: 'language',
          value: 'pl',
        },
      })
    })
  })

  describe('deleteContext', () => {
    it('deletes existing key', async () => {
      mockPrisma.userFlowContext.delete.mockResolvedValue({})

      await deleteContext(mockPrisma as any, 'user-123', 'telegram', 'language')
      expect(mockPrisma.userFlowContext.delete).toHaveBeenCalledWith({
        where: {
          platformUserId_platform_key: {
            platformUserId: 'user-123',
            platform: 'telegram',
            key: 'language',
          },
        },
      })
    })

    it('does not throw when key does not exist', async () => {
      mockPrisma.userFlowContext.delete.mockRejectedValue({ code: 'P2025' })

      await expect(
        deleteContext(mockPrisma as any, 'user-123', 'telegram', 'nonexistent'),
      ).resolves.toBeUndefined()
    })
  })

  describe('listContextKeys', () => {
    it('returns all keys for a user+platform', async () => {
      mockPrisma.userFlowContext.findMany.mockResolvedValue([
        { key: 'language', value: 'pl' },
        { key: 'onboarding_step', value: 3 },
      ])

      const result = await listContextKeys(mockPrisma as any, 'user-123', 'telegram')
      expect(result).toEqual([
        { key: 'language', value: 'pl' },
        { key: 'onboarding_step', value: 3 },
      ])
    })
  })
})
