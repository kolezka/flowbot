const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  adminIds: number[]
  expiresAt: number
}

export class AdminCacheService {
  private cache = new Map<string, CacheEntry>()
  private ttlMs: number

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  async getAdminIds(chatId: string, fetcher: () => Promise<number[]>): Promise<number[]> {
    const entry = this.cache.get(chatId)
    if (entry && entry.expiresAt > Date.now()) {
      return entry.adminIds
    }

    const adminIds = await fetcher()
    this.cache.set(chatId, {
      adminIds,
      expiresAt: Date.now() + this.ttlMs,
    })
    return adminIds
  }

  invalidate(chatId: string): void {
    this.cache.delete(chatId)
  }
}
