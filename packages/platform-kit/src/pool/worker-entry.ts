// packages/platform-kit/src/pool/worker-entry.ts
import { parentPort, workerData } from 'node:worker_threads'
import type { PoolConnector, MainToWorkerMessage } from './types.js'

const HEALTH_INTERVAL_MS = 10_000

export async function runWorker(
  createConnector: (config: Record<string, unknown>) => PoolConnector,
): Promise<void> {
  if (parentPort === null) {
    throw new Error('runWorker must be called from a worker thread')
  }

  const port = parentPort
  const startedAt = Date.now()
  let actionCount = 0
  let errorCount = 0

  const sendFatalError = (message: string, code = 'WORKER_ERROR'): void => {
    port.postMessage({ type: 'error', code, message, fatal: true })
  }

  let connector: PoolConnector

  try {
    const config = (workerData as Record<string, unknown>) ?? {}
    connector = createConnector(config)
    await connector.connect()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendFatalError(message, 'CONNECT_FAILED')
    process.exit(1)
  }

  port.postMessage({ type: 'ready' })

  // Periodic health messages
  const healthInterval = setInterval(() => {
    port.postMessage({
      type: 'health',
      connected: connector.isConnected(),
      uptime: Date.now() - startedAt,
      actionCount,
      errorCount,
    })
  }, HEALTH_INTERVAL_MS)

  port.on('message', (msg: MainToWorkerMessage) => {
    void handleMessage(msg)
  })

  async function handleMessage(msg: MainToWorkerMessage): Promise<void> {
    if (msg.type === 'execute') {
      const { requestId, action, params } = msg
      try {
        const result = await connector.registry.execute(action, params)
        if (result.success) {
          actionCount++
          port.postMessage({ type: 'result', requestId, success: true, data: result.data })
        } else {
          errorCount++
          port.postMessage({ type: 'result', requestId, success: false, error: result.error })
        }
      } catch (err) {
        errorCount++
        const error = err instanceof Error ? err.message : String(err)
        port.postMessage({ type: 'result', requestId, success: false, error })
      }
      return
    }

    if (msg.type === 'shutdown') {
      clearInterval(healthInterval)
      try {
        await connector.disconnect()
      } catch {
        // Best-effort disconnect — exit regardless
      }
      process.exit(0)
    }
  }

  // Catch unhandled promise rejections and exceptions
  process.on('uncaughtException', (err) => {
    clearInterval(healthInterval)
    sendFatalError(err.message, 'UNCAUGHT_EXCEPTION')
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    clearInterval(healthInterval)
    const message = reason instanceof Error ? reason.message : String(reason)
    sendFatalError(message, 'UNHANDLED_REJECTION')
    process.exit(1)
  })
}
