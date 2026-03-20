# Platform Kit (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/platform-kit` — the shared infrastructure for all platform connectors: ActionRegistry with Valibot validation, generic CircuitBreaker, ConnectorError, Hono server factory, and EventForwarder.

**Architecture:** `platform-kit` is a zero-dependency-on-platforms library. Connectors import it and compose its pieces. The ActionRegistry is the core abstraction — connectors register typed action handlers with Valibot schemas, and the registry validates params, calls handlers, wraps errors, and emits observability hooks. The CircuitBreaker wraps the registry's `execute()` function generically (no per-transport interface). The server factory stamps out identical Hono HTTP servers for every connector.

**Tech Stack:** Valibot 0.42, Hono 4.10, @hono/node-server, Pino 9.9, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-unified-connector-architecture-design.md` (Section 2)

---

## File Map

### New Files

```
packages/platform-kit/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                           # Public exports
    action-registry.ts                 # ActionRegistry class
    circuit-breaker.ts                 # Generic CircuitBreaker
    connector-error.ts                 # ConnectorError class
    event-forwarder.ts                 # EventForwarder (POST events to API)
    server.ts                          # createConnectorServer() Hono factory
    server-manager.ts                  # createServerManager() (start/stop Hono)
    types.ts                           # Shared types (ActionResult, ActionDef, etc.)
  src/__tests__/
    action-registry.test.ts
    circuit-breaker.test.ts
    connector-error.test.ts
    event-forwarder.test.ts
    server.test.ts
```

### Modified Files

```
package.json                           # Add "platform-kit" workspace script
```

---

## Task 1: Package Scaffold + ConnectorError + Types

**Files:**
- Create: `packages/platform-kit/package.json`
- Create: `packages/platform-kit/tsconfig.json`
- Create: `packages/platform-kit/vitest.config.ts`
- Create: `packages/platform-kit/src/connector-error.ts`
- Create: `packages/platform-kit/src/types.ts`
- Create: `packages/platform-kit/src/index.ts`
- Create: `packages/platform-kit/src/__tests__/connector-error.test.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@flowbot/platform-kit",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20.0.0" },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc",
    "build": "tsc --noEmit false",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "4.10.3",
    "@hono/node-server": "1.14.2",
    "pino": "9.9.0",
    "valibot": "0.42.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "typescript": "^5.9.2",
    "vitest": "^3.2.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "$schema": "https://json-schema.store.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "noEmit": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { globals: true },
})
```

- [ ] **Step 4: Write ConnectorError test**

Create `packages/platform-kit/src/__tests__/connector-error.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ConnectorError } from '../connector-error.js'

