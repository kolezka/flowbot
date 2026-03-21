import { describe, it, expect, vi, afterEach } from 'vitest'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import type { Logger } from 'pino'
import { WorkerWrapper } from '../pool/worker-wrapper.js'
import type { WorkerWrapperConfig } from '../pool/worker-wrapper.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, 'fixtures')

// tsx loader so TypeScript fixture files can be loaded by worker threads
const TSX_EXECARGV = ['--import', 'tsx']

const TEST_WORKER = join(FIXTURES, 'test-worker.ts')
const CRASH_WORKER = join(FIXTURES, 'crash-worker.ts')
const SLOW_WORKER = join(FIXTURES, 'slow-worker.ts')

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger

function makeConfig(overrides: Partial<WorkerWrapperConfig> = {}): WorkerWrapperConfig {
  return {
    instanceId: 'test-instance',
    workerScript: TEST_WORKER,
    workerData: { instanceId: 'test-instance' },
    logger: mockLogger,
    execArgv: TSX_EXECARGV,
    readyTimeoutMs: 500,
    executeTimeoutMs: 500,
    shutdownTimeoutMs: 500,
    ...overrides,
  }
}

// Track workers to ensure cleanup after each test
const activeWrappers: WorkerWrapper[] = []

afterEach(async () => {
  for (const wrapper of activeWrappers) {
    if (wrapper.getStatus() !== 'dead') {
      wrapper.terminate()
    }
  }
  activeWrappers.length = 0
})

