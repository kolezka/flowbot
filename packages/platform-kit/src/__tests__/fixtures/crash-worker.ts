// Crash worker fixture for WorkerWrapper tests
// Sends 'ready' quickly, then crashes after receiving the first execute message.
import { parentPort } from 'node:worker_threads'

if (!parentPort) {
  throw new Error('This module must be run as a worker thread')
}

const port = parentPort

// Send ready after short delay
setTimeout(() => {
  port.postMessage({ type: 'ready' })
}, 10)

port.on('message', (msg: { type: string }) => {
  if (msg.type === 'execute') {
    // Crash without sending a result
    process.exit(1)
  } else if (msg.type === 'shutdown') {
    process.exit(0)
  }
})
