import { Worker, type WorkerOptions } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import type {
  WorkerResultMessage,
  WorkerToMainMessage,
  WorkerHealthMessage,
} from './types.js'
import type { Logger } from 'pino'

export interface WorkerWrapperConfig {
  instanceId: string
  workerScript: string
  workerData: Record<string, unknown>
  logger: Logger
  readyTimeoutMs?: number    // default 30_000
  executeTimeoutMs?: number  // default 30_000
  shutdownTimeoutMs?: number // default 10_000
  execArgv?: string[]        // extra node flags, e.g. ['--import', 'tsx'] for TypeScript workers
  onCrash?: (instanceId: string, code: number | null) => void
  onFatalError?: (instanceId: string, code: string, message: string) => void
}

type PendingRequest = {
  resolve: (result: WorkerResultMessage) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type WorkerStatus = 'starting' | 'ready' | 'draining' | 'dead'

export class WorkerWrapper {
  private readonly instanceId: string
  private readonly config: WorkerWrapperConfig
  private readonly logger: Logger
  private worker: Worker | null = null
  private status: WorkerStatus = 'starting'
  private pendingRequests = new Map<string, PendingRequest>()
  private lastHealth: WorkerHealthMessage | null = null

  constructor(config: WorkerWrapperConfig) {
    this.config = config
    this.instanceId = config.instanceId
    this.logger = config.logger
  }

  getInstanceId(): string {
    return this.instanceId
  }

  getStatus(): WorkerStatus {
    return this.status
  }

  getHealth(): WorkerHealthMessage | null {
    return this.lastHealth
  }

  spawn(): Promise<void> {
    const { workerScript, workerData, readyTimeoutMs = 30_000 } = this.config

    return new Promise<void>((resolve, reject) => {
      const workerOptions: WorkerOptions = { workerData }
      if (this.config.execArgv) workerOptions.execArgv = this.config.execArgv
      const worker = new Worker(workerScript, workerOptions)
      this.worker = worker
      this.status = 'starting'

      let settled = false

      const readyTimer = setTimeout(() => {
        if (settled) return
        settled = true
        worker.terminate().catch(() => {})
        reject(new Error(`Worker ${this.instanceId} did not send ready within ${readyTimeoutMs}ms`))
      }, readyTimeoutMs)

      const onMessage = (msg: WorkerToMainMessage) => {
        if (msg.type === 'ready' && !settled) {
          settled = true
          clearTimeout(readyTimer)
          this.status = 'ready'
          // Switch from one-time ready listener to ongoing message handler
          worker.off('message', onMessage)
          worker.on('message', this.handleMessage.bind(this))
          resolve()
        } else if (msg.type === 'error' && msg.fatal && !settled) {
          settled = true
          clearTimeout(readyTimer)
          worker.terminate().catch(() => {})
          reject(new Error(`Worker ${this.instanceId} fatal error during spawn: ${msg.message}`))
        }
      }

      worker.on('message', onMessage)

      worker.on('error', (err) => {
        this.logger.error({ err, instanceId: this.instanceId }, 'Worker thread error')
        if (!settled) {
          settled = true
          clearTimeout(readyTimer)
          reject(err)
        }
      })

      worker.on('exit', (code) => {
        this.handleExit(code, settled)
        if (!settled) {
          settled = true
          clearTimeout(readyTimer)
          reject(new Error(`Worker ${this.instanceId} exited with code ${code} before ready`))
        }
      })
    })
  }

  execute(action: string, params: Record<string, unknown>): Promise<WorkerResultMessage> {
    if (!this.worker || this.status === 'dead') {
      return Promise.reject(new Error(`Worker ${this.instanceId} is not available (status: ${this.status})`))
    }

    if (this.status === 'draining') {
      return Promise.reject(new Error(`Worker ${this.instanceId} is draining, not accepting new requests`))
    }

    const { executeTimeoutMs = 30_000 } = this.config
    const requestId = randomUUID()

    return new Promise<WorkerResultMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Worker ${this.instanceId} execute timeout after ${executeTimeoutMs}ms (action: ${action})`))
      }, executeTimeoutMs)

      this.pendingRequests.set(requestId, { resolve, reject, timer })

      this.worker!.postMessage({
        type: 'execute',
        requestId,
        action,
        params,
      })
    })
  }

  shutdown(): Promise<void> {
    if (!this.worker || this.status === 'dead') {
      return Promise.resolve()
    }

    const { shutdownTimeoutMs = 10_000 } = this.config
    this.status = 'draining'

    return new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (!settled) {
          settled = true
          resolve()
        }
      }

      // Always wait for the actual exit event
      this.worker!.once('exit', done)

      // After timeout, force-terminate the worker (exit event will still fire and call done())
      const forceTimer = setTimeout(() => {
        this.logger.warn({ instanceId: this.instanceId }, 'Worker did not exit cleanly, force terminating')
        this.terminate()
      }, shutdownTimeoutMs)

      // Clear the force timer once the worker exits gracefully
      this.worker!.once('exit', () => clearTimeout(forceTimer))

      this.worker!.postMessage({ type: 'shutdown' })
    })
  }

  terminate(): void {
    if (this.worker && this.status !== 'dead') {
      this.worker.terminate().catch((err) => {
        this.logger.error({ err, instanceId: this.instanceId }, 'Error terminating worker')
      })
    }
  }

  private handleMessage(msg: WorkerToMainMessage): void {
    switch (msg.type) {
      case 'result': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timer)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg)
        }
        break
      }
      case 'health': {
        this.lastHealth = msg
        break
      }
      case 'error': {
        this.logger.error(
          { instanceId: this.instanceId, code: msg.code, fatal: msg.fatal },
          `Worker error: ${msg.message}`,
        )
        if (msg.fatal) {
          this.config.onFatalError?.(this.instanceId, msg.code, msg.message)
          this.terminate()
        }
        break
      }
      default:
        break
    }
  }

  private handleExit(code: number | null, spawnSettled = true): void {
    if (this.status === 'dead') return

    // Only fire onCrash if the worker had fully started (reached 'ready') and exited unexpectedly
    const wasReady = this.status === 'ready'
    const wasUnexpected = this.status !== 'draining'
    this.status = 'dead'

    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(
        new Error(`Worker ${this.instanceId} exited with code ${code} (503 - worker unavailable)`),
      )
      this.pendingRequests.delete(requestId)
    }

    if (wasReady && wasUnexpected && spawnSettled) {
      this.logger.error({ instanceId: this.instanceId, code }, 'Worker crashed unexpectedly')
      this.config.onCrash?.(this.instanceId, code)
    }
  }
}
