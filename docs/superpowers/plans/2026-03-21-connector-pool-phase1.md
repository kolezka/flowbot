# Connector Pool Phase 1: platform-kit Pool Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `createPoolServer()` factory to `packages/platform-kit` that manages multiple connector instances via worker threads with reconciliation loop, crash recovery, and staggered startup.

**Architecture:** Main thread runs Hono HTTP server + reconciliation loop. Each connector instance runs in its own `worker_thread`. Communication via `MessagePort` with typed protocol (init, ready, execute, result, error, health, shutdown). Pool reads desired state from DB every 30s and converges.

**Tech Stack:** Node.js `worker_threads`, Hono, Valibot, Vitest, pino

**Spec:** `docs/superpowers/specs/2026-03-21-connector-pool-design.md`

---

## File Structure

### New files in `packages/platform-kit/src/`:

| File | Responsibility |
|------|---------------|
| `pool/types.ts` | `PoolConnector` interface, `PoolConfig`, `InstanceRecord`, message protocol types |
| `pool/worker-wrapper.ts` | Main-thread side: spawn worker, manage MessagePort, track pending requests, handle timeouts |
| `pool/worker-entry.ts` | Worker-thread side: receive init, create connector, handle execute/shutdown messages |
| `pool/reconciler.ts` | Reconciliation loop: read DB, diff with running workers, start/stop with batching |
| `pool/pool-server.ts` | `createPoolServer()` factory: Hono routes + worker map + reconciler + graceful shutdown |
| `pool/index.ts` | Re-export public API |

### New test files:

| File | What it tests |
|------|--------------|
| `__tests__/pool-worker-wrapper.test.ts` | Worker spawn, MessagePort protocol, timeout, crash handling |
| `__tests__/pool-reconciler.test.ts` | Reconcile logic: start missing, stop removed, batch staggering, mutex |
| `__tests__/pool-server.test.ts` | HTTP endpoints: /execute routing, /health aggregation, /instances, /metrics |
| `__tests__/pool-integration.test.ts` | End-to-end: real workers, real HTTP, crash recovery |

### Modified files:

| File | Change |
|------|--------|
| `src/server.ts` | Add `/execute` alias for `/api/execute-action` |
| `src/index.ts` | Re-export pool public API |

---

### Task 1: Pool Types

**Files:**
- Create: `packages/platform-kit/src/pool/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// packages/platform-kit/src/pool/types.ts
import type { ActionRegistry } from '../action-registry.js'
import type { Logger } from 'pino'

// --- Connector interface that pool manages ---

export interface PoolConnector {
  readonly registry: ActionRegistry
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
}

// --- Instance records from DB ---

export interface BotInstanceRecord {
  id: string
  botToken: string | null
  platform: string
  apiUrl: string | null
  metadata: Record<string, unknown> | null
}

export interface UserConnectionRecord {
  id: string
  platform: string
  credentials: Record<string, unknown>
  botInstanceId: string | null
  metadata: Record<string, unknown> | null
}

export type InstanceRecord = BotInstanceRecord | UserConnectionRecord

// --- Pool configuration ---

export interface PoolConfig {
  platform: string
  type: 'bot' | 'user'
  workerScript: string
  getInstances(): Promise<InstanceRecord[]>
  toWorkerData(instance: InstanceRecord): Record<string, unknown>
  batchSize?: number              // default 20
  batchDelayMs?: number           // default 1000
  reconcileIntervalMs?: number    // default 30_000
  maxWorkersPerProcess?: number   // default 50
  poolUrl: string                 // this pool's URL for DB apiUrl updates
  logger: Logger
  updateApiUrl?(instanceId: string, apiUrl: string): Promise<void>
}

// --- MessagePort protocol ---

export interface WorkerInitMessage {
  type: 'init'
  config: Record<string, unknown>
}

export interface WorkerReadyMessage {
  type: 'ready'
}

export interface WorkerErrorMessage {
  type: 'error'
  code: string
  message: string
  fatal: boolean
}

export interface WorkerExecuteMessage {
  type: 'execute'
  requestId: string
  action: string
  params: Record<string, unknown>
}

export interface WorkerResultMessage {
  type: 'result'
  requestId: string
  success: boolean
  data?: unknown
  error?: string
}

export interface WorkerHealthMessage {
  type: 'health'
  connected: boolean
  uptime: number
  actionCount: number
  errorCount: number
}

export interface WorkerShutdownMessage {
  type: 'shutdown'
}

export type MainToWorkerMessage = WorkerInitMessage | WorkerExecuteMessage | WorkerShutdownMessage
export type WorkerToMainMessage = WorkerReadyMessage | WorkerErrorMessage | WorkerResultMessage | WorkerHealthMessage

// --- Worker state tracked by main thread ---

export interface WorkerState {
  instanceId: string
  worker: import('node:worker_threads').Worker
  status: 'starting' | 'ready' | 'draining' | 'dead'
  pendingRequests: Map<string, {
    resolve: (result: WorkerResultMessage) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>
  lastHealth: WorkerHealthMessage | null
  startedAt: number
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm platform-kit typecheck`
Expected: PASS (no errors — this is a types-only file)

