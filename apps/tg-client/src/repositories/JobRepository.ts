import type { Prisma, PrismaClient } from '@tg-allegro/db'

// Local type definitions — AutomationJob model removed from Prisma schema.
// Job system will be replaced by Trigger.dev in a future milestone.

export type JobType = 'SEND_MESSAGE' | 'FORWARD_MESSAGE'

export type JobStatus = 'PENDING' | 'CLAIMED' | 'COMPLETED' | 'FAILED'

export interface AutomationJob {
  id: string
  type: JobType
  status: JobStatus
  payload: Prisma.JsonValue
  result: Prisma.JsonValue | null
  attempts: number
  maxAttempts: number
  claimedAt: Date | null
  completedAt: Date | null
  failedAt: Date | null
  errorMsg: string | null
  createdAt: Date
  updatedAt: Date
}

export class JobRepository {
  constructor(private _prisma: PrismaClient) {}

  async findPendingJobs(_limit = 10): Promise<AutomationJob[]> {
    // AutomationJob table removed — Trigger.dev will replace this.
    return []
  }

  async claimJob(_id: string): Promise<AutomationJob | null> {
    // AutomationJob table removed — Trigger.dev will replace this.
    return null
  }

  async completeJob(_id: string, _result?: Prisma.InputJsonValue): Promise<AutomationJob | null> {
    // AutomationJob table removed — Trigger.dev will replace this.
    return null
  }

  async failJob(_id: string, _errorMsg: string): Promise<AutomationJob | null> {
    // AutomationJob table removed — Trigger.dev will replace this.
    return null
  }
}
