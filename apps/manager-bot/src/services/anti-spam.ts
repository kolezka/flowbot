import type { AiClassifierService, Classification } from './ai-classifier.js'
import { createHash } from 'node:crypto'

interface UserActivity {
  timestamps: number[]
  contentHashes: Map<string, number[]>
  lastSeen: number
}

export type SpamVerdict = 'clean' | 'flood' | 'duplicate'

export interface AiSpamResult {
  isSpam: boolean
  classification: Classification
}

const MAX_USERS_PER_GROUP = 1000
const DUPLICATE_THRESHOLD = 3
const DUPLICATE_WINDOW_MS = 60000

export class AntiSpamService {
  private groups = new Map<string, Map<string, UserActivity>>()
  private aiClassifier: AiClassifierService | undefined

  setAiClassifier(classifier: AiClassifierService) {
    this.aiClassifier = classifier
  }

  get hasAiClassifier(): boolean {
    return this.aiClassifier !== undefined
  }

  async checkWithAi(text: string, threshold: number): Promise<AiSpamResult> {
    if (!this.aiClassifier) {
      return { isSpam: false, classification: { label: 'safe', confidence: 0, reason: 'ai not configured' } }
    }

    const classification = await this.aiClassifier.classifyContent(text)

    const isSpam = classification.label !== 'safe'
      && classification.label !== 'off-topic'
      && classification.confidence >= threshold

    return { isSpam, classification }
  }

  checkMessage(
    chatId: string,
    userId: string,
    text: string,
    maxMessages: number,
    windowSeconds: number,
  ): SpamVerdict {
    const groupMap = this.getOrCreateGroupMap(chatId)
    const activity = this.getOrCreateActivity(groupMap, userId)
    const now = Date.now()
    const windowMs = windowSeconds * 1000

    // Prune old timestamps
    activity.timestamps = activity.timestamps.filter(t => now - t < windowMs)
    activity.timestamps.push(now)
    activity.lastSeen = now

    // Flood detection
    if (activity.timestamps.length > maxMessages) {
      return 'flood'
    }

    // Duplicate detection
    const hash = this.hashContent(text)
    const hashTimestamps = activity.contentHashes.get(hash) ?? []
    const recentHashes = hashTimestamps.filter(t => now - t < DUPLICATE_WINDOW_MS)
    recentHashes.push(now)
    activity.contentHashes.set(hash, recentHashes)

    if (recentHashes.length >= DUPLICATE_THRESHOLD) {
      return 'duplicate'
    }

    // Prune old hash entries
    for (const [key, times] of activity.contentHashes) {
      const fresh = times.filter(t => now - t < DUPLICATE_WINDOW_MS)
      if (fresh.length === 0)
        activity.contentHashes.delete(key)
      else
        activity.contentHashes.set(key, fresh)
    }

    return 'clean'
  }

  private hashContent(text: string): string {
    const normalized = text.toLowerCase().replace(/\s+/g, '')
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  }

  private getOrCreateGroupMap(chatId: string): Map<string, UserActivity> {
    let groupMap = this.groups.get(chatId)
    if (!groupMap) {
      groupMap = new Map()
      this.groups.set(chatId, groupMap)
    }
    return groupMap
  }

  private getOrCreateActivity(groupMap: Map<string, UserActivity>, userId: string): UserActivity {
    let activity = groupMap.get(userId)
    if (!activity) {
      // LRU eviction
      if (groupMap.size >= MAX_USERS_PER_GROUP) {
        let oldestKey: string | undefined
        let oldestTime = Infinity
        for (const [key, val] of groupMap) {
          if (val.lastSeen < oldestTime) {
            oldestTime = val.lastSeen
            oldestKey = key
          }
        }
        if (oldestKey)
          groupMap.delete(oldestKey)
      }

      activity = { timestamps: [], contentHashes: new Map(), lastSeen: Date.now() }
      groupMap.set(userId, activity)
    }
    return activity
  }
}