- [ ] **Step 3: Commit**

```bash
git add packages/platform-kit/src/pool/types.ts
git commit -m "feat(platform-kit): add pool types and MessagePort protocol"
```

---

### Task 2: Worker Wrapper (main-thread side)

**Files:**
- Create: `packages/platform-kit/src/pool/worker-wrapper.ts`
- Create: `packages/platform-kit/src/__tests__/pool-worker-wrapper.test.ts`

- [ ] **Step 1: Write tests for WorkerWrapper**

```typescript
// packages/platform-kit/src/__tests__/pool-worker-wrapper.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test WorkerWrapper by creating a real worker from a test script.
// Test worker script: receives 'execute' → returns 'result', receives 'shutdown' → exits.

describe('WorkerWrapper', () => {
  // Tests:
  // 1. spawn() creates worker and waits for 'ready' message
  // 2. spawn() rejects if worker does not send 'ready' within timeout
  // 3. execute() sends message and resolves with result
  // 4. execute() rejects after timeout (30s default, use shorter for test)
  // 5. execute() rejects all pending requests when worker crashes
  // 6. shutdown() sends shutdown message and waits for worker exit
  // 7. shutdown() force-kills after timeout
  // 8. worker 'error' message with fatal=true triggers onFatalError callback
  // 9. worker crash triggers onCrash callback
  // 10. getHealth() returns last health message
})
```

Write a test worker script at `packages/platform-kit/src/__tests__/fixtures/test-worker.ts` that:
- Reads `workerData` for config
- Sends `{ type: 'ready' }` after 10ms
- On `execute` message: returns `{ type: 'result', requestId, success: true, data: { echo: params } }`
- On `shutdown` message: exits cleanly
- Sends `health` message every 100ms

Also write `packages/platform-kit/src/__tests__/fixtures/crash-worker.ts` that crashes after receiving first execute.

And `packages/platform-kit/src/__tests__/fixtures/slow-worker.ts` that never sends 'ready'.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm platform-kit test -- --testPathPatterns=pool-worker-wrapper`
Expected: FAIL (WorkerWrapper not implemented)

- [ ] **Step 3: Implement WorkerWrapper**

```typescript
// packages/platform-kit/src/pool/worker-wrapper.ts
import { Worker } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import type {
  WorkerState,
  WorkerExecuteMessage,
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
  readyTimeoutMs?: number   // default 30_000
  executeTimeoutMs?: number // default 30_000
  shutdownTimeoutMs?: number // default 10_000
  onCrash?: (instanceId: string, code: number | null) => void
  onFatalError?: (instanceId: string, code: string, message: string) => void
}

