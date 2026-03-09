import type { ActionRunner } from '../actions/runner.js'
import type { Action } from '../actions/types.js'
import type { Logger } from '../logger.js'
import type { AutomationJob, JobRepository } from '../repositories/JobRepository.js'

import { ActionType } from '../actions/types.js'

const JOB_TYPE_TO_ACTION_TYPE: Record<string, ActionType> = {
  SEND_MESSAGE: ActionType.SEND_MESSAGE,
  FORWARD_MESSAGE: ActionType.FORWARD_MESSAGE,
}

export class Scheduler {
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private polling = false
  private inflightPromise: Promise<void> | null = null
  private readonly jobRepo: JobRepository
  private readonly actionRunner: ActionRunner
  private readonly logger: Logger
  private readonly pollIntervalMs: number

  constructor(
    jobRepo: JobRepository,
    actionRunner: ActionRunner,
    logger: Logger,
    pollIntervalMs = 5000,
  ) {
    this.jobRepo = jobRepo
    this.actionRunner = actionRunner
    this.logger = logger.child({ component: 'scheduler' })
    this.pollIntervalMs = pollIntervalMs
  }

  get isRunning(): boolean {
    return this.intervalHandle !== null
  }

  start(): void {
    if (this.intervalHandle) {
      this.logger.warn('Scheduler already running, ignoring start()')
      return
    }

    this.logger.info({ pollIntervalMs: this.pollIntervalMs }, 'Starting scheduler')

    this.intervalHandle = setInterval(() => {
      this.triggerPoll()
    }, this.pollIntervalMs)

    // Run first poll immediately
    this.triggerPoll()
  }

  async stop(): Promise<void> {
    if (!this.intervalHandle) {
      return
    }

    this.logger.info('Stopping scheduler')
    clearInterval(this.intervalHandle)
    this.intervalHandle = null

    // Wait for any in-flight poll to finish
    if (this.inflightPromise) {
      this.logger.info('Waiting for in-flight poll to complete')
      await this.inflightPromise
    }

    this.logger.info('Scheduler stopped')
  }

  private triggerPoll(): void {
    if (this.polling) {
      this.logger.debug('Poll already in progress, skipping')
      return
    }

    this.inflightPromise = this.poll()
    this.inflightPromise.finally(() => {
      this.inflightPromise = null
    })
  }

  private async poll(): Promise<void> {
    this.polling = true

    try {
      const jobs = await this.jobRepo.findPendingJobs()

      if (jobs.length > 0) {
        this.logger.info({ count: jobs.length }, 'Found pending jobs')
      }

      for (const job of jobs) {
        await this.processJob(job)
      }
    }
    catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error during poll cycle',
      )
    }
    finally {
      this.polling = false
    }
  }

  private async processJob(job: AutomationJob): Promise<void> {
    const jobLog = { jobId: job.id, jobType: job.type }

    this.logger.info(jobLog, 'Claiming job')

    const claimed = await this.jobRepo.claimJob(job.id)

    if (!claimed) {
      this.logger.info(jobLog, 'Job already claimed by another worker, skipping')
      return
    }

    const actionType = JOB_TYPE_TO_ACTION_TYPE[job.type]
    if (!actionType) {
      const errorMsg = `Unknown job type: ${job.type}`
      this.logger.error({ ...jobLog }, errorMsg)
      await this.jobRepo.failJob(job.id, errorMsg)
      return
    }

    const action: Action = {
      type: actionType,
      payload: job.payload as unknown as Action['payload'],
      idempotencyKey: job.id,
    }

    this.logger.info({ ...jobLog, actionType }, 'Executing action for job')

    try {
      const result = await this.actionRunner.execute(action)

      if (result.success) {
        this.logger.info({ ...jobLog, attempts: result.attempts }, 'Job completed successfully')
        await this.jobRepo.completeJob(job.id, result.data as Parameters<JobRepository['completeJob']>[1])
      }
      else {
        this.logger.warn(
          { ...jobLog, error: result.error, attempts: result.attempts },
          'Job action failed',
        )
        await this.jobRepo.failJob(job.id, result.error ?? 'Unknown error')
      }
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger.error({ ...jobLog, error: errorMsg }, 'Job execution threw an exception')
      await this.jobRepo.failJob(job.id, errorMsg)
    }
  }
}
