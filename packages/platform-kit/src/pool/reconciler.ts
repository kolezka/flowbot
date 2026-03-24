// packages/platform-kit/src/pool/reconciler.ts
import type { PoolConfig, InstanceRecord } from './types.js'
import type { Logger } from 'pino'
import { WorkerWrapper as RealWorkerWrapper } from './worker-wrapper.js'

// --- Minimal WorkerWrapper interface (Task 2 may not be implemented yet) ---

export interface WorkerWrapperConfig {
  instanceId: string
  workerScript: string
  workerData: Record<string, unknown>
  logger: Logger
  readyTimeoutMs?: number
  executeTimeoutMs?: number
  shutdownTimeoutMs?: number
  execArgv?: string[]
  onCrash?: (instanceId: string, code: number | null) => void
  onFatalError?: (instanceId: string, code: string, message: string) => void
}

export interface WorkerWrapper {
  spawn(): Promise<void>
  execute(action: string, params: Record<string, unknown>): Promise<import('./types.js').WorkerResultMessage>
  shutdown(): Promise<void>
  terminate(): void
  getStatus(): 'starting' | 'ready' | 'draining' | 'dead'
  getInstanceId(): string
}

// --- Extended PoolConfig with optional worker factory for DI / testing ---

export interface ReconcilerConfig extends PoolConfig {
  /**
   * Optional factory for creating WorkerWrapper instances.
   * Defaults to creating a real WorkerWrapper (from worker-wrapper.ts).
   * Override in tests to avoid spawning real worker threads.
   */
  createWorker?: (config: WorkerWrapperConfig) => WorkerWrapper
}

// --- Sleep helper ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- Reconciler ---

export class Reconciler {
  private readonly workers = new Map<string, WorkerWrapper>()
  private isReconciling = false
  private interval: ReturnType<typeof setInterval> | null = null
  private readonly logger: Logger
  private readonly batchSize: number
  private readonly batchDelayMs: number
  private readonly reconcileIntervalMs: number
  private readonly createWorkerFn: (config: WorkerWrapperConfig) => WorkerWrapper

