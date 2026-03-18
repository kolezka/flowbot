# Sub-Project 3: Editor UX — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the flow editor with typed property panels, an execution debugger with variable inspection, and organization features (folders, subflows, improved node palette).

**Architecture:** Property panels use a registry pattern mapping node types to React components. The debugger uses DB-based pause/resume with WebSocket progress updates. Flow folders are a new Prisma model with tree view UI. The node palette is extracted to its own component with search and recently-used tracking.

**Tech Stack:** Next.js 16, ReactFlow, Radix UI, Tailwind CSS 4, Prisma 7, NestJS 11, Vitest, WebSocket

**Spec:** `docs/superpowers/specs/2026-03-16-flow-builder-extension-design.md` — Section "Sub-Project 3"

**Depends on:** SP1 (context nodes, chaining nodes), SP2 (unified nodes, flow-shared package)

---

## Chunk 1: Phase 3A — Property Panel Overhaul

### Task 1: Extract Node Palette Component

**Files:**
- Create: `apps/frontend/src/components/flow-editor/NodePalette.tsx`
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`

- [ ] **Step 1: Create NodePalette component**

Extract the node type listing/filtering from the editor page into a standalone component:

```typescript
// apps/frontend/src/components/flow-editor/NodePalette.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { NODE_TYPES, type NodeTypeDefinition } from '@flowbot/flow-shared'

interface NodePaletteProps {
  platformFilter: 'all' | 'telegram' | 'discord' | 'general'
  onPlatformFilterChange: (platform: 'all' | 'telegram' | 'discord' | 'general') => void
  onDragStart: (event: React.DragEvent, nodeType: NodeTypeDefinition) => void
}

const RECENT_KEY = 'flow-editor-recent-nodes'
const MAX_RECENT = 8