export class WorkerWrapper {
  // Public:
  //   spawn(): Promise<void> — create worker, wait for ready
  //   execute(action, params): Promise<WorkerResultMessage> — send execute, wait for result
  //   shutdown(): Promise<void> — graceful stop
  //   terminate(): void — force kill
  //   getHealth(): WorkerHealthMessage | null
  //   getStatus(): 'starting' | 'ready' | 'draining' | 'dead'
  //   getInstanceId(): string
}
```

Implementation details:
- `spawn()` creates `new Worker(script, { workerData })`, listens for messages, resolves when `ready` received or rejects on timeout
- `execute()` generates requestId, stores in pendingRequests map with timer, sends execute message, returns promise
- On worker message: route by `type` field to appropriate handler
- On `result`: resolve matching pending request, clear timer
- On `health`: store as lastHealth
- On `error` with `fatal: true`: call onFatalError, terminate worker
- On worker `exit` event: reject all pending requests with 503, call onCrash if unexpected
- `shutdown()`: set status to 'draining', send shutdown message, wait for exit with timeout, force terminate if needed

- [ ] **Step 4: Run tests**

Run: `pnpm platform-kit test -- --testPathPatterns=pool-worker-wrapper`
Expected: PASS (all 10 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/platform-kit/src/pool/worker-wrapper.ts \
       packages/platform-kit/src/__tests__/pool-worker-wrapper.test.ts \
       packages/platform-kit/src/__tests__/fixtures/
git commit -m "feat(platform-kit): add WorkerWrapper with spawn, execute, shutdown, crash handling"
```

---

### Task 3: Reconciler

**Files:**
- Create: `packages/platform-kit/src/pool/reconciler.ts`
- Create: `packages/platform-kit/src/__tests__/pool-reconciler.test.ts`

- [ ] **Step 1: Write tests**

```typescript
describe('Reconciler', () => {
  // Uses fake getInstances() and mock WorkerWrapper creation
  // 1. reconcile() starts workers for instances returned by getInstances()
  // 2. reconcile() stops workers for instances no longer in getInstances()
  // 3. reconcile() does not touch already-running instances
  // 4. reconcile() batches startup (BATCH_SIZE at a time with BATCH_DELAY between)
  // 5. reconcile() mutex prevents overlapping runs
  // 6. reconcile() calls updateApiUrl for newly started instances
  // 7. reconcile() does not call updateApiUrl for already-running instances with correct URL
  // 8. start() begins interval, stop() clears it
  // 9. getWorker(instanceId) returns the correct WorkerWrapper
  // 10. getWorkers() returns all running workers
  // 11. restartWorker(instanceId) stops and restarts (acquires mutex)
  // 12. handles getInstances() throwing (logs error, does not crash)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm platform-kit test -- --testPathPatterns=pool-reconciler`
Expected: FAIL

- [ ] **Step 3: Implement Reconciler**

```typescript
// packages/platform-kit/src/pool/reconciler.ts
import type { PoolConfig, InstanceRecord } from './types.js'
import { WorkerWrapper, type WorkerWrapperConfig } from './worker-wrapper.js'
import type { Logger } from 'pino'

export class Reconciler {
  private workers = new Map<string, WorkerWrapper>()
  private isReconciling = false
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(private config: PoolConfig) {}

  // Public:
  //   start(): void — begin reconciliation interval + run immediately
  //   stop(): Promise<void> — clear interval, shutdown all workers
  //   reconcile(): Promise<void> — one reconciliation cycle
  //   getWorker(instanceId: string): WorkerWrapper | undefined
  //   getWorkers(): Map<string, WorkerWrapper>
  //   restartWorker(instanceId: string): Promise<void>
}
```

Key implementation:
- `reconcile()` checks `isReconciling` mutex, sets it in try/finally
- Calls `config.getInstances()` wrapped in try/catch
- Diffs desired vs running (Set operations)
- Starts missing in batches: `for (let i = 0; i < missing.length; i += batchSize)`, `Promise.all(batch)`, `sleep(batchDelayMs)`
- Stops removed: send shutdown to each, await, remove from map
- Updates apiUrl only when changed
- Worker onCrash callback: remove from map (reconcile will restart next cycle)
- Worker onFatalError callback: mark BotInstance as inactive via `config.updateApiUrl` or similar

- [ ] **Step 4: Run tests**

Run: `pnpm platform-kit test -- --testPathPatterns=pool-reconciler`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/platform-kit/src/pool/reconciler.ts \
       packages/platform-kit/src/__tests__/pool-reconciler.test.ts
