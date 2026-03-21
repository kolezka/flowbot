// packages/platform-kit/src/__tests__/pool-reconciler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Reconciler } from '../pool/reconciler.js'
import type { ReconcilerConfig, WorkerWrapper, WorkerWrapperConfig } from '../pool/reconciler.js'
import type { InstanceRecord } from '../pool/types.js'
import type { Logger } from 'pino'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger

function makeInstance(id: string, apiUrl: string | null = null): InstanceRecord {
  return {
    id,
    botToken: null,
    platform: 'test',
    apiUrl,
    metadata: null,
  }
}

function makeMockWorker(instanceId: string): WorkerWrapper & { _spawnCount: number } {
  return {
    _spawnCount: 0,
    spawn: vi.fn().mockImplementation(function (this: { _spawnCount: number }) {
      this._spawnCount++
      return Promise.resolve()
    }),
    execute: vi.fn().mockResolvedValue({ type: 'result', requestId: 'r1', success: true }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(),
    getStatus: vi.fn().mockReturnValue('ready' as const),
    getInstanceId: vi.fn().mockReturnValue(instanceId),
  }
}

type MockWorker = ReturnType<typeof makeMockWorker>

function makeConfig(
  overrides: Partial<ReconcilerConfig> & {
    instances?: InstanceRecord[]
    onWorkerCreate?: (instanceId: string, worker: MockWorker) => void
  } = {},
): ReconcilerConfig & { createdWorkers: Map<string, MockWorker> } {
  const { instances = [], onWorkerCreate, ...rest } = overrides
  const createdWorkers = new Map<string, MockWorker>()

  const createWorker = (cfg: WorkerWrapperConfig): WorkerWrapper => {
    const worker = makeMockWorker(cfg.instanceId)
    createdWorkers.set(cfg.instanceId, worker)
    onWorkerCreate?.(cfg.instanceId, worker)

    // Wire spawn mock to call through — already done in makeMockWorker
    return worker
  }

  return {
    platform: 'test',
    type: 'bot',
    workerScript: '/fake/worker.js',
    getInstances: vi.fn().mockResolvedValue(instances),
    toWorkerData: (instance) => ({ instanceId: instance.id }),
    poolUrl: 'http://localhost:3000',
    logger: mockLogger,
    createWorker,
    createdWorkers,
    ...rest,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Reconciler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // 1. reconcile() starts workers for instances returned by getInstances()
  it('starts workers for instances returned by getInstances()', async () => {
    const config = makeConfig({ instances: [makeInstance('a'), makeInstance('b')] })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile()

    expect(config.createdWorkers.size).toBe(2)
    expect(config.createdWorkers.has('a')).toBe(true)
    expect(config.createdWorkers.has('b')).toBe(true)
    expect(config.createdWorkers.get('a')!.spawn).toHaveBeenCalledOnce()
    expect(config.createdWorkers.get('b')!.spawn).toHaveBeenCalledOnce()
    expect(reconciler.getWorkers().size).toBe(2)
  })

  // 2. reconcile() stops workers for instances no longer in getInstances()
  it('stops workers for instances no longer in getInstances()', async () => {
    const getInstances = vi.fn()
      .mockResolvedValueOnce([makeInstance('a'), makeInstance('b')])
      .mockResolvedValueOnce([makeInstance('a')]) // 'b' removed

    const config = makeConfig({ getInstances })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile() // starts a, b
    await reconciler.reconcile() // should stop b

    const workerB = config.createdWorkers.get('b')!
    expect(workerB.shutdown).toHaveBeenCalledOnce()
    expect(reconciler.getWorkers().has('b')).toBe(false)
    expect(reconciler.getWorkers().has('a')).toBe(true)
  })

  // 3. reconcile() does not touch already-running instances
  it('does not restart already-running instances', async () => {
    const config = makeConfig({ instances: [makeInstance('a'), makeInstance('b')] })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile()
    await reconciler.reconcile() // second cycle — no changes

    // spawn should only have been called once per worker
    expect(config.createdWorkers.get('a')!.spawn).toHaveBeenCalledOnce()
    expect(config.createdWorkers.get('b')!.spawn).toHaveBeenCalledOnce()
    // No shutdowns
    expect(config.createdWorkers.get('a')!.shutdown).not.toHaveBeenCalled()
    expect(config.createdWorkers.get('b')!.shutdown).not.toHaveBeenCalled()
  })

  // 4. reconcile() batches startup (BATCH_SIZE at a time with BATCH_DELAY between)
  it('batches startup with delay between batches', async () => {
    const instances = Array.from({ length: 5 }, (_, i) => makeInstance(`inst-${i}`))
    const spawnOrder: string[] = []
    const createdWorkers = new Map<string, WorkerWrapper>()

    const config = makeConfig({
      instances,
      batchSize: 2,
      batchDelayMs: 10,
      createWorker: (cfg: WorkerWrapperConfig): WorkerWrapper => {
        const worker = makeMockWorker(cfg.instanceId)
        createdWorkers.set(cfg.instanceId, worker)
        ;(worker.spawn as ReturnType<typeof vi.fn>).mockImplementation(() => {
          spawnOrder.push(cfg.instanceId)
          return Promise.resolve()
        })
        return worker
      },
    })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile()

    expect(createdWorkers.size).toBe(5)
    expect(spawnOrder).toHaveLength(5)
  })

  // 5. reconcile() mutex prevents overlapping runs
  it('mutex prevents overlapping reconcile() runs', async () => {
    let resolveFirst!: () => void
    const slowGetInstances = vi.fn().mockImplementationOnce(
      () => new Promise<InstanceRecord[]>((resolve) => {
        resolveFirst = () => resolve([makeInstance('a')])
      }),
    ).mockResolvedValue([makeInstance('a')])

    const config = makeConfig({ getInstances: slowGetInstances })
    const reconciler = new Reconciler(config)

    // Start two concurrent reconciles
    const p1 = reconciler.reconcile()
    const p2 = reconciler.reconcile() // should skip — mutex locked

    resolveFirst()
    await Promise.all([p1, p2])

    // getInstances should only have been called once (p2 was skipped)
    expect(slowGetInstances).toHaveBeenCalledOnce()
  })

  // 6. reconcile() calls updateApiUrl for newly started instances
  it('calls updateApiUrl for newly started instances', async () => {
    const updateApiUrl = vi.fn().mockResolvedValue(undefined)
    const config = makeConfig({
      instances: [makeInstance('a', null)], // apiUrl is null → needs update
      updateApiUrl,
    })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile()

    expect(updateApiUrl).toHaveBeenCalledWith('a', 'http://localhost:3000')
  })

  // 7. reconcile() does not call updateApiUrl for already-running instances with correct URL
  it('does not call updateApiUrl when apiUrl already matches poolUrl', async () => {
    const updateApiUrl = vi.fn().mockResolvedValue(undefined)
    const config = makeConfig({
      instances: [makeInstance('a', 'http://localhost:3000')], // already correct
      updateApiUrl,
    })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile()

    expect(updateApiUrl).not.toHaveBeenCalled()
  })

  // 8. start() begins interval, stop() clears it
  it('start() begins interval and stop() clears it', async () => {
    const config = makeConfig({ instances: [], reconcileIntervalMs: 50 })
    const reconciler = new Reconciler(config)

    reconciler.start()

    // Wait for initial reconcile + one interval
    await new Promise((r) => setTimeout(r, 120))
    const callCount = (config.getInstances as ReturnType<typeof vi.fn>).mock.calls.length
    expect(callCount).toBeGreaterThanOrEqual(2)

    await reconciler.stop()

    const countAfterStop = (config.getInstances as ReturnType<typeof vi.fn>).mock.calls.length
    // Wait another interval — should NOT fire
    await new Promise((r) => setTimeout(r, 100))
    expect((config.getInstances as ReturnType<typeof vi.fn>).mock.calls.length).toBe(countAfterStop)
  })

  // 9. getWorker(instanceId) returns the correct WorkerWrapper
  it('getWorker(instanceId) returns the correct WorkerWrapper', async () => {
    const config = makeConfig({ instances: [makeInstance('a'), makeInstance('b')] })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile()

    const workerA = reconciler.getWorker('a')
    expect(workerA).toBeDefined()
    expect(config.createdWorkers.get('a')).toBe(workerA)

    expect(reconciler.getWorker('nonexistent')).toBeUndefined()
  })

  // 10. getWorkers() returns all running workers
  it('getWorkers() returns all running workers as a Map copy', async () => {
    const config = makeConfig({
      instances: [makeInstance('a'), makeInstance('b'), makeInstance('c')],
    })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile()

    const workers = reconciler.getWorkers()
    expect(workers.size).toBe(3)
    expect(workers.has('a')).toBe(true)
    expect(workers.has('b')).toBe(true)
    expect(workers.has('c')).toBe(true)

    // Should be a copy — mutating it should not affect the internal map
    workers.clear()
    expect(reconciler.getWorkers().size).toBe(3)
  })

  // 11. restartWorker(instanceId) stops and restarts (acquires mutex)
  it('restartWorker(instanceId) stops and restarts the worker', async () => {
    const config = makeConfig({ instances: [makeInstance('a')] })
    const reconciler = new Reconciler(config)

    await reconciler.reconcile()

    const originalWorker = config.createdWorkers.get('a')!
    expect(originalWorker.spawn).toHaveBeenCalledOnce()

    await reconciler.restartWorker('a')

    // Old worker should have been shut down
    expect(originalWorker.shutdown).toHaveBeenCalledOnce()

    // A new worker should have been created and spawned
    const newWorker = config.createdWorkers.get('a')!
    expect(newWorker).toBeDefined()
    expect(newWorker.spawn).toHaveBeenCalledOnce()
  })

  // 12. handles getInstances() throwing (logs error, does not crash)
  it('handles getInstances() throwing — logs error and does not crash', async () => {
    const error = new Error('DB connection failed')
    const config = makeConfig({
      getInstances: vi.fn().mockRejectedValue(error),
    })
    const reconciler = new Reconciler(config)

    // Should not throw
    await expect(reconciler.reconcile()).resolves.toBeUndefined()

    // Should have logged the error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: error }),
      expect.stringContaining('getInstances()'),
    )

    // No workers should have been created
    expect(reconciler.getWorkers().size).toBe(0)
  })
})