  constructor(private readonly config: ReconcilerConfig) {
    this.logger = config.logger.child({ component: 'Reconciler' })
    this.batchSize = config.batchSize ?? 20
    this.batchDelayMs = config.batchDelayMs ?? 1000
    this.reconcileIntervalMs = config.reconcileIntervalMs ?? 30_000

    if (config.createWorker != null) {
      this.createWorkerFn = config.createWorker
    } else {
      this.createWorkerFn = (wc) => new RealWorkerWrapper(wc)
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  start(): void {
    this.logger.info('Starting reconciler')
    // Run immediately, then on interval
    void this.reconcile()
    this.interval = setInterval(() => {
      void this.reconcile()
    }, this.reconcileIntervalMs)
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping reconciler')
    if (this.interval !== null) {
      clearInterval(this.interval)
      this.interval = null
    }

    // Shutdown all running workers
    const shutdownPromises: Promise<void>[] = []
    for (const [id, worker] of this.workers) {
      this.logger.info({ instanceId: id }, 'Shutting down worker')
      shutdownPromises.push(
        worker.shutdown().catch((err: unknown) => {
          this.logger.warn({ instanceId: id, err }, 'Worker shutdown error — force terminating')
          worker.terminate()
        }),
      )
    }
    await Promise.all(shutdownPromises)
    this.workers.clear()
  }

  async reconcile(): Promise<void> {
    if (this.isReconciling) {
      this.logger.debug('Reconcile skipped — already in progress')
      return
    }

    this.isReconciling = true
    try {
      await this._doReconcile()
    } finally {
      this.isReconciling = false
    }
  }

  getWorker(instanceId: string): WorkerWrapper | undefined {
    return this.workers.get(instanceId)
  }

  getWorkers(): Map<string, WorkerWrapper> {
    return new Map(this.workers)
  }

  async restartWorker(instanceId: string): Promise<void> {
    if (this.isReconciling) {
      // Wait for current reconcile to finish before acquiring mutex
      // Use a simple polling approach
      await this._waitForReconcileDone()
    }

    this.isReconciling = true
    try {
      await this._stopWorker(instanceId)
      await this._startWorker(instanceId)
    } finally {
      this.isReconciling = false
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _doReconcile(): Promise<void> {
    let instances: InstanceRecord[]
    try {
      instances = await this.config.getInstances()
    } catch (err) {
      this.logger.error({ err }, 'getInstances() failed — skipping reconcile cycle')
      return
    }

    const desired = new Set(instances.map((i) => i.id))
    const running = new Set(this.workers.keys())

    // Determine what to start and what to stop
    const toStart = instances.filter((i) => !running.has(i.id))
    const toStop = Array.from(running).filter((id) => !desired.has(id))

    // Stop removed workers first
    if (toStop.length > 0) {
      this.logger.info({ count: toStop.length }, 'Stopping removed workers')
      await Promise.all(toStop.map((id) => this._stopWorker(id)))
    }

    // Start missing workers in batches
    if (toStart.length > 0) {
      this.logger.info({ count: toStart.length }, 'Starting missing workers in batches')
      for (let i = 0; i < toStart.length; i += this.batchSize) {
        const batch = toStart.slice(i, i + this.batchSize)
        await Promise.all(batch.map((instance) => this._spawnWorker(instance)))

        // Sleep between batches (but not after the last one)
        if (i + this.batchSize < toStart.length) {
          await sleep(this.batchDelayMs)
        }
      }
    }

    // Update apiUrl for all running workers if needed
    if (this.config.updateApiUrl != null) {
      for (const instance of instances) {
        const record = instance as { apiUrl?: string | null }
        if (record.apiUrl !== this.config.poolUrl) {
          try {
            await this.config.updateApiUrl!(instance.id, this.config.poolUrl)
            this.logger.debug({ instanceId: instance.id }, 'Updated apiUrl')
          } catch (err) {
            this.logger.warn({ instanceId: instance.id, err }, 'Failed to update apiUrl')
          }
        }
      }
    }
  }

  private async _spawnWorker(instance: InstanceRecord): Promise<void> {
    const instanceId = instance.id
    this.logger.info({ instanceId }, 'Spawning worker')

    const workerData = this.config.toWorkerData(instance)

    const worker = this.createWorkerFn({
      instanceId,
      workerScript: this.config.workerScript,
      workerData,
      logger: this.logger,
      execArgv: this.config.execArgv,
      onCrash: (id, code) => {
        this.logger.warn({ instanceId: id, code }, 'Worker crashed — removing from map (will restart next cycle)')
        this.workers.delete(id)
      },
      onFatalError: (id, code, message) => {
        this.logger.error({ instanceId: id, code, message }, 'Worker fatal error — removing from map')
        this.workers.delete(id)
      },
    })

    try {
      await worker.spawn()
      this.workers.set(instanceId, worker)
      this.logger.info({ instanceId }, 'Worker spawned and ready')

      // Update apiUrl after successful spawn
      if (this.config.updateApiUrl != null) {
        const record = instance as { apiUrl?: string | null }
        if (record.apiUrl !== this.config.poolUrl) {
          try {
            await this.config.updateApiUrl!(instanceId, this.config.poolUrl)
          } catch (err) {
            this.logger.warn({ instanceId, err }, 'Failed to update apiUrl after spawn')
          }
        }
      }
    } catch (err) {
      this.logger.error({ instanceId, err }, 'Worker failed to spawn')
    }
  }

  private async _stopWorker(instanceId: string): Promise<void> {
    const worker = this.workers.get(instanceId)
    if (worker == null) return

    this.logger.info({ instanceId }, 'Stopping worker')
    this.workers.delete(instanceId)

    try {
      await worker.shutdown()
    } catch (err) {
      this.logger.warn({ instanceId, err }, 'Worker shutdown error — force terminating')
      worker.terminate()
    }
  }

  private async _startWorker(instanceId: string): Promise<void> {
    // Fetch fresh instance data
    let instances: InstanceRecord[]
    try {
      instances = await this.config.getInstances()
    } catch (err) {
      this.logger.error({ instanceId, err }, 'getInstances() failed during restartWorker')
      return
    }

    const instance = instances.find((i) => i.id === instanceId)
    if (instance == null) {
      this.logger.warn({ instanceId }, 'Instance not found during restart — skipping')
      return
    }

    await this._spawnWorker(instance)
  }

  private async _waitForReconcileDone(): Promise<void> {
    while (this.isReconciling) {
      await sleep(10)
    }
  }
}