git commit -m "feat(platform-kit): add Reconciler with batched startup and mutex"
```

---

### Task 4: Pool Server Factory

**Files:**
- Create: `packages/platform-kit/src/pool/pool-server.ts`
- Create: `packages/platform-kit/src/__tests__/pool-server.test.ts`

- [ ] **Step 1: Write tests**

```typescript
describe('createPoolServer', () => {
  // Uses a mock Reconciler (or real one with fake getInstances + test worker)
  // 1. POST /execute with valid instanceId routes to correct worker and returns result
  // 2. POST /execute with unknown instanceId returns 404
  // 3. POST /execute without instanceId and 1 worker routes to that worker (backward compat)
  // 4. POST /execute without instanceId and multiple workers returns 400
  // 5. POST /execute with missing action field returns 400
  // 6. GET /health returns pool-level health (total, healthy count, memory)
  // 7. GET /health returns 'healthy' when >80% connected, 'degraded' 50-80%, 'unhealthy' <50%
  // 8. GET /instances returns list of all instances with status
  // 9. GET /instances/:id/health returns per-instance health
  // 10. GET /metrics returns per-instance action counts and circuit state
  // 11. POST /instances/:id/restart triggers restart and returns 200
  // 12. start() starts reconciler + HTTP server
  // 13. stop() drains requests (503 for new), shuts down reconciler, stops server
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm platform-kit test -- --testPathPatterns=pool-server`
Expected: FAIL

- [ ] **Step 3: Implement createPoolServer**

```typescript
// packages/platform-kit/src/pool/pool-server.ts
import { Hono } from 'hono'
import { Reconciler } from './reconciler.js'
import { createServerManager } from '../server-manager.js'
import type { PoolConfig } from './types.js'

export function createPoolServer(config: PoolConfig & { host?: string; port?: number }): {
  server: Hono
  start(): Promise<{ url: string }>
  stop(): Promise<void>
}
```

Implementation:
- Creates `Reconciler` with config
- Creates Hono app with routes:
  - `POST /execute`: extract `instanceId` from body, lookup worker, forward via `worker.execute()`, return result
  - `GET /health`: aggregate health from all workers
  - `GET /instances`: list workers with status
  - `GET /instances/:id/health`: single worker health
  - `GET /metrics`: collect health from all workers into metrics object
  - `POST /instances/:id/restart`: call `reconciler.restartWorker(id)`
- `start()`: start reconciler + HTTP server
- `stop()`: set drain flag, stop reconciler, stop HTTP server
- Drain logic: middleware checks drain flag, returns 503 if set

- [ ] **Step 4: Run tests**

Run: `pnpm platform-kit test -- --testPathPatterns=pool-server`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/platform-kit/src/pool/pool-server.ts \
       packages/platform-kit/src/__tests__/pool-server.test.ts
git commit -m "feat(platform-kit): add createPoolServer factory with HTTP routing and health"
```

---

### Task 5: Worker Entry Helper

**Files:**
- Create: `packages/platform-kit/src/pool/worker-entry.ts`

- [ ] **Step 1: Implement worker entry helper**

This is a utility that pool app worker scripts use to reduce boilerplate:

```typescript
// packages/platform-kit/src/pool/worker-entry.ts
import { parentPort, workerData } from 'node:worker_threads'
import type { PoolConnector } from './types.js'
import type { MainToWorkerMessage, WorkerResultMessage } from './types.js'

export async function runWorker(
  createConnector: (config: Record<string, unknown>) => PoolConnector,
): Promise<void> {
  // 1. Create connector from workerData
  // 2. Call connector.connect()
  // 3. Send { type: 'ready' }
  // 4. Listen for messages:
  //    - execute: call connector.registry.execute(action, params), send result
  //    - shutdown: call connector.disconnect(), process.exit(0)
  // 5. Send periodic health messages (every 10s)
  // 6. Catch unhandled errors → send { type: 'error', fatal: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/platform-kit/src/pool/worker-entry.ts
git commit -m "feat(platform-kit): add runWorker helper for worker thread entry points"
```

---

### Task 6: Add /execute Alias + Pool Exports

**Files:**
- Modify: `packages/platform-kit/src/server.ts`
- Create: `packages/platform-kit/src/pool/index.ts`
- Modify: `packages/platform-kit/src/index.ts`

- [ ] **Step 1: Add /execute alias to existing server**

In `packages/platform-kit/src/server.ts`, add a route that mirrors `/api/execute-action`:

```typescript
// After the existing POST /api/execute-action route, add:
app.post('/execute', async (c) => {
  // Same handler as /api/execute-action
  // Extract { action, params } from body (ignore instanceId if present — thin shell mode)
})
```

Refactor: extract the handler into a shared function used by both routes.

- [ ] **Step 2: Create pool/index.ts**

```typescript
// packages/platform-kit/src/pool/index.ts
export { createPoolServer } from './pool-server.js'
export { runWorker } from './worker-entry.js'
export { WorkerWrapper } from './worker-wrapper.js'
export { Reconciler } from './reconciler.js'
export type {
  PoolConnector,
  PoolConfig,
  InstanceRecord,
  BotInstanceRecord,
  UserConnectionRecord,
  WorkerState,
  WorkerHealthMessage,
  // ... all protocol message types
} from './types.js'
```

- [ ] **Step 3: Update main index.ts**

Add to `packages/platform-kit/src/index.ts`:
```typescript
export * from './pool/index.js'
```

- [ ] **Step 4: Run ALL platform-kit tests**

Run: `pnpm platform-kit test`
Expected: ALL tests pass (existing + new)

- [ ] **Step 5: Commit**

```bash
git add packages/platform-kit/src/server.ts \
       packages/platform-kit/src/pool/index.ts \
       packages/platform-kit/src/index.ts
git commit -m "feat(platform-kit): add /execute alias and export pool API"
```

---

### Task 7: Integration Test

**Files:**
- Create: `packages/platform-kit/src/__tests__/pool-integration.test.ts`
- Create: `packages/platform-kit/src/__tests__/fixtures/echo-connector-worker.ts`

- [ ] **Step 1: Create echo connector worker**

A test worker that uses `runWorker()` with a fake connector:

```typescript
// packages/platform-kit/src/__tests__/fixtures/echo-connector-worker.ts
import { runWorker } from '../../pool/worker-entry.js'
import { ActionRegistry } from '../../action-registry.js'
import * as v from 'valibot'

const createEchoConnector = (config: Record<string, unknown>) => ({
  registry: new ActionRegistry(),
  async connect() {
    this.registry.register('echo', {
      schema: v.object({ text: v.string() }),
      handler: async (params) => ({ echoed: params.text, instanceId: config.instanceId }),
    })
    this.registry.register('fail', {
      schema: v.object({}),
      handler: async () => { throw new Error('Intentional failure') },
    })
  },
  async disconnect() {},
  isConnected() { return true },
})

runWorker(createEchoConnector)
```

- [ ] **Step 2: Write integration test**

```typescript
describe('Pool integration', () => {
  // Real createPoolServer with echo-connector-worker
  // 1. Pool starts, reconciler creates workers for 3 fake instances
  // 2. POST /execute { instanceId: 'a', action: 'echo', params: { text: 'hi' } } → { echoed: 'hi', instanceId: 'a' }
  // 3. POST /execute to instance 'b' returns instance 'b' in response (routing works)
  // 4. POST /execute with action 'fail' returns error
  // 5. GET /health shows 3 healthy workers
  // 6. GET /instances lists 3 instances
  // 7. GET /metrics shows action counts
  // 8. Kill one worker (simulate crash) → GET /health shows 2 healthy
  // 9. After reconcile interval, crashed worker is restarted → 3 healthy again
  // 10. stop() gracefully shuts down all workers
})
```

- [ ] **Step 3: Run integration test**

Run: `pnpm platform-kit test -- --testPathPatterns=pool-integration`
Expected: PASS

- [ ] **Step 4: Run ALL tests**

Run: `pnpm platform-kit test`
Expected: ALL tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/platform-kit/src/__tests__/pool-integration.test.ts \
       packages/platform-kit/src/__tests__/fixtures/echo-connector-worker.ts
git commit -m "test(platform-kit): add pool integration test with echo connector worker"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm platform-kit test
```

Expected: All tests pass (existing 49 + new pool tests)

- [ ] **Step 2: Typecheck**

```bash
pnpm platform-kit typecheck
```

Expected: No errors

- [ ] **Step 3: Verify exports work**

Create a temporary test that imports all pool exports to verify the public API:

```typescript
import {
  createPoolServer, runWorker, WorkerWrapper, Reconciler,
  type PoolConnector, type PoolConfig, type InstanceRecord,
} from '@flowbot/platform-kit'
```

- [ ] **Step 4: Commit and document**

```bash
git commit -m "feat(platform-kit): complete pool infrastructure (Phase 1)"
```

Update `packages/platform-kit/README.md` with pool API documentation.
