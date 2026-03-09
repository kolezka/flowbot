import type { AutomationJob, Prisma, PrismaClient } from '@tg-allegro/db'

export class JobRepository {
  constructor(private prisma: PrismaClient) {}

  async findPendingJobs(limit = 10): Promise<AutomationJob[]> {
    return this.prisma.automationJob.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
  }

  async claimJob(id: string): Promise<AutomationJob | null> {
    try {
      return await this.prisma.automationJob.update({
        where: { id, status: 'PENDING' },
        data: {
          status: 'CLAIMED',
          claimedAt: new Date(),
          attempts: { increment: 1 },
        },
      })
    }
    catch {
      // Record not found or status no longer PENDING — another worker claimed it
      return null
    }
  }

  async completeJob(id: string, result?: Prisma.InputJsonValue): Promise<AutomationJob> {
    return this.prisma.automationJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: result ?? undefined,
      },
    })
  }

  async failJob(id: string, errorMsg: string): Promise<AutomationJob> {
    const job = await this.prisma.automationJob.findUniqueOrThrow({ where: { id } })

    const shouldRetry = job.attempts < job.maxAttempts

    return this.prisma.automationJob.update({
      where: { id },
      data: {
        status: shouldRetry ? 'PENDING' : 'FAILED',
        failedAt: new Date(),
        errorMsg,
      },
    })
  }
}
