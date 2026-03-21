// Test worker fixture for WorkerWrapper tests
// Sends 'ready' after 10ms, echoes execute requests, handles shutdown cleanly.
import { parentPort, workerData } from 'node:worker_threads'

if (!parentPort) {
  throw new Error('This module must be run as a worker thread')
}

const port = parentPort

// Send ready after short delay
setTimeout(() => {
  port.postMessage({ type: 'ready' })
}, 10)

// Send health every 100ms
let actionCount = 0
const startedAt = Date.now()
const healthInterval = setInterval(() => {
  port.postMessage({
    type: 'health',
    connected: true,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    actionCount,
    errorCount: 0,
  })
}, 100)

port.on('message', (msg: { type: string; requestId?: string; action?: string; params?: Record<string, unknown> }) => {
  if (msg.type === 'execute') {
    actionCount++
    port.postMessage({
      type: 'result',
      requestId: msg.requestId,
      success: true,
      data: { echo: msg.params, workerData },
    })
  } else if (msg.type === 'shutdown') {
    clearInterval(healthInterval)
    process.exit(0)
  }
})
