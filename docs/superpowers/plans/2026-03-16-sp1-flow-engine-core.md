# Sub-Project 1: Flow Engine Core — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared user context, flow chaining (run_flow + emit/custom events), and hybrid trigger routing to the flow engine.

**Architecture:** New Prisma models (`UserFlowContext`, `FlowEvent`) for persistent state. The executor gains `taskCallbacks` for Trigger.dev SDK access (enabling `run_flow`). Bot middleware matches incoming events against a trigger registry synced from the API. All new node types follow existing patterns in `actions.ts`/`conditions.ts`.

**Tech Stack:** Prisma 7, Trigger.dev v3 SDK, Vitest, NestJS 11, grammY, Hono

**Spec:** `docs/superpowers/specs/2026-03-16-flow-builder-extension-design.md`

---

## Chunk 1: Phase 1A — Shared User Context

### Task 1: Add Prisma Models

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add UserFlowContext model to schema**

Add after the `FlowVersion` model (around line 473):

```prisma
model UserFlowContext {
  id             String   @id @default(cuid())
  platformUserId String
  platform       String   // "telegram" | "discord"
  key            String
  value          Json
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([platformUserId, platform, key])
  @@index([platformUserId, platform])
}
```

- [ ] **Step 2: Add FlowEvent model to schema**

Add after `UserFlowContext`:

```prisma
model FlowEvent {
  id                String   @id @default(cuid())
  eventName         String
  payload           Json
  sourceFlowId      String
  sourceExecutionId String
  createdAt         DateTime @default(now())
  expiresAt         DateTime @default(dbgenerated("NOW() + INTERVAL '30 days'"))

  @@index([eventName])
  @@index([sourceFlowId])
  @@index([expiresAt])
}
```

- [ ] **Step 3: Run migration**

```bash
cd /root/Development/tg-allegro
pnpm db prisma:push
pnpm db generate
pnpm db build
```

Expected: Schema pushed successfully, Prisma Client regenerated.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): add UserFlowContext and FlowEvent models"
```

---

### Task 2: Create Context Store Module

**Files:**
- Create: `apps/trigger/src/lib/flow-engine/context-store.ts`
- Test: `apps/trigger/src/__tests__/context-store.test.ts`

- [ ] **Step 1: Write failing tests for context store**

Create `apps/trigger/src/__tests__/context-store.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getContext, setContext, deleteContext, listContextKeys } from '../lib/flow-engine/context-store.js'

// Mock Prisma
const mockPrisma = {
  userFlowContext: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
}

