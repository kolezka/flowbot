import type { PrismaClient } from '@flowbot/db'
import type { Logger } from '../logger.js'

const FLUSH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

type CounterKey =
  | 'messageCount'
  | 'spamDetected'
  | 'linksBlocked'
  | 'warningsIssued'
  | 'mutesIssued'
  | 'bansIssued'
  | 'deletedMessages'
  | 'newMembers'
  | 'leftMembers'

interface GroupCounters {
  messageCount: number
  spamDetected: number
  linksBlocked: number
  warningsIssued: number
  mutesIssued: number
  bansIssued: number
  deletedMessages: number
  newMembers: number
  leftMembers: number
}

function emptyCounters(): GroupCounters {
  return {
    messageCount: 0,
    spamDetected: 0,
    linksBlocked: 0,
    warningsIssued: 0,
    mutesIssued: 0,
    bansIssued: 0,
    deletedMessages: 0,
    newMembers: 0,
    leftMembers: 0,
  }
}

export class AnalyticsService {
  private counters = new Map<string, GroupCounters>()
  private timer: ReturnType<typeof setInterval> | null = null
  private flushing = false

  constructor(
    private prisma: PrismaClient,
    private logger: Logger,
  ) {}

  start() {
    if (this.timer)
      return
    this.logger.info('Analytics service started')
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    // Final flush on shutdown
    this.flush().catch(err => this.logger.error({ error: err }, 'Analytics final flush error'))
    this.logger.info('Analytics service stopped')
  }

  private getCounters(groupId: string): GroupCounters {
    let c = this.counters.get(groupId)
    if (!c) {
      c = emptyCounters()
      this.counters.set(groupId, c)
    }
    return c
  }

  private increment(groupId: string, key: CounterKey, amount = 1) {
    const c = this.getCounters(groupId)
    c[key] += amount
  }

  incrementMessage(groupId: string) {
    this.increment(groupId, 'messageCount')
  }

  incrementSpam(groupId: string) {
    this.increment(groupId, 'spamDetected')
  }

  incrementLinkBlocked(groupId: string) {
    this.increment(groupId, 'linksBlocked')
  }

  incrementWarning(groupId: string) {
    this.increment(groupId, 'warningsIssued')
  }

  incrementMute(groupId: string) {
    this.increment(groupId, 'mutesIssued')
  }

  incrementBan(groupId: string) {
    this.increment(groupId, 'bansIssued')
  }

  incrementDeletedMessage(groupId: string) {
    this.increment(groupId, 'deletedMessages')
  }

  incrementNewMember(groupId: string) {
    this.increment(groupId, 'newMembers')
  }

  incrementLeftMember(groupId: string) {
    this.increment(groupId, 'leftMembers')
  }

  async flush() {
    if (this.flushing)
      return
    this.flushing = true

    try {
      const entries = Array.from(this.counters.entries())
      if (entries.length === 0)
        return

      // Clear counters before writing so new events during flush are not lost
      this.counters.clear()

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      for (const [groupId, counters] of entries) {
        // Skip if all zeroes
        const hasData = Object.values(counters).some(v => v > 0)
        if (!hasData)
          continue

        try {
          // Get current member count for the group
          const memberCount = await this.prisma.groupMember.count({
            where: { groupId },
          })

          await this.prisma.groupAnalyticsSnapshot.upsert({
            where: {
              groupId_date: { groupId, date: today },
            },
            create: {
              groupId,
              date: today,
              memberCount,
              ...counters,
            },
            update: {
              memberCount,
              messageCount: { increment: counters.messageCount },
              spamDetected: { increment: counters.spamDetected },
              linksBlocked: { increment: counters.linksBlocked },
              warningsIssued: { increment: counters.warningsIssued },
              mutesIssued: { increment: counters.mutesIssued },
              bansIssued: { increment: counters.bansIssued },
              deletedMessages: { increment: counters.deletedMessages },
              newMembers: { increment: counters.newMembers },
              leftMembers: { increment: counters.leftMembers },
            },
          })
        }
        catch (error) {
          this.logger.error({ groupId, error }, 'Failed to flush analytics for group')
          // Re-add counters that failed to flush
          const existing = this.getCounters(groupId)
          for (const key of Object.keys(counters) as CounterKey[]) {
            existing[key] += counters[key]
          }
        }
      }

      this.logger.debug({ groupCount: entries.length }, 'Analytics flushed')
    }
    catch (error) {
      this.logger.error({ error }, 'Analytics flush error')
    }
    finally {
      this.flushing = false
    }
  }
}