export function NodePalette({ platformFilter, onPlatformFilterChange, onDragStart }: NodePaletteProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [recentTypes, setRecentTypes] = useState<string[]>([])
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Load recently used from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_KEY)
    if (stored) setRecentTypes(JSON.parse(stored))
  }, [])

  // Persist platform filter
  useEffect(() => {
    localStorage.setItem('flow-editor-platform', platformFilter)
  }, [platformFilter])

  const filteredNodes = useMemo(() => {
    let nodes = NODE_TYPES
    if (platformFilter !== 'all') {
      nodes = nodes.filter(n => n.platform === platformFilter || n.platform === 'general')
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      nodes = nodes.filter(n =>
        n.label.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.description?.toLowerCase().includes(q),
      )
    }
    return nodes
  }, [platformFilter, searchQuery])

  const recentNodes = useMemo(() => {
    return recentTypes
      .map(type => NODE_TYPES.find(n => n.type === type))
      .filter((n): n is NodeTypeDefinition => n !== undefined)
      .slice(0, MAX_RECENT)
  }, [recentTypes])

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, NodeTypeDefinition[]> = {}
    for (const node of filteredNodes) {
      const cat = node.category
      if (!groups[cat]) groups[cat] = []
      groups[cat]!.push(node)
    }
    return groups
  }, [filteredNodes])

  const handleDragStart = (event: React.DragEvent, node: NodeTypeDefinition) => {
    // Track recently used
    const updated = [node.type, ...recentTypes.filter(t => t !== node.type)].slice(0, MAX_RECENT)
    setRecentTypes(updated)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
    onDragStart(event, node)
  }

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    <div className="w-64 border-r p-3 overflow-y-auto">
      {/* Search */}
      <input
        type="text"
        placeholder="Search nodes..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded mb-2"
      />

      {/* Platform filter */}
      <div className="flex gap-1 mb-3">
        {(['all', 'telegram', 'discord', 'general'] as const).map(p => (
          <button
            key={p}
            onClick={() => onPlatformFilterChange(p)}
            className={`text-xs px-2 py-1 rounded ${platformFilter === p ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Recently used */}
      {recentNodes.length > 0 && !searchQuery && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-gray-500 mb-1">Recently Used</h4>
          {recentNodes.map(node => (
            <div
              key={node.type}
              draggable
              onDragStart={e => handleDragStart(e, node)}
              className="text-xs px-2 py-1 bg-gray-50 rounded mb-1 cursor-grab"
            >
              {node.label}
            </div>
          ))}
        </div>
      )}

      {/* Categorized nodes */}
      {Object.entries(groupedByCategory).map(([category, nodes]) => (
        <div key={category} className="mb-2">
          <button
            onClick={() => toggleCategory(category)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-600 py-1"
          >
            <span>{category} ({nodes.length})</span>
            <span>{collapsedCategories.has(category) ? '+' : '-'}</span>
          </button>
          {!collapsedCategories.has(category) && nodes.map(node => (
            <div
              key={node.type}
              draggable
              onDragStart={e => handleDragStart(e, node)}
              className="text-xs px-2 py-1 bg-gray-50 rounded mb-1 cursor-grab hover:bg-gray-100"
            >
              {node.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Replace inline palette in editor page**

In the editor page, replace the existing node palette JSX with:

```typescript
<NodePalette
  platformFilter={flowPlatform}
  onPlatformFilterChange={setFlowPlatform}
  onDragStart={handleDragStart}
/>
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd /root/Development/flowbot && pnpm frontend build
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/flow-editor/NodePalette.tsx apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx
git commit -m "refactor(frontend): extract NodePalette component with search and recently used"
```

---

### Task 2: Create Property Panel Registry

**Files:**
- Create: `apps/frontend/src/components/flow-editor/property-panels/registry.ts`
- Create: `apps/frontend/src/components/flow-editor/property-panels/GenericPanel.tsx`
- Create: `apps/frontend/src/components/flow-editor/property-panels/SendMessagePanel.tsx`
- Create: `apps/frontend/src/components/flow-editor/property-panels/ConditionPanel.tsx`
- Create: `apps/frontend/src/components/flow-editor/property-panels/RunFlowPanel.tsx`
- Create: `apps/frontend/src/components/flow-editor/property-panels/ContextPanel.tsx`

- [ ] **Step 1: Create panel registry**

```typescript
// registry.ts
import type { ComponentType } from 'react'

export interface PanelProps {
  nodeId: string
  nodeType: string
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  flowId: string
  upstreamNodes: Array<{ id: string; type: string; label: string }>
}

const panelMap = new Map<string, ComponentType<PanelProps>>()

export function registerPanel(nodeType: string, component: ComponentType<PanelProps>) {
  panelMap.set(nodeType, component)
}

export function getPanel(nodeType: string): ComponentType<PanelProps> | undefined {
  return panelMap.get(nodeType)
}

// Bulk register
export function registerPanels(entries: Array<[string, ComponentType<PanelProps>]>) {
  for (const [type, component] of entries) {
    panelMap.set(type, component)
  }
}
```

- [ ] **Step 2: Create GenericPanel (fallback)**

```typescript
// GenericPanel.tsx — key-value editor for unknown node types
'use client'

import type { PanelProps } from './registry'

export function GenericPanel({ config, onChange }: PanelProps) {
  return (
    <div className="space-y-2">
      {Object.entries(config).map(([key, value]) => (
        <div key={key}>
          <label className="text-xs font-medium text-gray-600">{key}</label>
          <input
            type="text"
            value={String(value ?? '')}
            onChange={e => onChange({ ...config, [key]: e.target.value })}
            className="w-full px-2 py-1 text-sm border rounded"
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create SendMessagePanel**

Textarea for message text, parse mode selector, disable notification toggle. Variable autocomplete on `{{`.

- [ ] **Step 4: Create ConditionPanel**

Operator dropdown, value input, type coercion based on operator.

- [ ] **Step 5: Create RunFlowPanel**

Flow picker dropdown (fetches flow list from API), `waitForResult` toggle, input variables key-value editor.

- [ ] **Step 6: Create ContextPanel**

Key input with autocomplete (fetches from `GET /api/flows/context-keys`), value input for set_context with variable autocomplete.

- [ ] **Step 7: Register panels and integrate into editor**

```typescript
// In editor page or a setup file:
import { registerPanels } from '@/components/flow-editor/property-panels/registry'
import { SendMessagePanel } from '@/components/flow-editor/property-panels/SendMessagePanel'
import { ConditionPanel } from '@/components/flow-editor/property-panels/ConditionPanel'
import { RunFlowPanel } from '@/components/flow-editor/property-panels/RunFlowPanel'
import { ContextPanel } from '@/components/flow-editor/property-panels/ContextPanel'

registerPanels([
  ['send_message', SendMessagePanel],
  ['unified_send_message', SendMessagePanel],
  ['get_context', ContextPanel],
  ['set_context', ContextPanel],
  ['delete_context', ContextPanel],
  ['run_flow', RunFlowPanel],
  // Conditions
  ['keyword_match', ConditionPanel],
  ['context_condition', ConditionPanel],
  // ... more as needed
])
```

When a node is selected in the editor, look up the panel via `getPanel(node.type)`. If found, render it. Otherwise, render `GenericPanel`.

- [ ] **Step 8: Verify frontend builds**

```bash
cd /root/Development/flowbot && pnpm frontend build
```

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/components/flow-editor/property-panels/
git commit -m "feat(frontend): add property panel registry with typed panels"
```

---

### Task 3: Create Variable Autocomplete Component

**Files:**
- Create: `apps/frontend/src/components/flow-editor/VariableAutocomplete.tsx`

- [ ] **Step 1: Create VariableAutocomplete**

A textarea wrapper that shows a dropdown when `{{` is typed:

```typescript
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Variable {
  name: string       // e.g. "trigger.chatId"
  source: string     // "trigger" | "node" | "context" | "loop"
  description?: string
}

interface VariableAutocompleteProps {
  value: string
  onChange: (value: string) => void
  variables: Variable[]
  multiline?: boolean
  placeholder?: string
  className?: string
}

export function VariableAutocomplete({
  value, onChange, variables, multiline, placeholder, className,
}: VariableAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [filter, setFilter] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  const handleChange = useCallback((newValue: string, selectionStart: number) => {
    onChange(newValue)
    setCursorPosition(selectionStart)

    // Check if cursor is inside {{ ... }}
    const before = newValue.slice(0, selectionStart)
    const openIndex = before.lastIndexOf('{{')
    const closeIndex = before.lastIndexOf('}}')

    if (openIndex > closeIndex) {
      const partial = before.slice(openIndex + 2)
      setFilter(partial)
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
    }
  }, [onChange])

  const filteredVariables = variables.filter(v =>
    v.name.toLowerCase().includes(filter.toLowerCase()),
  )

  const selectVariable = (variable: Variable) => {
    const before = value.slice(0, cursorPosition)
    const openIndex = before.lastIndexOf('{{')
    const after = value.slice(cursorPosition)
    const closeIndex = after.indexOf('}}')

    const prefix = value.slice(0, openIndex)
    const suffix = closeIndex >= 0 ? after.slice(closeIndex + 2) : after
    const newValue = `${prefix}{{${variable.name}}}${suffix}`

    onChange(newValue)
    setShowDropdown(false)
  }

  const Component = multiline ? 'textarea' : 'input'

  return (
    <div className="relative">
      <Component
        ref={inputRef as any}
        value={value}
        placeholder={placeholder}
        className={className ?? 'w-full px-2 py-1 text-sm border rounded'}
        onChange={e => handleChange(e.target.value, e.target.selectionStart ?? 0)}
        rows={multiline ? 4 : undefined}
      />
      {showDropdown && filteredVariables.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredVariables.map(v => (
            <button
              key={v.name}
              onClick={() => selectVariable(v)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50"
            >
              <span className="font-mono text-xs">{`{{${v.name}}}`}</span>
              {v.description && (
                <span className="ml-2 text-gray-400 text-xs">{v.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Use VariableAutocomplete in property panels**

Replace plain `<input>` and `<textarea>` in SendMessagePanel, ContextPanel, etc. with `<VariableAutocomplete>`.

The `variables` prop should be computed from:
- `trigger.*` fields (based on trigger node type)
- `node.<id>.*` outputs (from upstream connected nodes)
- `context.*` keys (fetched from API via `GET /api/flows/context-keys`)
- `loop.index`, `loop.item` (when inside a loop)

- [ ] **Step 3: Verify frontend builds**

```bash
cd /root/Development/flowbot && pnpm frontend build
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/flow-editor/VariableAutocomplete.tsx
git commit -m "feat(frontend): add VariableAutocomplete component for flow editor"
```

---

## Chunk 2: Phase 3B — Execution Debugger

### Task 4: Add Debug API Endpoints

**Files:**
- Modify: `apps/api/src/flows/flows.controller.ts`
- Modify: `apps/api/src/flows/flows.service.ts`
- Add `FlowDebugState` to Prisma schema (or use in-memory Map on API)

- [ ] **Step 1: Decide on debug state storage**

For simplicity, use an in-memory `Map<string, DebugState>` on the FlowsService. Debug sessions are ephemeral — no need for DB persistence.

```typescript
interface DebugState {
  executionId: string
  status: 'paused' | 'running' | 'step' | 'cancelled'
  pausedAtNodeId?: string
  breakpoints: Set<string> // nodeIds
}

private debugStates = new Map<string, DebugState>()
```

- [ ] **Step 2: Add debug-execute endpoint**

```typescript
@Post(':id/debug-execute')
async debugExecute(
  @Param('id') id: string,
  @Body() body: { triggerData: Record<string, unknown>; breakpoints?: string[] },
) {
  return this.flowsService.debugExecute(id, body.triggerData, body.breakpoints ?? [])
}
```

Service method creates a FlowExecution, sets up debug state, triggers flow-execution task with `debugMode: true`.

- [ ] **Step 3: Add debug control endpoints**

```typescript
@Patch('debug/:executionId')
async debugControl(
  @Param('executionId') executionId: string,
  @Body() body: { status: 'running' | 'step' | 'cancelled' },
) {
  return this.flowsService.updateDebugState(executionId, body.status)
}

@Get('debug/:executionId')
async getDebugState(@Param('executionId') executionId: string) {
  return this.flowsService.getDebugState(executionId)
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/flows/
git commit -m "feat(api): add debug-execute and debug control endpoints"
```

---

### Task 5: Add onNodeComplete Callback to Executor

**Files:**
- Modify: `apps/trigger/src/lib/flow-engine/executor.ts`
- Modify: `apps/trigger/src/trigger/flow-execution.ts`

- [ ] **Step 1: Add onNodeComplete callback to ExecutorConfig**

```typescript
export interface ExecutorConfig {
  // ... existing fields
  onNodeComplete?: (nodeId: string, result: NodeResult, ctx: FlowContext) => Promise<void>
  debugMode?: boolean
  checkDebugState?: () => Promise<'paused' | 'running' | 'step' | 'cancelled'>
}
```

- [ ] **Step 2: Call onNodeComplete after each node execution**

In the executor's BFS loop, after storing the node result:

```typescript
if (mergedConfig.onNodeComplete) {
  await mergedConfig.onNodeComplete(nodeId, result, ctx)
}

// Debug mode: check if we should pause
if (mergedConfig.debugMode && mergedConfig.checkDebugState) {
  let debugStatus = await mergedConfig.checkDebugState()

  // If step mode, pause after this node
  if (debugStatus === 'step') {
    debugStatus = 'paused'
  }

  // Poll until resumed
  while (debugStatus === 'paused') {
    await new Promise(resolve => setTimeout(resolve, 500))
    debugStatus = await mergedConfig.checkDebugState()
    if (debugStatus === 'cancelled') {
      throw new Error('Debug execution cancelled')
    }
  }
}
```

- [ ] **Step 3: Wire debug mode in flow-execution.ts**

When `payload.debugMode` is true, pass the debug callbacks:

```typescript
const ctx = await executeFlow(nodes, edges, enrichedTriggerData, {
  prisma: getPrisma(),
  debugMode: payload.debugMode,
  checkDebugState: async () => {
    // Fetch debug state from API
    const res = await fetch(`${apiUrl}/api/flows/debug/${execution.id}`)
    const data = await res.json()
    return data.status
  },
  onNodeComplete: async (nodeId, result) => {
    // Emit WebSocket event
    await fetch(`${apiUrl}/api/flows/debug/${execution.id}/node-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, result }),
    })
  },
})
```

- [ ] **Step 4: Run tests**

```bash
cd /root/Development/flowbot && pnpm trigger test
```

- [ ] **Step 5: Commit**

```bash
git add apps/trigger/src/lib/flow-engine/executor.ts apps/trigger/src/trigger/flow-execution.ts
git commit -m "feat(flow-engine): add onNodeComplete callback and debug mode support"
```

---

### Task 6: Create Execution Debugger Frontend Component

**Files:**
- Create: `apps/frontend/src/components/flow-editor/ExecutionDebugger.tsx`
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`

- [ ] **Step 1: Create ExecutionDebugger component**

```typescript
// ExecutionDebugger.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'

interface NodeProgress {
  nodeId: string
  status: 'success' | 'error' | 'skipped'
  output?: unknown
  duration?: number
}

interface ExecutionDebuggerProps {
  flowId: string
  executionId: string | null
  onClose: () => void
}

export function ExecutionDebugger({ flowId, executionId, onClose }: ExecutionDebuggerProps) {
  const [debugStatus, setDebugStatus] = useState<'running' | 'paused' | 'completed'>('running')
  const [nodeProgress, setNodeProgress] = useState<NodeProgress[]>([])
  const [variables, setVariables] = useState<Record<string, unknown>>({})
  const [activeTab, setActiveTab] = useState<'variables' | 'context' | 'results'>('variables')

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!executionId) return
    // Connect to WebSocket for flow-debug channel
    // Listen for node-complete events
    // Update nodeProgress and variables on each event
  }, [executionId])

  const sendDebugCommand = useCallback(async (status: string) => {
    if (!executionId) return
    await fetch(`/api/flows/debug/${executionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }, [executionId])

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50" style={{ height: '300px' }}>
      {/* Header with controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-semibold">Debugger</h3>
        <div className="flex gap-2">
          <button onClick={() => sendDebugCommand('running')} className="text-xs px-2 py-1 bg-green-500 text-white rounded">Continue</button>
          <button onClick={() => sendDebugCommand('step')} className="text-xs px-2 py-1 bg-blue-500 text-white rounded">Step</button>
          <button onClick={() => sendDebugCommand('cancelled')} className="text-xs px-2 py-1 bg-red-500 text-white rounded">Cancel</button>
          <button onClick={onClose} className="text-xs px-2 py-1 bg-gray-200 rounded">Close</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(['variables', 'context', 'results'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1 text-xs ${activeTab === tab ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-3 overflow-y-auto" style={{ height: '220px' }}>
        {activeTab === 'variables' && (
          <pre className="text-xs font-mono">{JSON.stringify(variables, null, 2)}</pre>
        )}
        {activeTab === 'results' && (
          <div className="space-y-1">
            {nodeProgress.map(np => (
              <div key={np.nodeId} className={`text-xs p-1 rounded ${np.status === 'success' ? 'bg-green-50' : np.status === 'error' ? 'bg-red-50' : 'bg-gray-50'}`}>
                <span className="font-mono">{np.nodeId}</span>: {np.status}
                {np.duration && <span className="text-gray-400 ml-2">{np.duration}ms</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution Timeline */}
      <div className="flex items-center gap-0.5 px-3 py-1 border-t overflow-x-auto">
        {nodeProgress.map(np => (
          <div
            key={np.nodeId}
            className={`h-3 min-w-[20px] rounded-sm cursor-pointer ${
              np.status === 'success' ? 'bg-green-400' : np.status === 'error' ? 'bg-red-400' : 'bg-gray-300'
            }`}
            title={`${np.nodeId}: ${np.status}`}
            style={{ flex: `${np.duration ?? 100} 0 auto` }}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrate into editor page**

Add a "Debug" button next to existing "Test Execute" that opens the debugger panel.

- [ ] **Step 3: Verify frontend builds**

```bash
cd /root/Development/flowbot && pnpm frontend build
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/flow-editor/ExecutionDebugger.tsx apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx
git commit -m "feat(frontend): add execution debugger with variable inspector and timeline"
```

---

## Chunk 3: Phase 3C — Organization at Scale

### Task 7: Add FlowFolder Model and API

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `apps/api/src/flows/flows.controller.ts`
- Modify: `apps/api/src/flows/flows.service.ts`

- [ ] **Step 1: Add FlowFolder model to schema**

```prisma
model FlowFolder {
  id        String          @id @default(cuid())
  name      String
  parentId  String?
  parent    FlowFolder?     @relation("FolderTree", fields: [parentId], references: [id])
  children  FlowFolder[]    @relation("FolderTree")
  order     Int             @default(0)
  flows     FlowDefinition[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}
```

Add to FlowDefinition:

```prisma
folderId  String?
folder    FlowFolder? @relation(fields: [folderId], references: [id])
```

- [ ] **Step 2: Run migration**

```bash
cd /root/Development/flowbot && pnpm db prisma:push && pnpm db generate && pnpm db build
```

- [ ] **Step 3: Add folder service methods**

```typescript
// In flows.service.ts
private readonly MAX_FOLDER_DEPTH = 3

async createFolder(name: string, parentId?: string) {
  if (parentId) {
    const depth = await this.getFolderDepth(parentId)
    if (depth >= this.MAX_FOLDER_DEPTH) {
      throw new BadRequestException(`Maximum folder depth (${this.MAX_FOLDER_DEPTH}) exceeded`)
    }
  }
  return this.prisma.flowFolder.create({ data: { name, parentId } })
}

async getFolders() {
  return this.prisma.flowFolder.findMany({
    where: { parentId: null },
    include: {
      children: { include: { children: true } },
      flows: { select: { id: true, name: true, status: true } },
    },
    orderBy: { order: 'asc' },
  })
}

async updateFolder(id: string, data: { name?: string; parentId?: string; order?: number }) {
  if (data.parentId) {
    const depth = await this.getFolderDepth(data.parentId)
    if (depth >= this.MAX_FOLDER_DEPTH) {
      throw new BadRequestException(`Maximum folder depth (${this.MAX_FOLDER_DEPTH}) exceeded`)
    }
  }
  return this.prisma.flowFolder.update({ where: { id }, data })
}

async deleteFolder(id: string) {
  // Move flows to root (no folder) before deleting
  await this.prisma.flowDefinition.updateMany({
    where: { folderId: id },
    data: { folderId: null },
  })
  return this.prisma.flowFolder.delete({ where: { id } })
}

private async getFolderDepth(folderId: string): Promise<number> {
  let depth = 0
  let currentId: string | null = folderId
  while (currentId) {
    depth++
    const folder = await this.prisma.flowFolder.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    })
    currentId = folder?.parentId ?? null
  }
  return depth
}
```

- [ ] **Step 4: Add controller endpoints**

```typescript
@Post('folders')
async createFolder(@Body() body: { name: string; parentId?: string }) { ... }

@Get('folders')
async getFolders() { ... }

@Patch('folders/:folderId')
async updateFolder(@Param('folderId') id: string, @Body() body: { name?: string; parentId?: string; order?: number }) { ... }

@Delete('folders/:folderId')
async deleteFolder(@Param('folderId') id: string) { ... }
```

Add `'folders'` to reserved route names.

- [ ] **Step 5: Run API tests**

```bash
cd /root/Development/flowbot && pnpm api test
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma apps/api/src/flows/
git commit -m "feat(api): add flow folders with depth limit and CRUD endpoints"
```

---

### Task 8: Add Folder Tree View to Frontend

**Files:**
- Modify: `apps/frontend/src/app/dashboard/flows/page.tsx`

- [ ] **Step 1: Add folder tree view**

Fetch folders from `GET /api/flows/folders`. Render as a collapsible tree view alongside the flow list. Flows without a folder appear under "Uncategorized."

- [ ] **Step 2: Add drag-drop for flows into folders**

Use HTML5 drag-drop or a library to allow dragging flows into folders. On drop, `PATCH /api/flows/:id` with `{ folderId }`.

- [ ] **Step 3: Add folder create/rename/delete UI**

Right-click context menu or inline buttons on folder names.

- [ ] **Step 4: Verify frontend builds**

```bash
cd /root/Development/flowbot && pnpm frontend build
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/dashboard/flows/page.tsx
git commit -m "feat(frontend): add flow folder tree view with drag-drop"
```

---

### Task 9: Add Subflow Visual Mode and Sticky Notes

**Files:**
- Create: `apps/frontend/src/components/flow-editor/SubflowNode.tsx`
- Create: `apps/frontend/src/components/flow-editor/StickyNote.tsx`
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`

- [ ] **Step 1: Create SubflowNode component**

A custom ReactFlow node renderer for `run_flow` nodes with `waitForResult: true`. Shows flow name, colored border, expand icon.

```typescript
// SubflowNode.tsx
'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

export const SubflowNode = memo(({ data }: NodeProps) => {
  const isSubflow = data.config?.waitForResult === true

  if (!isSubflow) {
    // Render as normal run_flow node
    return (
      <div className="px-3 py-2 rounded border bg-white shadow-sm">
        <Handle type="target" position={Position.Top} />
        <div className="text-xs font-medium">{data.label}</div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    )
  }

  return (
    <div className="px-4 py-3 rounded-lg border-2 border-purple-400 bg-purple-50 shadow-sm min-w-[150px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className="text-purple-600 text-xs">Sub</span>
        <span className="text-sm font-medium">{data.config?.flowName ?? 'Subflow'}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">Flow: {data.config?.flowId?.slice(0, 8)}...</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})
SubflowNode.displayName = 'SubflowNode'
```

- [ ] **Step 2: Create StickyNote component**

```typescript
// StickyNote.tsx
'use client'

import { memo } from 'react'
import { type NodeProps } from 'reactflow'

export const StickyNote = memo(({ data }: NodeProps) => {
  const color = data.config?.color ?? '#fef08a' // yellow default

  return (
    <div
      className="p-3 rounded shadow-sm min-w-[120px] min-h-[80px]"
      style={{ backgroundColor: color }}
    >
      <div className="text-xs whitespace-pre-wrap">{data.config?.text ?? 'Note'}</div>
    </div>
  )
})
StickyNote.displayName = 'StickyNote'
```

- [ ] **Step 3: Register custom node types with ReactFlow**

In the editor page, register the custom node types:

```typescript
const nodeTypes = useMemo(() => ({
  run_flow: SubflowNode,
  sticky_note: StickyNote,
  // ... existing custom node types
}), [])

// Pass to ReactFlow
<ReactFlow nodeTypes={nodeTypes} ... />
```

- [ ] **Step 4: Add sticky_note to node palette**

```typescript
{ type: 'sticky_note', label: 'Sticky Note', category: 'annotation', platform: 'general' },
```

- [ ] **Step 5: Verify frontend builds**

```bash
cd /root/Development/flowbot && pnpm frontend build
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/flow-editor/SubflowNode.tsx apps/frontend/src/components/flow-editor/StickyNote.tsx apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx
git commit -m "feat(frontend): add subflow visual mode and sticky notes to flow editor"
```

---

### Task 10: Final Typecheck and Verification

- [ ] **Step 1: Run all typechecks**

```bash
cd /root/Development/flowbot
pnpm trigger typecheck
pnpm frontend build
```

- [ ] **Step 2: Run all tests**

```bash
pnpm trigger test
pnpm api test
pnpm manager-bot test
pnpm telegram-transport test
```

Expected: All pass.

- [ ] **Step 3: Verify DB schema is in sync**

```bash
pnpm db prisma:push
pnpm db generate
pnpm db build
```

- [ ] **Step 4: Commit any fixes**
