// Slow worker fixture for WorkerWrapper tests
// Never sends 'ready' — used to test spawn() timeout.
import { parentPort } from 'node:worker_threads'

if (!parentPort) {
  throw new Error('This module must be run as a worker thread')
}

// Intentionally never sends 'ready'.
// Keep alive so the worker doesn't exit before the timeout fires.
setInterval(() => {
  // Keep event loop alive
}, 60_000)