describe('WorkerWrapper', () => {
  it('1. spawn() creates worker and waits for ready message', async () => {
    const wrapper = new WorkerWrapper(makeConfig())
    activeWrappers.push(wrapper)

    await wrapper.spawn()

    expect(wrapper.getStatus()).toBe('ready')
    expect(wrapper.getInstanceId()).toBe('test-instance')
  })

  it('2. spawn() rejects if worker does not send ready within timeout', async () => {
    const wrapper = new WorkerWrapper(makeConfig({
      workerScript: SLOW_WORKER,
      readyTimeoutMs: 100,
    }))
    activeWrappers.push(wrapper)

    await expect(wrapper.spawn()).rejects.toThrow(/did not send ready within 100ms/)
  })

  it('3. execute() sends message and resolves with result', async () => {
    const wrapper = new WorkerWrapper(makeConfig())
    activeWrappers.push(wrapper)

    await wrapper.spawn()
    const result = await wrapper.execute('echo', { text: 'hello' })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ echo: { text: 'hello' } })
  })

  it('4. execute() rejects after timeout', async () => {
    // Use the slow worker which never responds to execute messages
    const wrapper = new WorkerWrapper(makeConfig({
      workerScript: SLOW_WORKER,
      readyTimeoutMs: 200,
    }))
    activeWrappers.push(wrapper)

    // Manually spawn a fast ready by using test-worker but with very short executeTimeout
    const fastWrapper = new WorkerWrapper(makeConfig({
      executeTimeoutMs: 100,
    }))
    activeWrappers.push(fastWrapper)

    await fastWrapper.spawn()

    // Replace the worker's postMessage so the execute message is never processed
    const worker = (fastWrapper as unknown as { worker: { postMessage: typeof vi.fn } }).worker
    const originalPostMessage = worker.postMessage.bind(worker)
    worker.postMessage = vi.fn((msg: unknown) => {
      // Drop execute messages to simulate a hung worker
      if (typeof msg === 'object' && msg !== null && (msg as Record<string, unknown>).type === 'execute') {
        return
      }
      originalPostMessage(msg)
    })

    await expect(fastWrapper.execute('echo', { text: 'hi' })).rejects.toThrow(/execute timeout/)
  })

  it('5. execute() rejects all pending requests when worker crashes', async () => {
    const wrapper = new WorkerWrapper(makeConfig({
      workerScript: CRASH_WORKER,
    }))
    activeWrappers.push(wrapper)

    await wrapper.spawn()

    // Kick off execute — crash-worker will exit immediately on first execute
    const executePromise = wrapper.execute('any', {})

    await expect(executePromise).rejects.toThrow(/exited|unavailable/i)
  })

  it('6. shutdown() sends shutdown message and waits for worker exit', async () => {
    const wrapper = new WorkerWrapper(makeConfig())
    activeWrappers.push(wrapper)

    await wrapper.spawn()
    expect(wrapper.getStatus()).toBe('ready')

    await wrapper.shutdown()

    expect(wrapper.getStatus()).toBe('dead')
  })

  it('7. shutdown() force-kills after timeout when worker does not exit', async () => {
    // Use slow-worker which has an infinite interval and never handles shutdown
    const wrapper = new WorkerWrapper(makeConfig({
      workerScript: SLOW_WORKER,
    }))
    activeWrappers.push(wrapper)

    // Manually set the worker to 'ready' by spawning test-worker briefly,
    // then replacing the internal worker with a slow-worker simulation.
    // Easier: just manually force-start by using a wrapper that has ready status
    // but actually spawn slow-worker after patching the ready timeout away.
    // Simplest approach: use the test-worker, spawn it, then override shutdown timeout.
    const fastWrapper = new WorkerWrapper(makeConfig({
      shutdownTimeoutMs: 100,
    }))
    activeWrappers.push(fastWrapper)

    await fastWrapper.spawn()

    // Intercept shutdown message so worker never exits cleanly
    const workerRef = (fastWrapper as unknown as { worker: { postMessage: typeof vi.fn } }).worker
    const orig = workerRef.postMessage.bind(workerRef)
    workerRef.postMessage = vi.fn((msg: unknown) => {
      if (typeof msg === 'object' && msg !== null && (msg as Record<string, unknown>).type === 'shutdown') {
        return // Drop shutdown — worker won't exit cleanly
      }
      orig(msg)
    })

    // Should resolve after force-kill timeout, not hang
    await expect(fastWrapper.shutdown()).resolves.toBeUndefined()
    expect(fastWrapper.getStatus()).toBe('dead')
  })

  it('8. worker error message with fatal=true triggers onFatalError callback', async () => {
    const onFatalError = vi.fn()
    const wrapper = new WorkerWrapper(makeConfig({ onFatalError }))
    activeWrappers.push(wrapper)

    await wrapper.spawn()

    // Simulate a fatal error by directly posting to the message handler
    const handleMessage = (wrapper as unknown as {
      handleMessage: (msg: unknown) => void
    }).handleMessage.bind(wrapper)

    handleMessage({ type: 'error', code: 'FATAL_CODE', message: 'something broke', fatal: true })

    expect(onFatalError).toHaveBeenCalledWith('test-instance', 'FATAL_CODE', 'something broke')
  })

  it('9. worker crash triggers onCrash callback', async () => {
    const onCrash = vi.fn()
    const wrapper = new WorkerWrapper(makeConfig({
      workerScript: CRASH_WORKER,
      onCrash,
    }))
    activeWrappers.push(wrapper)

    await wrapper.spawn()

    // Trigger crash by executing — crash-worker exits on first execute
    await wrapper.execute('any', {}).catch(() => {})

    // Wait for crash callback to fire
    await new Promise<void>((resolve) => {
      const check = () => {
        if (onCrash.mock.calls.length > 0) resolve()
        else setTimeout(check, 10)
      }
      check()
    })

    expect(onCrash).toHaveBeenCalledWith('test-instance', expect.anything())
    expect(wrapper.getStatus()).toBe('dead')
  })

  it('10. getHealth() returns last health message', async () => {
    const wrapper = new WorkerWrapper(makeConfig())
    activeWrappers.push(wrapper)

    await wrapper.spawn()

    // Wait for at least one health message (test-worker sends every 100ms)
    await new Promise<void>((resolve) => {
      const check = () => {
        if (wrapper.getHealth() !== null) resolve()
        else setTimeout(check, 20)
      }
      check()
    })

    const health = wrapper.getHealth()
    expect(health).not.toBeNull()
    expect(health!.type).toBe('health')
    expect(typeof health!.connected).toBe('boolean')
    expect(typeof health!.uptime).toBe('number')
    expect(typeof health!.actionCount).toBe('number')
    expect(typeof health!.errorCount).toBe('number')
  })
})