describe('ConnectorError', () => {
  it('creates error with message and code', () => {
    const err = new ConnectorError('something failed', 'ACTION_FAILED')
    expect(err.message).toBe('something failed')
    expect(err.code).toBe('ACTION_FAILED')
    expect(err.name).toBe('ConnectorError')
    expect(err.original).toBeUndefined()
  })

  it('wraps original error with cause chain', () => {
    const cause = new Error('root cause')
    const err = new ConnectorError('wrapper', 'TRANSPORT_ERROR', cause)
    expect(err.original).toBe(cause)
    expect(err.stack).toContain('Caused by:')
  })

  it('is instanceof Error', () => {
    const err = new ConnectorError('test', 'TEST')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ConnectorError)
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm platform-kit test`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement ConnectorError**

Create `packages/platform-kit/src/connector-error.ts`:

```typescript
export class ConnectorError extends Error {
  public readonly code: string
  public readonly original: unknown

  constructor(message: string, code: string, original?: unknown) {
    super(message)
    this.name = 'ConnectorError'
    this.code = code
    this.original = original

    if (original instanceof Error && original.stack) {
      this.stack = `${this.stack}\nCaused by: ${original.stack}`
    }
  }
}
```

- [ ] **Step 7: Create shared types**

Create `packages/platform-kit/src/types.ts`:

```typescript
import type { BaseSchema } from 'valibot'

export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ActionDef<TParams = unknown> {
  schema: BaseSchema<unknown, TParams, any>
  handler: (params: TParams) => Promise<unknown>
}

export interface ObservabilityHooks {
  onExecute?: (action: string, durationMs: number, success: boolean) => void
  onError?: (action: string, error: unknown) => void
}
```

- [ ] **Step 8: Create index.ts placeholder**

Create `packages/platform-kit/src/index.ts`:

```typescript
export { ConnectorError } from './connector-error.js'
export type { ActionResult, ActionDef, ObservabilityHooks } from './types.js'
```

- [ ] **Step 9: Add root workspace script**

In root `package.json`, add to `scripts`:
```json
"platform-kit": "pnpm --filter @flowbot/platform-kit"
```

- [ ] **Step 10: Install and verify**

Run: `pnpm install && pnpm platform-kit test`
Expected: 3 tests pass.

- [ ] **Step 11: Commit**

```bash
git add packages/platform-kit/ package.json pnpm-lock.yaml
git commit -m "feat(platform-kit): scaffold package with ConnectorError and shared types"
```

---

## Task 2: ActionRegistry

**Files:**
- Create: `packages/platform-kit/src/action-registry.ts`
- Create: `packages/platform-kit/src/__tests__/action-registry.test.ts`
- Modify: `packages/platform-kit/src/index.ts`

- [ ] **Step 1: Write the test**

Create `packages/platform-kit/src/__tests__/action-registry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import { ActionRegistry } from '../action-registry.js'

describe('ActionRegistry', () => {
  it('registers and executes an action', async () => {
    const registry = new ActionRegistry()
    registry.register('greet', {
      schema: v.object({ name: v.string() }),
      handler: async (params) => ({ greeting: `hello ${params.name}` }),
    })

    const result = await registry.execute('greet', { name: 'world' })
    expect(result).toEqual({ success: true, data: { greeting: 'hello world' } })
  })

  it('validates params against schema', async () => {
    const registry = new ActionRegistry()
    registry.register('greet', {
      schema: v.object({ name: v.string() }),
      handler: async (params) => ({ greeting: `hello ${params.name}` }),
    })

    const result = await registry.execute('greet', { name: 123 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid')
  })

  it('returns error for unknown action', async () => {
    const registry = new ActionRegistry()
    const result = await registry.execute('unknown', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('unknown')
  })

  it('catches handler errors', async () => {
    const registry = new ActionRegistry()
    registry.register('fail', {
      schema: v.object({}),
      handler: async () => { throw new Error('boom') },
    })

    const result = await registry.execute('fail', {})
    expect(result.success).toBe(false)
    expect(result.error).toBe('boom')
  })

  it('lists registered actions', () => {
    const registry = new ActionRegistry()
    registry.register('a', { schema: v.object({}), handler: async () => ({}) })
    registry.register('b', { schema: v.object({}), handler: async () => ({}) })

    const actions = registry.getActions()
    expect(actions).toEqual(['a', 'b'])
  })

  it('checks if action is supported', () => {
    const registry = new ActionRegistry()
    registry.register('a', { schema: v.object({}), handler: async () => ({}) })

    expect(registry.supports('a')).toBe(true)
    expect(registry.supports('b')).toBe(false)
  })

  it('calls onExecute hook with timing', async () => {
    const onExecute = vi.fn()
    const registry = new ActionRegistry({ onExecute })
    registry.register('test', {
      schema: v.object({}),
      handler: async () => ({ ok: true }),
    })

    await registry.execute('test', {})
    expect(onExecute).toHaveBeenCalledWith('test', expect.any(Number), true)
  })

  it('calls onError hook on failure', async () => {
    const onError = vi.fn()
    const registry = new ActionRegistry({ onError })
    registry.register('fail', {
      schema: v.object({}),
      handler: async () => { throw new Error('boom') },
    })

    await registry.execute('fail', {})
    expect(onError).toHaveBeenCalledWith('fail', expect.any(Error))
  })

  it('prevents duplicate registration', () => {
    const registry = new ActionRegistry()
    registry.register('a', { schema: v.object({}), handler: async () => ({}) })

    expect(() => {
      registry.register('a', { schema: v.object({}), handler: async () => ({}) })
    }).toThrow('already registered')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm platform-kit test`
Expected: FAIL — ActionRegistry not found.

- [ ] **Step 3: Implement ActionRegistry**

Create `packages/platform-kit/src/action-registry.ts`:

```typescript
import * as v from 'valibot'
import { ConnectorError } from './connector-error.js'
import type { ActionDef, ActionResult, ObservabilityHooks } from './types.js'

export class ActionRegistry {
  private readonly actions = new Map<string, ActionDef<any>>()
  private readonly hooks: ObservabilityHooks

  constructor(hooks: ObservabilityHooks = {}) {
    this.hooks = hooks
  }

  register<TParams>(name: string, def: ActionDef<TParams>): void {
    if (this.actions.has(name)) {
      throw new ConnectorError(`Action '${name}' already registered`, 'DUPLICATE_ACTION')
    }
    this.actions.set(name, def)
  }

  async execute(action: string, rawParams: unknown): Promise<ActionResult> {
    const def = this.actions.get(action)
    if (!def) {
      return { success: false, error: `Unknown action: ${action}` }
    }

    // Validate params
    let params: unknown
    try {
      params = v.parse(def.schema, rawParams)
    } catch (err) {
      const message = err instanceof v.ValiError
        ? `Invalid params: ${err.issues.map(i => i.message).join(', ')}`
        : `Invalid params: ${err instanceof Error ? err.message : String(err)}`
      return { success: false, error: message }
    }

    // Execute handler
    const start = Date.now()
    try {
      const data = await def.handler(params)
      const durationMs = Date.now() - start
      this.hooks.onExecute?.(action, durationMs, true)
      return { success: true, data }
    } catch (err) {
      const durationMs = Date.now() - start
      this.hooks.onExecute?.(action, durationMs, false)
      this.hooks.onError?.(action, err)
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  getActions(): string[] {
    return [...this.actions.keys()]
  }

  supports(action: string): boolean {
    return this.actions.has(action)
  }
}
```

- [ ] **Step 4: Update index.ts**

Add to `packages/platform-kit/src/index.ts`:
```typescript
export { ActionRegistry } from './action-registry.js'
```

- [ ] **Step 5: Run tests**

Run: `pnpm platform-kit test`
Expected: All tests pass (3 ConnectorError + 9 ActionRegistry).

- [ ] **Step 6: Commit**

```bash
git add packages/platform-kit/
git commit -m "feat(platform-kit): add ActionRegistry with Valibot validation and observability hooks"
```

---

## Task 3: Generic CircuitBreaker

**Files:**
- Create: `packages/platform-kit/src/circuit-breaker.ts`
- Create: `packages/platform-kit/src/__tests__/circuit-breaker.test.ts`
- Modify: `packages/platform-kit/src/index.ts`

- [ ] **Step 1: Write the test**

Create `packages/platform-kit/src/__tests__/circuit-breaker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitBreaker, CircuitState, CircuitOpenError } from '../circuit-breaker.js'
import type { Logger } from 'pino'

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger

describe('CircuitBreaker', () => {
  let executeFn: ReturnType<typeof vi.fn>
  let breaker: CircuitBreaker

  beforeEach(() => {
    executeFn = vi.fn().mockResolvedValue({ success: true, data: 'ok' })
    breaker = new CircuitBreaker(executeFn, { failureThreshold: 2, resetTimeoutMs: 100, windowMs: 1000 }, mockLogger)
  })

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('delegates calls to wrapped function', async () => {
    const result = await breaker.call('test_action', { key: 'val' })
    expect(executeFn).toHaveBeenCalledWith('test_action', { key: 'val' })
    expect(result).toEqual({ success: true, data: 'ok' })
  })

  it('opens after failure threshold', async () => {
    executeFn.mockRejectedValue(new Error('fail'))

    await expect(breaker.call('a', {})).rejects.toThrow('fail')
    await expect(breaker.call('b', {})).rejects.toThrow('fail')
    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('rejects calls when OPEN', async () => {
    executeFn.mockRejectedValue(new Error('fail'))
    await expect(breaker.call('a', {})).rejects.toThrow()
    await expect(breaker.call('b', {})).rejects.toThrow()

    await expect(breaker.call('c', {})).rejects.toThrow(CircuitOpenError)
    expect(executeFn).toHaveBeenCalledTimes(2) // not 3
  })

  it('transitions to HALF_OPEN after reset timeout', async () => {
    executeFn.mockRejectedValue(new Error('fail'))
    await expect(breaker.call('a', {})).rejects.toThrow()
    await expect(breaker.call('b', {})).rejects.toThrow()
    expect(breaker.getState()).toBe(CircuitState.OPEN)

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 150))

    executeFn.mockResolvedValue({ success: true })
    const result = await breaker.call('probe', {})
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect(result).toEqual({ success: true })
  })

  it('re-opens on probe failure in HALF_OPEN', async () => {
    executeFn.mockRejectedValue(new Error('fail'))
    await expect(breaker.call('a', {})).rejects.toThrow()
    await expect(breaker.call('b', {})).rejects.toThrow()

    await new Promise(r => setTimeout(r, 150))

    // Probe also fails
    await expect(breaker.call('probe', {})).rejects.toThrow('fail')
    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('does not count successes as failures', async () => {
    await breaker.call('ok1', {})
    await breaker.call('ok2', {})
    await breaker.call('ok3', {})
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm platform-kit test`
Expected: FAIL — CircuitBreaker not found.

- [ ] **Step 3: Implement CircuitBreaker**

Create `packages/platform-kit/src/circuit-breaker.ts`:

```typescript
import type { Logger } from 'pino'

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
  windowMs: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  windowMs: 60_000,
}

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is OPEN — requests are being rejected') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

type ExecuteFn = (action: string, params: unknown) => Promise<unknown>

export class CircuitBreaker {
  private readonly fn: ExecuteFn
  private readonly config: CircuitBreakerConfig
  private readonly logger: Logger

  private state: CircuitState = CircuitState.CLOSED
  private failures: number[] = []
  private openedAt: number | null = null

  constructor(fn: ExecuteFn, config: Partial<CircuitBreakerConfig> = {}, logger: Logger) {
    this.fn = fn
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = logger.child?.({ component: 'CircuitBreaker' }) ?? logger
  }

  getState(): CircuitState {
    return this.state
  }

  async call(action: string, params: unknown): Promise<unknown> {
    const now = Date.now()

    if (this.state === CircuitState.OPEN) {
      if (this.openedAt !== null && now - this.openedAt >= this.config.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN)
      } else {
        throw new CircuitOpenError()
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      try {
        const result = await this.fn(action, params)
        this.onSuccess()
        return result
      } catch (error) {
        this.onFailure()
        throw error
      }
    }

    // CLOSED
    try {
      return await this.fn(action, params)
    } catch (error) {
      this.recordFailure(now)
      throw error
    }
  }

  private recordFailure(now: number): void {
    const windowStart = now - this.config.windowMs
    this.failures.push(now)
    this.failures = this.failures.filter(t => t > windowStart)

    this.logger.warn(
      { failureCount: this.failures.length, threshold: this.config.failureThreshold },
      'Action call failed',
    )

    if (this.failures.length >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN)
    }
  }

  private onSuccess(): void {
    this.logger.info('Probe succeeded, closing circuit')
    this.failures = []
    this.openedAt = null
    this.transitionTo(CircuitState.CLOSED)
  }

  private onFailure(): void {
    this.logger.warn('Probe failed, re-opening circuit')
    this.transitionTo(CircuitState.OPEN)
  }

  private transitionTo(newState: CircuitState): void {
    const prev = this.state
    this.state = newState
    this.logger.info({ from: prev, to: newState }, 'Circuit state transition')

    if (newState === CircuitState.OPEN) {
      this.openedAt = Date.now()
    }
    if (newState === CircuitState.CLOSED) {
      this.failures = []
      this.openedAt = null
    }
  }
}
```

- [ ] **Step 4: Update index.ts**

Add to exports:
```typescript
export { CircuitBreaker, CircuitState, CircuitOpenError } from './circuit-breaker.js'
export type { CircuitBreakerConfig } from './circuit-breaker.js'
```

- [ ] **Step 5: Run tests**

Run: `pnpm platform-kit test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/platform-kit/
git commit -m "feat(platform-kit): add generic CircuitBreaker with sliding window"
```

---

## Task 4: EventForwarder

**Files:**
- Create: `packages/platform-kit/src/event-forwarder.ts`
- Create: `packages/platform-kit/src/__tests__/event-forwarder.test.ts`
- Modify: `packages/platform-kit/src/index.ts`

- [ ] **Step 1: Write the test**

Create `packages/platform-kit/src/__tests__/event-forwarder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventForwarder } from '../event-forwarder.js'
import type { Logger } from 'pino'

const mockLogger = {
  child: () => mockLogger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger

describe('EventForwarder', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('POSTs event to API webhook URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch

    const forwarder = new EventForwarder({ apiUrl: 'http://api:3000', logger: mockLogger })
    await forwarder.send({ platform: 'whatsapp', eventType: 'message_received', data: { text: 'hi' } })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://api:3000/api/flow/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      }),
    )
  })

  it('logs warning on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 })
    const forwarder = new EventForwarder({ apiUrl: 'http://api:3000', logger: mockLogger })

    await forwarder.send({ platform: 'test', eventType: 'test' })
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('logs error on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))
    const forwarder = new EventForwarder({ apiUrl: 'http://api:3000', logger: mockLogger })

    // Should not throw — errors are caught and logged
    await forwarder.send({ platform: 'test', eventType: 'test' })
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('does not throw on failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const forwarder = new EventForwarder({ apiUrl: 'http://api:3000', logger: mockLogger })

    await expect(forwarder.send({ platform: 'test', eventType: 'test' })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm platform-kit test`
Expected: FAIL.

- [ ] **Step 3: Implement EventForwarder**

Create `packages/platform-kit/src/event-forwarder.ts`:

```typescript
import type { Logger } from 'pino'

export interface FlowTriggerEvent {
  platform: string
  communityId?: string | null
  accountId?: string
  eventType: string
  data?: Record<string, unknown>
  timestamp?: string
  botInstanceId?: string
}

export interface EventForwarderConfig {
  apiUrl: string
  logger: Logger
  timeoutMs?: number
  webhookPath?: string
}

export class EventForwarder {
  private readonly apiUrl: string
  private readonly logger: Logger
  private readonly timeoutMs: number
  private readonly webhookPath: string

  constructor(config: EventForwarderConfig) {
    this.apiUrl = config.apiUrl
    this.logger = config.logger.child?.({ component: 'EventForwarder' }) ?? config.logger
    this.timeoutMs = config.timeoutMs ?? 10_000
    this.webhookPath = config.webhookPath ?? '/api/flow/webhook'
  }

  async send(event: FlowTriggerEvent): Promise<void> {
    const url = `${this.apiUrl}${this.webhookPath}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.timeoutMs),
      })

      if (!response.ok) {
        this.logger.warn({ status: response.status, eventType: event.eventType }, 'Event forwarding failed')
      }
    } catch (err) {
      this.logger.error({ err, eventType: event.eventType }, 'Failed to forward event')
    }
  }
}
```

- [ ] **Step 4: Update index.ts**

Add:
```typescript
export { EventForwarder } from './event-forwarder.js'
export type { FlowTriggerEvent, EventForwarderConfig } from './event-forwarder.js'
```

- [ ] **Step 5: Run tests**

Run: `pnpm platform-kit test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/platform-kit/
git commit -m "feat(platform-kit): add EventForwarder for flow webhook event delivery"
```

---

## Task 5: Connector Server Factory

**Files:**
- Create: `packages/platform-kit/src/server.ts`
- Create: `packages/platform-kit/src/server-manager.ts`
- Create: `packages/platform-kit/src/__tests__/server.test.ts`
- Modify: `packages/platform-kit/src/index.ts`

- [ ] **Step 1: Write the test**

Create `packages/platform-kit/src/__tests__/server.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import * as v from 'valibot'
import { createConnectorServer } from '../server.js'
import { ActionRegistry } from '../action-registry.js'

describe('createConnectorServer', () => {
  function makeRegistry() {
    const registry = new ActionRegistry()
    registry.register('ping', {
      schema: v.object({}),
      handler: async () => ({ pong: true }),
    })
    return registry
  }

  const mockLogger = {
    child: () => mockLogger,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as any

  it('GET /health returns status', async () => {
    const server = createConnectorServer({
      registry: makeRegistry(),
      logger: mockLogger,
      healthCheck: () => true,
    })

    const res = await server.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.connected).toBe(true)
    expect(body.uptime).toBeTypeOf('number')
  })

  it('POST /api/execute-action executes action', async () => {
    const server = createConnectorServer({
      registry: makeRegistry(),
      logger: mockLogger,
      healthCheck: () => true,
    })

    const res = await server.request('/api/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping', params: {} }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ pong: true })
  })

  it('POST /api/execute-action returns 400 for missing action', async () => {
    const server = createConnectorServer({
      registry: makeRegistry(),
      logger: mockLogger,
      healthCheck: () => true,
    })

    const res = await server.request('/api/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: {} }),
    })

    expect(res.status).toBe(400)
  })

  it('POST /api/execute-action returns 400 for unknown action', async () => {
    const server = createConnectorServer({
      registry: makeRegistry(),
      logger: mockLogger,
      healthCheck: () => true,
    })

    const res = await server.request('/api/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nonexistent', params: {} }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('GET /api/actions returns registered action names', async () => {
    const server = createConnectorServer({
      registry: makeRegistry(),
      logger: mockLogger,
      healthCheck: () => true,
    })

    const res = await server.request('/api/actions')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.actions).toEqual(['ping'])
  })

  it('returns degraded health when not connected', async () => {
    const server = createConnectorServer({
      registry: makeRegistry(),
      logger: mockLogger,
      healthCheck: () => false,
    })

    const res = await server.request('/health')
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.connected).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm platform-kit test`
Expected: FAIL.

- [ ] **Step 3: Implement server factory**

Create `packages/platform-kit/src/server.ts`:

```typescript
import type { Logger } from 'pino'
import process from 'node:process'
import { Hono } from 'hono'
import type { ActionRegistry } from './action-registry.js'

export interface ConnectorServerConfig {
  registry: ActionRegistry
  logger: Logger
  healthCheck: () => boolean
  authMiddleware?: (c: any, next: () => Promise<void>) => Promise<void | Response>
}

export function createConnectorServer(config: ConnectorServerConfig) {
  const { registry, logger, healthCheck } = config
  const server = new Hono()
  const startedAt = Date.now()

  server.get('/health', (c) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const memUsage = process.memoryUsage()
    const connected = healthCheck()
    const status = connected ? 'ok' : 'degraded'

    return c.json({
      status,
      uptime,
      connected,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      actions: registry.getActions().length,
    }, connected ? 200 : 503)
  })

  server.post('/api/execute-action', async (c) => {
    let body: { action?: string; params?: Record<string, unknown> }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400)
    }

    if (!body.action) {
      return c.json({ success: false, error: 'action is required' }, 400)
    }

    const result = await registry.execute(body.action, body.params ?? {})
    return c.json(result, result.success ? 200 : 400)
  })

  server.get('/api/actions', (c) => {
    return c.json({ actions: registry.getActions() })
  })

  server.onError((error, c) => {
    logger.error({ err: error, path: c.req.path })
    return c.json({ error: 'Internal server error' }, 500)
  })

  return server
}
```

- [ ] **Step 4: Implement server manager**

Create `packages/platform-kit/src/server-manager.ts`:

```typescript
import { serve } from '@hono/node-server'

export function createServerManager(
  server: { fetch: (...args: any[]) => any },
  options: { host: string; port: number },
) {
  let handle: undefined | ReturnType<typeof serve>

  return {
    start() {
      return new Promise<{ url: string }>((resolve) => {
        handle = serve(
          {
            fetch: server.fetch,
            hostname: options.host,
            port: options.port,
          },
          (info) => {
            resolve({
              url: info.family === 'IPv6'
                ? `http://[${info.address}]:${info.port}`
                : `http://${info.address}:${info.port}`,
            })
          },
        )
      })
    },
    stop() {
      return new Promise<void>((resolve) => {
        if (handle)
          handle.close(() => resolve())
        else
          resolve()
      })
    },
  }
}
```

- [ ] **Step 5: Update index.ts**

Add:
```typescript
export { createConnectorServer } from './server.js'
export type { ConnectorServerConfig } from './server.js'
export { createServerManager } from './server-manager.js'
```

- [ ] **Step 6: Run tests**

Run: `pnpm platform-kit test`
Expected: All tests pass.

- [ ] **Step 7: Typecheck**

Run: `pnpm platform-kit typecheck`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add packages/platform-kit/
git commit -m "feat(platform-kit): add connector server factory and server manager"
```

---

## Task 6: Final Verification + CI

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Run full test suite**

```bash
pnpm platform-kit test
```

Expected: All tests pass across 5 test files.

- [ ] **Step 2: Run typecheck**

```bash
pnpm platform-kit typecheck
```

Expected: No errors.

- [ ] **Step 3: Add CI job**

In `.github/workflows/test.yml`, add after the WhatsApp bot job:

```yaml
  platform-kit-unit:
    name: Platform Kit Unit Tests (Vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm platform-kit test
```

Note: platform-kit does not need `pnpm db generate` or `pnpm db build` since it has no Prisma dependency.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add platform-kit unit test job"
```

- [ ] **Step 5: Verify all packages still work**

```bash
pnpm whatsapp-transport test
pnpm whatsapp-bot test
pnpm api build
```

These should be unaffected since platform-kit is a new package with no consumers yet.