describe('context-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getContext', () => {
    it('returns value when key exists', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue({
        id: '1',
        platformUserId: 'user-123',
        platform: 'telegram',
        key: 'language',
        value: 'pl',
      })

      const result = await getContext(mockPrisma as any, 'user-123', 'telegram', 'language')
      expect(result).toBe('pl')
      expect(mockPrisma.userFlowContext.findUnique).toHaveBeenCalledWith({
        where: {
          platformUserId_platform_key: {
            platformUserId: 'user-123',
            platform: 'telegram',
            key: 'language',
          },
        },
      })
    })

    it('returns defaultValue when key does not exist', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)

      const result = await getContext(mockPrisma as any, 'user-123', 'telegram', 'language', 'en')
      expect(result).toBe('en')
    })

    it('returns undefined when key does not exist and no default', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)

      const result = await getContext(mockPrisma as any, 'user-123', 'telegram', 'language')
      expect(result).toBeUndefined()
    })
  })

  describe('setContext', () => {
    it('upserts value for user+platform+key', async () => {
      mockPrisma.userFlowContext.upsert.mockResolvedValue({
        id: '1',
        platformUserId: 'user-123',
        platform: 'telegram',
        key: 'language',
        value: 'pl',
      })

      await setContext(mockPrisma as any, 'user-123', 'telegram', 'language', 'pl')
      expect(mockPrisma.userFlowContext.upsert).toHaveBeenCalledWith({
        where: {
          platformUserId_platform_key: {
            platformUserId: 'user-123',
            platform: 'telegram',
            key: 'language',
          },
        },
        update: { value: 'pl' },
        create: {
          platformUserId: 'user-123',
          platform: 'telegram',
          key: 'language',
          value: 'pl',
        },
      })
    })
  })

  describe('deleteContext', () => {
    it('deletes existing key', async () => {
      mockPrisma.userFlowContext.delete.mockResolvedValue({})

      await deleteContext(mockPrisma as any, 'user-123', 'telegram', 'language')
      expect(mockPrisma.userFlowContext.delete).toHaveBeenCalledWith({
        where: {
          platformUserId_platform_key: {
            platformUserId: 'user-123',
            platform: 'telegram',
            key: 'language',
          },
        },
      })
    })

    it('does not throw when key does not exist', async () => {
      mockPrisma.userFlowContext.delete.mockRejectedValue({ code: 'P2025' })

      await expect(
        deleteContext(mockPrisma as any, 'user-123', 'telegram', 'nonexistent'),
      ).resolves.toBeUndefined()
    })
  })

  describe('listContextKeys', () => {
    it('returns all keys for a user+platform', async () => {
      mockPrisma.userFlowContext.findMany.mockResolvedValue([
        { key: 'language', value: 'pl' },
        { key: 'onboarding_step', value: 3 },
      ])

      const result = await listContextKeys(mockPrisma as any, 'user-123', 'telegram')
      expect(result).toEqual([
        { key: 'language', value: 'pl' },
        { key: 'onboarding_step', value: 3 },
      ])
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=context-store
```

Expected: FAIL — module `context-store.js` not found.

- [ ] **Step 3: Implement context store**

Create `apps/trigger/src/lib/flow-engine/context-store.ts`:

```typescript
interface PrismaLike {
  userFlowContext: {
    findUnique: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
}

export async function getContext(
  prisma: PrismaLike,
  platformUserId: string,
  platform: string,
  key: string,
  defaultValue?: unknown,
): Promise<unknown> {
  const record = await prisma.userFlowContext.findUnique({
    where: {
      platformUserId_platform_key: { platformUserId, platform, key },
    },
  })
  return record ? record.value : defaultValue
}

export async function setContext(
  prisma: PrismaLike,
  platformUserId: string,
  platform: string,
  key: string,
  value: unknown,
): Promise<void> {
  await prisma.userFlowContext.upsert({
    where: {
      platformUserId_platform_key: { platformUserId, platform, key },
    },
    update: { value },
    create: { platformUserId, platform, key, value },
  })
}

export async function deleteContext(
  prisma: PrismaLike,
  platformUserId: string,
  platform: string,
  key: string,
): Promise<void> {
  try {
    await prisma.userFlowContext.delete({
      where: {
        platformUserId_platform_key: { platformUserId, platform, key },
      },
    })
  } catch (err: any) {
    if (err?.code === 'P2025') return // Record not found — ignore
    throw err
  }
}

export async function listContextKeys(
  prisma: PrismaLike,
  platformUserId: string,
  platform: string,
): Promise<Array<{ key: string; value: unknown }>> {
  const records = await prisma.userFlowContext.findMany({
    where: { platformUserId, platform },
    select: { key: true, value: true },
  })
  return records
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=context-store
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/context-store.ts apps/trigger/src/__tests__/context-store.test.ts
git commit -m "feat(flow-engine): add context-store module with CRUD operations"
```

---

### Task 3: Add Context Action Nodes

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/actions.ts`
- Modify: `apps/trigger/src/lib/flow-engine/executor.ts` (NON_CACHEABLE_TYPES + ExecutorConfig)
- Modify: `apps/trigger/src/lib/flow-engine/index.ts`
- Test: `apps/trigger/src/__tests__/context-actions.test.ts`

- [ ] **Step 1: Write failing tests for context action nodes**

Create `apps/trigger/src/__tests__/context-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

const mockPrisma = {
  userFlowContext: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: {
      platformUserId: 'user-123',
      platform: 'telegram',
    },
    nodeResults: new Map(),
    ...overrides,
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('context action nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('get_context', () => {
    it('reads value and sets it as node output', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue({
        value: 'pl',
      })
      const ctx = createContext()
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('get_context', { key: 'language', defaultValue: 'en' })
      const result = await executeAction(node, ctx)

      expect(result).toEqual({ action: 'get_context', key: 'language', value: 'pl' })
    })

    it('returns defaultValue when key missing', async () => {
      mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)
      const ctx = createContext()
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('get_context', { key: 'language', defaultValue: 'en' })
      const result = await executeAction(node, ctx)

      expect(result).toEqual({ action: 'get_context', key: 'language', value: 'en' })
    })
  })

  describe('set_context', () => {
    it('writes interpolated value', async () => {
      mockPrisma.userFlowContext.upsert.mockResolvedValue({})
      const ctx = createContext({
        triggerData: { platformUserId: 'user-123', platform: 'telegram', language: 'pl' },
      })
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('set_context', { key: 'user_lang', value: '{{trigger.language}}' })
      const result = await executeAction(node, ctx)

      expect(result).toEqual({ action: 'set_context', key: 'user_lang', value: 'pl', executed: true })
      expect(mockPrisma.userFlowContext.upsert).toHaveBeenCalled()
    })
  })

  describe('delete_context', () => {
    it('deletes key', async () => {
      mockPrisma.userFlowContext.delete.mockResolvedValue({})
      const ctx = createContext()
      ;(ctx as any)._prisma = mockPrisma

      const node = createNode('delete_context', { key: 'language' })
      const result = await executeAction(node, ctx)

      expect(result).toEqual({ action: 'delete_context', key: 'language', executed: true })
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=context-actions
```

Expected: FAIL — no matching case for `get_context`.

- [ ] **Step 3: Update ExecutorConfig to include prisma reference**

In `apps/trigger/src/lib/flow-engine/executor.ts`, add `_prisma` to the context passed through execution. Update the `ExecutorConfig` interface:

```typescript
export interface ExecutorConfig {
  defaultErrorHandling: ErrorHandling;
  maxNodes: number;
  enableNodeCache: boolean;
  maxCacheSize: number;
  prisma?: any;
  taskCallbacks?: {
    triggerAndWait: (taskId: string, payload: unknown) => Promise<unknown>;
    trigger: (taskId: string, payload: unknown) => Promise<void>;
  };
}
```

In the `executeFlow` function, after creating `ctx`, add:

```typescript
if (mergedConfig.prisma) {
  (ctx as any)._prisma = mergedConfig.prisma;
}
if (mergedConfig.taskCallbacks) {
  (ctx as any)._taskCallbacks = mergedConfig.taskCallbacks;
}
```

- [ ] **Step 4: Add context nodes to NON_CACHEABLE_TYPES**

In `executor.ts`, add to the `NON_CACHEABLE_TYPES` set:

```typescript
'get_context', 'set_context', 'delete_context',
```

- [ ] **Step 5: Add context action executors to actions.ts**

At the top of `actions.ts`, add import:

```typescript
import { getContext, setContext, deleteContext } from './context-store.js'
import { interpolate } from './variables.js'
```

Add cases to the `executeAction` switch:

```typescript
case 'get_context': return executeGetContext(node, ctx);
case 'set_context': return executeSetContext(node, ctx);
case 'delete_context': return executeDeleteContext(node, ctx);
```

Add executor functions at the end of the file:

```typescript
async function executeGetContext(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const prisma = (ctx as any)._prisma
  if (!prisma) throw new Error('get_context requires prisma in executor config')
  const { key, defaultValue } = node.config as { key: string; defaultValue?: unknown }
  const platformUserId = String(ctx.triggerData.platformUserId ?? ctx.triggerData.userId ?? '')
  const platform = String(ctx.triggerData.platform ?? 'telegram')
  const value = await getContext(prisma, platformUserId, platform, key, defaultValue)
  return { action: 'get_context', key, value }
}

async function executeSetContext(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const prisma = (ctx as any)._prisma
  if (!prisma) throw new Error('set_context requires prisma in executor config')
  const { key, value: rawValue } = node.config as { key: string; value: string }
  const interpolatedValue = interpolate(String(rawValue), ctx)
  const platformUserId = String(ctx.triggerData.platformUserId ?? ctx.triggerData.userId ?? '')
  const platform = String(ctx.triggerData.platform ?? 'telegram')
  await setContext(prisma, platformUserId, platform, key, interpolatedValue)
  return { action: 'set_context', key, value: interpolatedValue, executed: true }
}

async function executeDeleteContext(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const prisma = (ctx as any)._prisma
  if (!prisma) throw new Error('delete_context requires prisma in executor config')
  const { key } = node.config as { key: string }
  const platformUserId = String(ctx.triggerData.platformUserId ?? ctx.triggerData.userId ?? '')
  const platform = String(ctx.triggerData.platform ?? 'telegram')
  await deleteContext(prisma, platformUserId, platform, key)
  return { action: 'delete_context', key, executed: true }
}
```

- [ ] **Step 6: Export context-store from index.ts**

In `apps/trigger/src/lib/flow-engine/index.ts`, add:

```typescript
export { getContext, setContext, deleteContext, listContextKeys } from './context-store.js';
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=context-actions
```

Expected: All tests PASS.

- [ ] **Step 8: Run full flow-engine test suite**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

Expected: All existing tests still pass.

- [ ] **Step 9: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/actions.ts apps/trigger/src/lib/flow-engine/executor.ts apps/trigger/src/lib/flow-engine/index.ts apps/trigger/src/__tests__/context-actions.test.ts
git commit -m "feat(flow-engine): add get_context, set_context, delete_context action nodes"
```

---

### Task 4: Add Context Condition Node

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/conditions.ts`
- Test: `apps/trigger/src/__tests__/context-condition.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/trigger/src/__tests__/context-condition.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { evaluateCondition } from '../lib/flow-engine/conditions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

const mockPrisma = {
  userFlowContext: {
    findUnique: vi.fn(),
  },
}

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: { platformUserId: 'user-123', platform: 'telegram' },
    nodeResults: new Map(),
    ...overrides,
  }
}

function createNode(config: Record<string, unknown>): FlowNode {
  return { id: 'cond-1', type: 'context_condition', category: 'condition', label: 'Context Condition', config }
}

describe('context_condition evaluator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when key exists and operator is "exists"', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'anything' })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const node = createNode({ key: 'language', operator: 'exists' })
    const result = await evaluateCondition(node, ctx)
    expect(result).toBe(true)
  })

  it('returns false when key does not exist and operator is "exists"', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue(null)
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const node = createNode({ key: 'language', operator: 'exists' })
    const result = await evaluateCondition(node, ctx)
    expect(result).toBe(false)
  })

  it('returns true when value equals expected', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'pl' })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const node = createNode({ key: 'language', operator: 'equals', value: 'pl' })
    const result = await evaluateCondition(node, ctx)
    expect(result).toBe(true)
  })

  it('returns false when value does not equal expected', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'en' })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const node = createNode({ key: 'language', operator: 'equals', value: 'pl' })
    const result = await evaluateCondition(node, ctx)
    expect(result).toBe(false)
  })

  it('returns true when numeric value is greater than threshold', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 5 })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const node = createNode({ key: 'score', operator: 'gt', value: 3 })
    const result = await evaluateCondition(node, ctx)
    expect(result).toBe(true)
  })

  it('returns true when string value contains substring', async () => {
    mockPrisma.userFlowContext.findUnique.mockResolvedValue({ value: 'hello world' })
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma

    const node = createNode({ key: 'greeting', operator: 'contains', value: 'world' })
    const result = await evaluateCondition(node, ctx)
    expect(result).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=context-condition
```

Expected: FAIL — `context_condition` returns `false` (unhandled type).

- [ ] **Step 3: Add context_condition evaluator to conditions.ts**

Add import at top of `conditions.ts`:

```typescript
import { getContext } from './context-store.js'
```

Add case to `evaluateCondition` switch:

```typescript
case 'context_condition': return evaluateContextCondition(node, ctx);
```

Add evaluator function:

```typescript
async function evaluateContextCondition(node: FlowNode, ctx: FlowContext): Promise<boolean> {
  const prisma = (ctx as any)._prisma
  if (!prisma) return false

  const { key, operator, value: expected } = node.config as {
    key: string
    operator: 'equals' | 'exists' | 'gt' | 'lt' | 'contains'
    value?: unknown
  }

  const platformUserId = String(ctx.triggerData.platformUserId ?? ctx.triggerData.userId ?? '')
  const platform = String(ctx.triggerData.platform ?? 'telegram')
  const actual = await getContext(prisma, platformUserId, platform, key)

  switch (operator) {
    case 'exists':
      return actual !== undefined
    case 'equals':
      return actual === expected
    case 'gt':
      return Number(actual) > Number(expected)
    case 'lt':
      return Number(actual) < Number(expected)
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected)
    default:
      return false
  }
}
```

**Note:** `evaluateCondition` may currently be synchronous. If so, change its return type from `boolean` to `boolean | Promise<boolean>` and update the caller in `executor.ts` to `await` the result. Check if the executor already awaits condition evaluation — it likely does since other evaluators may be async.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=context-condition
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/conditions.ts apps/trigger/src/__tests__/context-condition.test.ts
git commit -m "feat(flow-engine): add context_condition evaluator"
```

---

### Task 5: Add context.* Variable Interpolation

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/variables.ts`
- Test: `apps/trigger/src/__tests__/context-variables.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/trigger/src/__tests__/context-variables.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { interpolate } from '../lib/flow-engine/variables.js'
import type { FlowContext } from '../lib/flow-engine/types.js'

const mockPrisma = {
  userFlowContext: {
    findUnique: vi.fn(),
  },
}

function createContext(): FlowContext {
  const ctx: FlowContext = {
    flowId: 'test-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: { platformUserId: 'user-123', platform: 'telegram' },
    nodeResults: new Map(),
  }
  ;(ctx as any)._prisma = mockPrisma
  ;(ctx as any)._contextCache = new Map<string, unknown>()
  return ctx
}

describe('context.* variable interpolation', () => {
  it('resolves {{context.language}} from cache', () => {
    const ctx = createContext()
    ;(ctx as any)._contextCache.set('language', 'pl')

    const result = interpolate('Language: {{context.language}}', ctx)
    expect(result).toBe('Language: pl')
  })

  it('leaves {{context.missing}} as-is when not in cache', () => {
    const ctx = createContext()

    const result = interpolate('Val: {{context.missing}}', ctx)
    expect(result).toBe('Val: {{context.missing}}')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=context-variables
```

Expected: FAIL — `context.*` not resolved.

- [ ] **Step 3: Add context.* resolution to interpolate function**

In `variables.ts`, inside the `interpolate` function's replacement logic, add a new resolution path before the direct variable lookup:

```typescript
// After trigger.* and node.* resolution, before direct variable lookup:
if (varPath.startsWith('context.')) {
  const contextKey = varPath.slice('context.'.length)
  const contextCache = (ctx as any)._contextCache as Map<string, unknown> | undefined
  if (contextCache?.has(contextKey)) {
    return String(contextCache.get(contextKey) ?? '')
  }
  return match // Leave unresolved
}
```

Also, in `executeGetContext` (in `actions.ts`), after reading the value, populate the cache:

```typescript
// In executeGetContext, after getting the value:
if (!(ctx as any)._contextCache) {
  (ctx as any)._contextCache = new Map<string, unknown>()
}
(ctx as any)._contextCache.set(key, value)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=context-variables
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/variables.ts apps/trigger/src/lib/flow-engine/actions.ts apps/trigger/src/__tests__/context-variables.test.ts
git commit -m "feat(flow-engine): add context.* variable interpolation namespace"
```

---

### Task 6: Add Context Nodes to Frontend

**Files:**
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`

- [ ] **Step 1: Add context nodes to NODE_TYPES_CONFIG**

In the editor page, find the node types config array. Add a new "Context" section in the Telegram actions area (these are platform-agnostic but go under general):

```typescript
// Context nodes — add to the action nodes section
{ type: 'get_context', label: 'Get Context', category: 'action', platform: 'general' },
{ type: 'set_context', label: 'Set Context', category: 'action', platform: 'general' },
{ type: 'delete_context', label: 'Delete Context', category: 'action', platform: 'general' },

// Context condition — add to the condition nodes section
{ type: 'context_condition', label: 'Context Check', category: 'condition', platform: 'general' },
```

**Note:** If the platform filter doesn't support `'general'`, use the pattern that existing cross-platform nodes (like `delay`, `api_call`) use. Check the existing filter logic and follow the same convention.

- [ ] **Step 2: Verify frontend builds**

```bash
cd /root/Development/tg-allegro && pnpm frontend build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx
git commit -m "feat(frontend): add context nodes to flow editor palette"
```

---

## Chunk 2: Phase 1B — Flow Chaining

### Task 7: Add run_flow Action Node

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/actions.ts`
- Modify: `apps/trigger/src/lib/flow-engine/executor.ts`
- Modify: `apps/trigger/src/trigger/flow-execution.ts`
- Test: `apps/trigger/src/__tests__/flow-chaining.test.ts`

- [ ] **Step 1: Write failing tests for run_flow**

Create `apps/trigger/src/__tests__/flow-chaining.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'parent-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: { _chainDepth: 0 },
    nodeResults: new Map(),
    ...overrides,
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('run_flow action', () => {
  it('calls triggerAndWait when waitForResult is true', async () => {
    const mockTriggerAndWait = vi.fn().mockResolvedValue({ ok: true, output: { result: 'done' } })
    const ctx = createContext()
    ;(ctx as any)._taskCallbacks = {
      triggerAndWait: mockTriggerAndWait,
      trigger: vi.fn(),
    }

    const node = createNode('run_flow', {
      flowId: 'child-flow',
      waitForResult: true,
      inputVariables: { greeting: 'hello' },
    })

    const result = await executeAction(node, ctx)

    expect(mockTriggerAndWait).toHaveBeenCalledWith('flow-execution', {
      flowId: 'child-flow',
      triggerData: { greeting: 'hello', _chainDepth: 1 },
    })
    expect(result).toEqual({
      action: 'run_flow',
      flowId: 'child-flow',
      waitForResult: true,
      output: { result: 'done' },
    })
  })

  it('calls trigger (fire-and-forget) when waitForResult is false', async () => {
    const mockTrigger = vi.fn().mockResolvedValue(undefined)
    const ctx = createContext()
    ;(ctx as any)._taskCallbacks = {
      triggerAndWait: vi.fn(),
      trigger: mockTrigger,
    }

    const node = createNode('run_flow', {
      flowId: 'child-flow',
      waitForResult: false,
    })

    const result = await executeAction(node, ctx)

    expect(mockTrigger).toHaveBeenCalledWith('flow-execution', {
      flowId: 'child-flow',
      triggerData: { _chainDepth: 1 },
    })
    expect(result).toEqual({
      action: 'run_flow',
      flowId: 'child-flow',
      waitForResult: false,
      fired: true,
    })
  })

  it('throws when chain depth exceeds max (5)', async () => {
    const ctx = createContext({
      triggerData: { _chainDepth: 5 },
    })
    ;(ctx as any)._taskCallbacks = {
      triggerAndWait: vi.fn(),
      trigger: vi.fn(),
    }

    const node = createNode('run_flow', { flowId: 'child-flow', waitForResult: true })

    await expect(executeAction(node, ctx)).rejects.toThrow('Maximum chain depth')
  })

  it('throws when taskCallbacks not available', async () => {
    const ctx = createContext()
    const node = createNode('run_flow', { flowId: 'child-flow', waitForResult: true })

    await expect(executeAction(node, ctx)).rejects.toThrow('taskCallbacks')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=flow-chaining
```

Expected: FAIL.

- [ ] **Step 3: Add run_flow executor to actions.ts**

Add case to `executeAction` switch:

```typescript
case 'run_flow': return executeRunFlow(node, ctx);
```

Add executor function:

```typescript
const MAX_CHAIN_DEPTH = 5

async function executeRunFlow(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const callbacks = (ctx as any)._taskCallbacks as {
    triggerAndWait: (taskId: string, payload: unknown) => Promise<unknown>;
    trigger: (taskId: string, payload: unknown) => Promise<void>;
  } | undefined

  if (!callbacks) throw new Error('run_flow requires taskCallbacks in executor config')

  const { flowId, waitForResult, inputVariables } = node.config as {
    flowId: string
    waitForResult: boolean
    inputVariables?: Record<string, string>
  }

  const currentDepth = Number(ctx.triggerData._chainDepth ?? 0)
  if (currentDepth >= MAX_CHAIN_DEPTH) {
    throw new Error(`Maximum chain depth (${MAX_CHAIN_DEPTH}) exceeded`)
  }

  const childTriggerData: Record<string, unknown> = {
    ...inputVariables,
    _chainDepth: currentDepth + 1,
  }

  if (waitForResult) {
    const result = await callbacks.triggerAndWait('flow-execution', {
      flowId,
      triggerData: childTriggerData,
    })
    const output = (result as any)?.ok ? (result as any).output : result
    return { action: 'run_flow', flowId, waitForResult: true, output }
  } else {
    await callbacks.trigger('flow-execution', {
      flowId,
      triggerData: childTriggerData,
    })
    return { action: 'run_flow', flowId, waitForResult: false, fired: true }
  }
}
```

- [ ] **Step 4: Add run_flow to NON_CACHEABLE_TYPES in executor.ts**

```typescript
'run_flow',
```

- [ ] **Step 5: Update flow-execution.ts to pass taskCallbacks**

In `apps/trigger/src/trigger/flow-execution.ts`, inside the `run` function, when calling `executeFlow`, pass `taskCallbacks` in the config:

```typescript
import { tasks } from '@trigger.dev/sdk/v3'

// Inside run(), when calling executeFlow:
const ctx = await executeFlow(nodes, edges, enrichedTriggerData, {
  prisma: getPrisma(),
  taskCallbacks: {
    triggerAndWait: async (taskId: string, payload: unknown) => {
      const handle = await tasks.triggerAndWait(taskId, payload)
      return handle
    },
    trigger: async (taskId: string, payload: unknown) => {
      await tasks.trigger(taskId, payload)
    },
  },
})
```

**Note:** Check the exact Trigger.dev v3 API for `tasks.triggerAndWait` and `tasks.trigger`. The import path may be `@trigger.dev/sdk/v3` or similar. Verify via `apps/trigger/src/trigger/flow-execution.ts` existing imports.

- [ ] **Step 6: Add chain depth enforcement to flow-execution.ts**

At the start of the `run` function, before fetching the flow:

```typescript
const chainDepth = Number(payload.triggerData?._chainDepth ?? 0)
if (chainDepth > 5) {
  throw new Error(`Flow execution rejected: chain depth ${chainDepth} exceeds maximum (5)`)
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=flow-chaining
```

Expected: All 4 tests PASS.

- [ ] **Step 8: Run full test suite**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/actions.ts apps/trigger/src/lib/flow-engine/executor.ts apps/trigger/src/trigger/flow-execution.ts apps/trigger/src/__tests__/flow-chaining.test.ts
git commit -m "feat(flow-engine): add run_flow action node with chain depth safeguard"
```

---

### Task 8: Add emit_event and custom_event Nodes

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/actions.ts`
- Modify: `apps/trigger/src/lib/flow-engine/executor.ts` (NON_CACHEABLE_TYPES)
- Test: `apps/trigger/src/__tests__/flow-events.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/trigger/src/__tests__/flow-events.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAction } from '../lib/flow-engine/actions.js'
import type { FlowContext, FlowNode } from '../lib/flow-engine/types.js'

const mockPrisma = {
  flowEvent: {
    create: vi.fn(),
  },
  flowDefinition: {
    findMany: vi.fn(),
  },
}

function createContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    flowId: 'source-flow',
    executionId: 'exec-1',
    variables: new Map(),
    triggerData: {},
    nodeResults: new Map(),
    ...overrides,
  }
}

function createNode(type: string, config: Record<string, unknown>): FlowNode {
  return { id: 'node-1', type, category: 'action', label: type, config }
}

describe('emit_event action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes FlowEvent record and triggers matching flows', async () => {
    mockPrisma.flowEvent.create.mockResolvedValue({ id: 'event-1' })
    mockPrisma.flowDefinition.findMany.mockResolvedValue([
      {
        id: 'listener-flow-1',
        nodesJson: [
          { id: 'n1', type: 'custom_event', category: 'trigger', config: { eventName: 'user.verified' } },
        ],
        status: 'active',
      },
    ])

    const mockTrigger = vi.fn().mockResolvedValue(undefined)
    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma
    ;(ctx as any)._taskCallbacks = { trigger: mockTrigger, triggerAndWait: vi.fn() }

    const node = createNode('emit_event', {
      eventName: 'user.verified',
      payload: { userId: 'u-123' },
    })

    const result = await executeAction(node, ctx)

    expect(mockPrisma.flowEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'user.verified',
        sourceFlowId: 'source-flow',
        sourceExecutionId: 'exec-1',
      }),
    })

    expect(mockTrigger).toHaveBeenCalledWith('flow-execution', {
      flowId: 'listener-flow-1',
      triggerData: expect.objectContaining({
        event: 'user.verified',
        userId: 'u-123',
      }),
    })

    expect(result).toEqual({
      action: 'emit_event',
      eventName: 'user.verified',
      listenersTriggered: 1,
    })
  })

  it('writes event even when no listeners exist', async () => {
    mockPrisma.flowEvent.create.mockResolvedValue({ id: 'event-2' })
    mockPrisma.flowDefinition.findMany.mockResolvedValue([])

    const ctx = createContext()
    ;(ctx as any)._prisma = mockPrisma
    ;(ctx as any)._taskCallbacks = { trigger: vi.fn(), triggerAndWait: vi.fn() }

    const node = createNode('emit_event', { eventName: 'no.listeners' })
    const result = await executeAction(node, ctx)

    expect(result).toEqual({
      action: 'emit_event',
      eventName: 'no.listeners',
      listenersTriggered: 0,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=flow-events
```

Expected: FAIL.

- [ ] **Step 3: Add emit_event executor to actions.ts**

Add case:

```typescript
case 'emit_event': return executeEmitEvent(node, ctx);
```

Add function:

```typescript
async function executeEmitEvent(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const prisma = (ctx as any)._prisma
  const callbacks = (ctx as any)._taskCallbacks
  if (!prisma) throw new Error('emit_event requires prisma in executor config')

  const { eventName, payload: rawPayload } = node.config as {
    eventName: string
    payload?: Record<string, string>
  }

  // Interpolate payload values
  const payload: Record<string, unknown> = {}
  if (rawPayload) {
    for (const [k, v] of Object.entries(rawPayload)) {
      payload[k] = interpolate(String(v), ctx)
    }
  }

  // Write audit record
  await prisma.flowEvent.create({
    data: {
      eventName,
      payload,
      sourceFlowId: ctx.flowId,
      sourceExecutionId: ctx.executionId,
    },
  })

  // Find active flows with custom_event triggers matching this event name
  const listenerFlows = await prisma.flowDefinition.findMany({
    where: {
      status: 'active',
      id: { not: ctx.flowId }, // Prevent self-triggering
    },
    select: { id: true, nodesJson: true },
  })

  let listenersTriggered = 0

  for (const flow of listenerFlows) {
    const nodes = flow.nodesJson as Array<{ type: string; config: { eventName?: string } }>
    const hasMatchingTrigger = nodes.some(
      (n) => n.type === 'custom_event' && n.config?.eventName === eventName,
    )

    if (hasMatchingTrigger && callbacks?.trigger) {
      const chainDepth = Number(ctx.triggerData._chainDepth ?? 0)
      await callbacks.trigger('flow-execution', {
        flowId: flow.id,
        triggerData: {
          event: eventName,
          ...payload,
          _chainDepth: chainDepth + 1,
          _sourceFlowId: ctx.flowId,
          _sourceExecutionId: ctx.executionId,
        },
      })
      listenersTriggered++
    }
  }

  return { action: 'emit_event', eventName, listenersTriggered }
}
```

- [ ] **Step 4: Add emit_event to NON_CACHEABLE_TYPES**

In `executor.ts`:

```typescript
'emit_event', 'run_flow',
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=flow-events
```

Expected: All tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/actions.ts apps/trigger/src/lib/flow-engine/executor.ts apps/trigger/src/__tests__/flow-events.test.ts
git commit -m "feat(flow-engine): add emit_event action and custom_event trigger support"
```

---

### Task 9: Add Chaining Nodes to Frontend

**Files:**
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`

- [ ] **Step 1: Add chaining nodes to NODE_TYPES_CONFIG**

```typescript
// Advanced/chaining nodes
{ type: 'run_flow', label: 'Run Flow', category: 'advanced', platform: 'general' },
{ type: 'emit_event', label: 'Emit Event', category: 'advanced', platform: 'general' },

// Trigger node
{ type: 'custom_event', label: 'Custom Event', category: 'trigger', platform: 'general' },
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd /root/Development/tg-allegro && pnpm frontend build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx
git commit -m "feat(frontend): add run_flow, emit_event, custom_event to flow editor"
```

---

### Task 10: Add Flow Event Cleanup Task

**Files:**
- Create: `apps/trigger/src/trigger/flow-event-cleanup.ts`
- Test: `apps/trigger/src/__tests__/flow-event-cleanup.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/trigger/src/__tests__/flow-event-cleanup.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

// Test the cleanup logic in isolation (not the Trigger.dev task wrapper)
describe('flow-event-cleanup logic', () => {
  it('deletes events where expiresAt < now', async () => {
    const mockPrisma = {
      flowEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 42 }),
      },
    }

    const { cleanupExpiredEvents } = await import('../trigger/flow-event-cleanup.js')
    const result = await cleanupExpiredEvents(mockPrisma as any)

    expect(mockPrisma.flowEvent.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    })
    expect(result).toEqual({ deletedCount: 42 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=flow-event-cleanup
```

Expected: FAIL.

- [ ] **Step 3: Create cleanup task**

Create `apps/trigger/src/trigger/flow-event-cleanup.ts`:

```typescript
import { schedules } from '@trigger.dev/sdk/v3'
import { getPrisma } from '../lib/prisma.js'

export async function cleanupExpiredEvents(prisma: any): Promise<{ deletedCount: number }> {
  const result = await prisma.flowEvent.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return { deletedCount: result.count }
}

export const flowEventCleanupTask = schedules.task({
  id: 'flow-event-cleanup',
  cron: '0 3 * * *', // Daily at 3 AM
  run: async () => {
    const prisma = getPrisma()
    const result = await cleanupExpiredEvents(prisma)
    return result
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm trigger test -- --testPathPattern=flow-event-cleanup
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/trigger/src/trigger/flow-event-cleanup.ts apps/trigger/src/__tests__/flow-event-cleanup.test.ts
git commit -m "feat(trigger): add daily flow-event-cleanup scheduled task"
```

---

## Chunk 3: Phase 1C — Hybrid Trigger Routing

### Task 11: Add Trigger Registry API Endpoints

**Files:**
- Modify: `apps/api/src/flows/flows.controller.ts`
- Modify: `apps/api/src/flows/flows.service.ts`
- Test: API tests for the new endpoints

- [ ] **Step 1: Add trigger registry methods to FlowsService**

In `apps/api/src/flows/flows.service.ts`, add:

```typescript
private triggerRegistryVersion = 0;
private triggerRegistryCache: any[] | null = null;

async getTriggerRegistry() {
  if (this.triggerRegistryCache) {
    return {
      triggers: this.triggerRegistryCache,
      version: this.triggerRegistryVersion,
    }
  }
  return this.rebuildTriggerRegistry()
}

getTriggerRegistryVersion() {
  return { version: this.triggerRegistryVersion }
}

async rebuildTriggerRegistry() {
  const activeFlows = await this.prisma.flowDefinition.findMany({
    where: { status: 'active' },
    select: { id: true, nodesJson: true, platform: true },
  })

  const triggers: Array<{
    flowId: string
    nodeType: string
    config: Record<string, unknown>
    platform: string
  }> = []

  for (const flow of activeFlows) {
    const nodes = flow.nodesJson as Array<{
      id: string
      type: string
      category: string
      config: Record<string, unknown>
    }>

    for (const node of nodes) {
      if (node.category === 'trigger') {
        triggers.push({
          flowId: flow.id,
          nodeType: node.type,
          config: node.config,
          platform: flow.platform,
        })
      }
    }
  }

  this.triggerRegistryCache = triggers
  this.triggerRegistryVersion++
  return { triggers, version: this.triggerRegistryVersion }
}

// Call rebuildTriggerRegistry in activate() and deactivate() methods
// After setting status to 'active' or 'inactive', add:
// await this.rebuildTriggerRegistry()
```

- [ ] **Step 2: Add controller endpoints**

In `apps/api/src/flows/flows.controller.ts`, add the route names to the reserved list:

```typescript
const reservedRouteNames = ['analytics', 'webhook', 'user-context', 'executions', 'trigger-registry']
```

Add endpoints (place BEFORE the `/:id` route to avoid parameter conflict):

```typescript
@Get('trigger-registry')
async getTriggerRegistry() {
  return this.flowsService.getTriggerRegistry()
}

@Get('trigger-registry/version')
async getTriggerRegistryVersion() {
  return this.flowsService.getTriggerRegistryVersion()
}
```

- [ ] **Step 3: Invalidate registry on activate/deactivate**

In `flows.service.ts`, add `await this.rebuildTriggerRegistry()` at the end of:
- `activate()` method — after setting status to `'active'`
- `deactivate()` method — after setting status to `'inactive'`

- [ ] **Step 4: Run API tests**

```bash
cd /root/Development/tg-allegro && pnpm api test
```

Expected: Existing tests pass (new endpoints tested manually or in integration).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/flows/flows.controller.ts apps/api/src/flows/flows.service.ts
git commit -m "feat(api): add trigger-registry endpoints for bot flow matching"
```

---

### Task 12: Add Flow Trigger Middleware to Manager Bot

**Files:**
- Create: `apps/manager-bot/src/bot/middlewares/flow-trigger.ts`
- Modify: `apps/manager-bot/src/server/index.ts` (trigger registry fetch)
- Test: `apps/manager-bot/src/__tests__/flow-trigger.test.ts`

- [ ] **Step 1: Write failing tests for trigger matching**

Create `apps/manager-bot/src/__tests__/flow-trigger.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matchTriggers, type TriggerEntry } from '../bot/middlewares/flow-trigger.js'

describe('matchTriggers', () => {
  const registry: TriggerEntry[] = [
    { flowId: 'flow-1', nodeType: 'command_received', config: { command: '/start' }, platform: 'telegram' },
    { flowId: 'flow-2', nodeType: 'keyword_match', config: { keywords: ['help', 'support'], mode: 'any' }, platform: 'telegram' },
    { flowId: 'flow-3', nodeType: 'message_received', config: {}, platform: 'telegram' },
    { flowId: 'flow-4', nodeType: 'user_joins', config: {}, platform: 'telegram' },
  ]

  it('matches command_received trigger', () => {
    const matches = matchTriggers(registry, 'command_received', { command: '/start', text: '/start' })
    expect(matches).toEqual([{ flowId: 'flow-1', nodeType: 'command_received', config: { command: '/start' }, platform: 'telegram' }])
  })

  it('matches keyword_match trigger in mode=any', () => {
    const matches = matchTriggers(registry, 'message_received', { text: 'I need help please' })
    // keyword_match triggers also fire on message_received events when keywords match
    expect(matches.some(m => m.flowId === 'flow-2')).toBe(true)
    // message_received catch-all also matches
    expect(matches.some(m => m.flowId === 'flow-3')).toBe(true)
  })

  it('matches user_joins trigger', () => {
    const matches = matchTriggers(registry, 'user_joins', {})
    expect(matches).toEqual([{ flowId: 'flow-4', nodeType: 'user_joins', config: {}, platform: 'telegram' }])
  })

  it('returns empty array when no matches', () => {
    const matches = matchTriggers(registry, 'poll_answer', {})
    expect(matches).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/Development/tg-allegro && pnpm manager-bot test -- --testPathPattern=flow-trigger
```

Expected: FAIL.

- [ ] **Step 3: Implement flow-trigger middleware**

Create `apps/manager-bot/src/bot/middlewares/flow-trigger.ts`:

```typescript
import type { MiddlewareFn } from 'grammy'
import type { Logger } from 'pino'

export interface TriggerEntry {
  flowId: string
  nodeType: string
  config: Record<string, unknown>
  platform: string
}

interface TriggerRegistryState {
  triggers: TriggerEntry[]
  version: number
  lastFetch: number
}

const POLL_INTERVAL_MS = 30_000

export function matchTriggers(
  registry: TriggerEntry[],
  eventType: string,
  eventData: Record<string, unknown>,
): TriggerEntry[] {
  const matches: TriggerEntry[] = []

  for (const entry of registry) {
    if (entry.platform !== 'telegram') continue

    // Direct event type match
    if (entry.nodeType === eventType) {
      if (matchesConfig(entry, eventData)) {
        matches.push(entry)
      }
      continue
    }

    // keyword_match triggers fire on message events
    if (entry.nodeType === 'keyword_match' && eventType === 'message_received') {
      if (matchesKeywords(entry.config, eventData)) {
        matches.push(entry)
      }
    }

    // callback_data_match triggers fire on callback_query events
    if (entry.nodeType === 'callback_data_match' && eventType === 'callback_query') {
      if (matchesCallbackData(entry.config, eventData)) {
        matches.push(entry)
      }
    }
  }

  return matches
}

function matchesConfig(entry: TriggerEntry, eventData: Record<string, unknown>): boolean {
  switch (entry.nodeType) {
    case 'command_received': {
      const cmd = entry.config.command as string | undefined
      return !cmd || eventData.command === cmd
    }
    case 'message_received':
    case 'user_joins':
    case 'user_leaves':
    case 'callback_query':
      return true // These match on event type alone
    default:
      return false // Unknown triggers — relay to API
  }
}

function matchesKeywords(
  config: Record<string, unknown>,
  eventData: Record<string, unknown>,
): boolean {
  const keywords = config.keywords as string[] | undefined
  if (!keywords?.length) return false
  const text = String(eventData.text ?? '').toLowerCase()
  const mode = (config.mode as string) ?? 'any'
  if (mode === 'all') return keywords.every((k) => text.includes(k.toLowerCase()))
  return keywords.some((k) => text.includes(k.toLowerCase()))
}

function matchesCallbackData(
  config: Record<string, unknown>,
  eventData: Record<string, unknown>,
): boolean {
  const pattern = config.pattern as string | undefined
  if (!pattern) return true
  const data = String(eventData.callbackData ?? '')
  const mode = (config.matchMode as string) ?? 'exact'
  switch (mode) {
    case 'exact': return data === pattern
    case 'starts_with': return data.startsWith(pattern)
    case 'contains': return data.includes(pattern)
    default: return false
  }
}

export function createTriggerRegistry(apiUrl: string, logger: Logger) {
  const state: TriggerRegistryState = { triggers: [], version: 0, lastFetch: 0 }

  async function fetchRegistry(): Promise<void> {
    try {
      const res = await fetch(`${apiUrl}/api/flows/trigger-registry`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { triggers: TriggerEntry[]; version: number }
      state.triggers = data.triggers
      state.version = data.version
      state.lastFetch = Date.now()
      logger.info({ version: state.version, count: state.triggers.length }, 'Trigger registry loaded')
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch trigger registry, using cached')
    }
  }

  async function checkVersion(): Promise<void> {
    try {
      const res = await fetch(`${apiUrl}/api/flows/trigger-registry/version`)
      if (!res.ok) return
      const data = await res.json() as { version: number }
      if (data.version !== state.version) {
        await fetchRegistry()
      }
    } catch {
      // Ignore — use cached registry
    }
  }

  // Start polling
  const interval = setInterval(checkVersion, POLL_INTERVAL_MS)

  return {
    fetchRegistry,
    getState: () => state,
    stop: () => clearInterval(interval),
  }
}

export function createFlowTriggerMiddleware(
  registry: { getState: () => TriggerRegistryState },
  triggerFlow: (flowId: string, triggerData: Record<string, unknown>) => Promise<void>,
  logger: Logger,
): MiddlewareFn {
  return async (ctx, next) => {
    const state = registry.getState()
    if (state.triggers.length === 0) {
      return next()
    }

    // Determine event type and data from grammY context
    let eventType = ''
    const eventData: Record<string, unknown> = {}

    if (ctx.message?.text?.startsWith('/')) {
      eventType = 'command_received'
      eventData.command = ctx.message.text.split(' ')[0]!.split('@')[0]
      eventData.text = ctx.message.text
    } else if (ctx.message) {
      eventType = 'message_received'
      eventData.text = ctx.message.text ?? ''
    } else if (ctx.callbackQuery) {
      eventType = 'callback_query'
      eventData.callbackData = ctx.callbackQuery.data
    } else if (ctx.chatMember) {
      const newStatus = ctx.chatMember.new_chat_member.status
      if (newStatus === 'member' || newStatus === 'administrator') {
        eventType = 'user_joins'
      } else if (newStatus === 'left' || newStatus === 'kicked') {
        eventType = 'user_leaves'
      }
    }

    if (!eventType) {
      return next()
    }

    const matches = matchTriggers(state.triggers, eventType, eventData)

    // Fire matching flows (non-blocking)
    for (const match of matches) {
      const triggerData: Record<string, unknown> = {
        ...eventData,
        chatId: String(ctx.chat?.id ?? ''),
        userId: String(ctx.from?.id ?? ''),
        userName: ctx.from?.first_name ?? '',
        platform: 'telegram',
        platformUserId: String(ctx.from?.id ?? ''),
      }

      triggerFlow(match.flowId, triggerData).catch((err) => {
        logger.error({ err, flowId: match.flowId }, 'Failed to trigger flow')
      })
    }

    return next()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/Development/tg-allegro && pnpm manager-bot test -- --testPathPattern=flow-trigger
```

Expected: All tests PASS.

- [ ] **Step 5: Add registry initialization to server**

In `apps/manager-bot/src/server/index.ts` or the bot bootstrap file, add trigger registry initialization:

```typescript
import { createTriggerRegistry, createFlowTriggerMiddleware } from '../bot/middlewares/flow-trigger.js'

// During bot setup:
const apiUrl = process.env.API_SERVER_HOST
  ? `http://${process.env.API_SERVER_HOST}:${process.env.API_SERVER_PORT ?? 3000}`
  : 'http://localhost:3000'

const triggerRegistry = createTriggerRegistry(apiUrl, logger)
await triggerRegistry.fetchRegistry() // Initial load

// Add middleware to bot (before other middlewares that handle messages):
bot.use(createFlowTriggerMiddleware(
  triggerRegistry,
  async (flowId, triggerData) => {
    // Call Trigger.dev to fire flow — via API endpoint
    await fetch(`${apiUrl}/api/flows/${flowId}/test-execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerData }),
    })
  },
  logger,
))
```

**Note:** The exact integration point depends on how the manager bot registers middlewares. Check `apps/manager-bot/src/bot/index.ts` or similar for the middleware chain order. This middleware should run early (before feature-specific handlers) but after session/auth middlewares.

- [ ] **Step 6: Run full test suite**

```bash
cd /root/Development/tg-allegro && pnpm manager-bot test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/manager-bot/src/bot/middlewares/flow-trigger.ts apps/manager-bot/src/__tests__/flow-trigger.test.ts apps/manager-bot/src/server/index.ts
git commit -m "feat(manager-bot): add flow trigger middleware with registry polling"
```

---

### Task 13: Add Circular Reference Detection

**Files:**
- Modify: `apps/api/src/flows/flows.service.ts`
- Test: API test for circular reference validation

- [ ] **Step 1: Add circular reference check to activate()**

In `flows.service.ts`, add a method:

```typescript
private async detectRunFlowCycles(flowId: string): Promise<string[] | null> {
  // Build a graph of run_flow references: flowId -> [referenced flowIds]
  const visited = new Set<string>()
  const path: string[] = []

  const getReferencedFlows = async (fid: string): Promise<string[]> => {
    const flow = await this.prisma.flowDefinition.findUnique({
      where: { id: fid },
      select: { nodesJson: true },
    })
    if (!flow) return []
    const nodes = flow.nodesJson as Array<{ type: string; config: { flowId?: string } }>
    return nodes
      .filter((n) => n.type === 'run_flow' && n.config?.flowId)
      .map((n) => n.config.flowId!)
  }

  const dfs = async (current: string): Promise<boolean> => {
    if (path.includes(current)) {
      path.push(current) // Show the cycle
      return true // Cycle found
    }
    if (visited.has(current)) return false

    path.push(current)
    const refs = await getReferencedFlows(current)
    for (const ref of refs) {
      if (await dfs(ref)) return true
    }
    path.pop()
    visited.add(current)
    return false
  }

  const hasCycle = await dfs(flowId)
  return hasCycle ? path : null
}
```

In the `activate()` method, before setting status to `'active'`, add:

```typescript
const cycle = await this.detectRunFlowCycles(id)
if (cycle) {
  throw new BadRequestException(
    `Circular flow reference detected: ${cycle.join(' → ')}`,
  )
}
```

- [ ] **Step 2: Run API tests**

```bash
cd /root/Development/tg-allegro && pnpm api test
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/flows/flows.service.ts
git commit -m "feat(api): add circular run_flow reference detection on flow activate"
```

---

### Task 14: Add Context Keys API Endpoint

**Files:**
- Modify: `apps/api/src/flows/flows.controller.ts`
- Modify: `apps/api/src/flows/flows.service.ts`

- [ ] **Step 1: Add service method**

```typescript
async getContextKeys(): Promise<Array<{ key: string; count: number }>> {
  const result = await this.prisma.userFlowContext.groupBy({
    by: ['key'],
    _count: { key: true },
    orderBy: { _count: { key: 'desc' } },
    take: 100,
  })
  return result.map((r) => ({ key: r.key, count: r._count.key }))
}
```

- [ ] **Step 2: Add controller endpoint**

Add to reserved route names: `'context-keys'`

```typescript
@Get('context-keys')
async getContextKeys() {
  return this.flowsService.getContextKeys()
}
```

- [ ] **Step 3: Run API tests**

```bash
cd /root/Development/tg-allegro && pnpm api test
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/flows/flows.controller.ts apps/api/src/flows/flows.service.ts
git commit -m "feat(api): add context-keys endpoint for variable autocomplete"
```

---

### Task 15: Typecheck and Final Verification

- [ ] **Step 1: Run trigger typecheck**

```bash
cd /root/Development/tg-allegro && pnpm trigger typecheck
```

Expected: No errors.

- [ ] **Step 2: Run all trigger tests**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

Expected: All pass.

- [ ] **Step 3: Run manager-bot tests**

```bash
cd /root/Development/tg-allegro && pnpm manager-bot test
```

Expected: All pass.

- [ ] **Step 4: Run API tests**

```bash
cd /root/Development/tg-allegro && pnpm api test
```

Expected: All pass.

- [ ] **Step 5: Build frontend**

```bash
cd /root/Development/tg-allegro && pnpm frontend build
```

Expected: Build succeeds.
