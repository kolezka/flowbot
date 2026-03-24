# Flow Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click context menus to the flow builder for nodes, edges, and canvas with a Zustand-based store that owns all flow state.

**Architecture:** `createFlowStore()` factory returns a Zustand store hook. `FlowContextMenu` is a separate component that accepts the store via prop. The store replaces `useNodesState`/`useEdgesState` in the edit page. FlowCanvas gains context menu callback props. The store is scoped per component instance via `useRef` to avoid Next.js SSR singleton issues.

**Tech Stack:** Zustand, @radix-ui/react-context-menu, @xyflow/react 12.6, React 19, TypeScript, Tailwind 4

**Spec:** `docs/superpowers/specs/2026-03-24-flow-context-menu-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/frontend/src/components/ui/context-menu.tsx` | Create | shadcn wrapper around @radix-ui/react-context-menu |
| `apps/frontend/src/lib/flow-editor/flow-store.ts` | Create | `createFlowStore()` factory — Zustand store with flow state + context menu state + all actions |
| `apps/frontend/src/components/flow-editor/FlowContextMenu.tsx` | Create | Context menu UI component with node/edge/canvas variants and nested Add Node submenu |
| `apps/frontend/src/components/flow-editor/FlowCanvas.tsx` | Modify | Add context menu callback props, pass through to ReactFlow |
| `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` | Modify | Replace local state with Zustand store, wire context menu callbacks, add keyboard shortcuts |

### Design Decisions (from review)

1. **No factory tuple** — `createFlowStore()` returns just the store hook. `FlowContextMenu` is a separate export that accepts `useStore` as a prop. No circular dependency.
2. **Component-scoped store** — Created via `useRef` inside `FlowEditorInner` (not module-level) to avoid Next.js SSR singleton issues. Reset on mount to clear stale state.
3. **ContextMenu.Trigger wrapping** — `FlowContextMenu` renders `<ContextMenuTrigger asChild><div style={{ display: 'contents' }}>{children}</div></ContextMenuTrigger>` so Radix attaches to a real DOM element without breaking flex layout.
4. **Coordinate conversion** — Context menu stores viewport coordinates. `FlowContextMenu` accepts `screenToFlowPosition` prop to convert viewport → flow coordinates before calling `addNode`/`pasteNode`.
5. **@xyflow/react types** — `FlowCanvasProps` uses `NodeMouseHandler` and `EdgeMouseHandler` from `@xyflow/react` for type correctness.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `apps/frontend/package.json`

- [ ] **Step 1: Install zustand and @radix-ui/react-context-menu**

```bash
cd /Users/me/Development/flowbot && pnpm --filter @flowbot/frontend add zustand @radix-ui/react-context-menu
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/me/Development/flowbot && pnpm --filter @flowbot/frontend exec -- node -e "require.resolve('zustand'); require.resolve('@radix-ui/react-context-menu'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): add zustand and @radix-ui/react-context-menu"
```

---

### Task 2: Create context-menu.tsx UI Component

**Files:**
- Create: `apps/frontend/src/components/ui/context-menu.tsx`
- Reference: `apps/frontend/src/components/ui/dropdown-menu.tsx` (mirror this exact pattern)

- [ ] **Step 1: Create context-menu.tsx**

Mirror the pattern from `dropdown-menu.tsx` but use `@radix-ui/react-context-menu` primitives. Export: `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuSeparator`, `ContextMenuShortcut`, `ContextMenuSub`, `ContextMenuSubTrigger`, `ContextMenuSubContent`, `ContextMenuLabel`, `ContextMenuPortal`.

Use the exact same CSS classes from `dropdown-menu.tsx` — the only difference is the primitive import. The `ContextMenuContent` does NOT wrap itself in a `Portal` (unlike `DropdownMenuContent`) because `ContextMenu` handles positioning differently — the portal is in the parent component.

Full code: follow the `dropdown-menu.tsx` pattern exactly, replacing `DropdownMenuPrimitive` with `ContextMenuPrimitive` and `Dropdown` prefixes with `Context` prefixes. Include `ContextMenuShortcut` (a plain `<span>` with `ml-auto text-xs tracking-widest opacity-60`).

- [ ] **Step 2: Verify build**

```bash
cd /Users/me/Development/flowbot && pnpm frontend build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/ui/context-menu.tsx
git commit -m "feat(frontend): add shadcn context-menu UI component"
```

---

### Task 3: Create Zustand Flow Store

**Files:**
- Create: `apps/frontend/src/lib/flow-editor/flow-store.ts`
- Reference: `packages/flow-shared/src/node-registry.ts` for `NODE_TYPES`, `NodeTypeDefinition`
- Reference: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` for current state shape

- [ ] **Step 1: Create flow-store.ts with types**

```typescript
import { create, type StoreApi, type UseBoundStore } from "zustand"
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  addEdge as xyAddEdge,
} from "@xyflow/react"
import { NODE_TYPES } from "@flowbot/flow-shared"

// ── Types ──────────────────────────────────────────────────────

export interface Position {
  x: number
  y: number
}

export type MenuContext =
  | { type: "node"; node: Node }
  | { type: "edge"; edge: Edge }
  | { type: "canvas" }

export interface MenuState {
  isOpen: boolean
  position: Position
  context: MenuContext
}

export interface FlowStore {
  // Flow state
  nodes: Node[]
  edges: Edge[]
  selectedNode: Node | null
  copiedNode: Node | null

  // Menu state
  menu: MenuState | null

  // Flow state setters
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  applyNodeChanges: (changes: NodeChange[]) => void
  applyEdgeChanges: (changes: EdgeChange[]) => void
  addEdge: (connection: Connection) => void
  addNode: (type: string, position: Position) => void
  setSelectedNode: (node: Node | null) => void
  updateNodeData: (nodeId: string, key: string, value: unknown) => void

  // Menu openers
  openNodeMenu: (node: Node, position: Position) => void
  openEdgeMenu: (edge: Edge, position: Position) => void
  openCanvasMenu: (position: Position) => void
  closeMenu: () => void

  // Context menu actions
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  copyNode: (id: string) => void
  pasteNode: (position: Position) => void
  toggleNode: (id: string) => void
  addStickyNote: (position: Position) => void
  deleteEdge: (id: string) => void
  insertNodeOnEdge: (edgeId: string, nodeType: string) => void
  selectAll: () => void
}
```

- [ ] **Step 2: Implement `createFlowStore()` factory**

The factory returns `UseBoundStore<StoreApi<FlowStore>>` — just the store hook, not a tuple.

```typescript
export function createFlowStore(): UseBoundStore<StoreApi<FlowStore>> {
  return create<FlowStore>((set, get) => ({
    // ... all state and actions
  }))
}
```

Key implementation details for each action:

**`addNode(type, position)`** — Look up `NODE_TYPES.find(n => n.type === type)` for label/category/color. Create node with same structure as existing `handleDrop` in edit page (lines 261-285): id `${type}-${Date.now()}`, `type: "default"`, data with `label`, `nodeType`, `category`, `requiresConnection`, `config: {}`, style with `border: 2px solid ${color}`, `borderRadius: 8`, `padding: 8`, `minWidth: 150`.

**`duplicateNode(id)`** — `structuredClone` the original, new ID `${nodeType}-${Date.now()}`, offset position `+30,+30`, set `selected: true`, deselect all others, set as `selectedNode`.

**`copyNode(id)`** — `structuredClone` into `copiedNode`, close menu.

**`pasteNode(position)`** — Create from `copiedNode` snapshot with new id and given position. Update `copiedNode` to the pasted clone (allows repeated paste).

**`toggleNode(id)`** — Flip `data.disabled` boolean immutably. Update `selectedNode` if it matches.

**`deleteNode(id)`** — Filter out node AND edges where `source === id || target === id`. Clear `selectedNode` if it matches.

**`deleteEdge(id)`** — Filter out edge by id.

**`insertNodeOnEdge(edgeId, nodeType)`** — Find edge → look up source/target **nodes** by ID (edge only carries ID strings, not coordinates) → calculate midpoint from `node.position` → create new node → remove old edge → add two new edges `source→new` and `new→target`. Fallback to `{x:250,y:250}` if nodes not found.

**`addStickyNote(position)`** — Create node with `type: "sticky_note"`, `data: { config: { text: "Note", color: "yellow" } }`.

**`selectAll()`** — Map all nodes to `selected: true`.

**`updateNodeData(nodeId, key, value)`** — Same logic as existing `handleNodeDataChange` in edit page: update `data.config[key]`, keep `selectedNode` in sync.

- [ ] **Step 3: Verify build**

```bash
cd /Users/me/Development/flowbot && pnpm frontend build
```

Expected: Build succeeds. Store is not used yet.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/flow-editor/flow-store.ts
git commit -m "feat(frontend): add Zustand flow store with context menu actions"
```

---

### Task 4: Update FlowCanvas with Context Menu Props

**Files:**
- Modify: `apps/frontend/src/components/flow-editor/FlowCanvas.tsx`

- [ ] **Step 1: Add context menu callback props to FlowCanvasProps**

Import the proper handler types from `@xyflow/react`:

```typescript
import {
  // ... existing imports ...
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react"
```

Add to `FlowCanvasProps`:

```typescript
onNodeContextMenu?: NodeMouseHandler
onEdgeContextMenu?: EdgeMouseHandler
onPaneContextMenu?: (event: React.MouseEvent | MouseEvent) => void
```

- [ ] **Step 2: Destructure new props and pass to ReactFlow**

In the `FlowCanvas` function signature, destructure the three new props. Pass them directly to `<ReactFlow>`:

```typescript
onNodeContextMenu={onNodeContextMenu}
onEdgeContextMenu={onEdgeContextMenu}
onPaneContextMenu={onPaneContextMenu}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/me/Development/flowbot && pnpm frontend build
```

Expected: Build succeeds. The new props are optional so existing callers don't break.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/flow-editor/FlowCanvas.tsx
git commit -m "feat(frontend): add context menu callback props to FlowCanvas"
```

---

### Task 5: Create FlowContextMenu Component

**Files:**
- Create: `apps/frontend/src/components/flow-editor/FlowContextMenu.tsx`

**Important:** This task depends on Task 3 (flow-store.ts must exist for the `FlowStore` type import).

- [ ] **Step 1: Create FlowContextMenu.tsx**

```typescript
"use client"

import { type ReactNode } from "react"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu"
import { NODE_TYPES } from "@flowbot/flow-shared"
import type { FlowStore, Position } from "@/lib/flow-editor/flow-store"
import type { UseBoundStore, StoreApi } from "zustand"

const CATEGORIES = [
  { key: "trigger", label: "🟢 Triggers" },
  { key: "condition", label: "🟡 Conditions" },
  { key: "action", label: "🔵 Actions" },
  { key: "advanced", label: "🟣 Advanced" },
] as const

interface FlowContextMenuProps {
  useStore: UseBoundStore<StoreApi<FlowStore>>
  children: ReactNode
  onFitView?: () => void
  onEditNode?: (nodeId: string) => void
  screenToFlowPosition?: (pos: Position) => Position
}
```

**Component structure:**

The component renders:
```tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <div style={{ display: "contents" }}>{children}</div>
  </ContextMenuTrigger>
  <ContextMenuContent className="w-56">
    {/* Items based on menu.context.type */}
  </ContextMenuContent>
</ContextMenu>
```

The `<div style={{ display: "contents" }}>` wrapper ensures Radix has a real DOM element to attach to without breaking flex layout.

Read `menu` and `copiedNode` from the store via `useStore(s => s.menu)` and `useStore(s => s.copiedNode)`.

**Node menu items** (when `menu.context.type === 'node'`):
- `✏️ Edit Node` / shortcut `Enter` → calls `onEditNode?.(node.id)`, then `closeMenu()`
- `📋 Duplicate` / shortcut `⌘D` → `duplicateNode(node.id)`
- `📄 Copy` / shortcut `⌘C` → `copyNode(node.id)`
- separator
- `🚫 Disable` or `✅ Enable` (toggle label based on `node.data.disabled`) / shortcut `⌘/` → `toggleNode(node.id)`
- `📝 Add Note` → `addStickyNote({ x: node.position.x + 50, y: node.position.y + 50 })`
- separator
- `🗑️ Delete` (className `text-destructive`) / shortcut `⌫` → `deleteNode(node.id)`

**Canvas menu items** (when `menu.context.type === 'canvas'`):
- `📦 Add Node ▸` → `NodeCategorySubmenu` (shared helper, see below)
- `📝 Add Sticky Note` → convert position with `screenToFlowPosition` then `addStickyNote(flowPos)`
- separator
- `📋 Paste` / shortcut `⌘V` / `disabled={!copiedNode}` → convert position with `screenToFlowPosition` then `pasteNode(flowPos)`
- separator
- `🔲 Select All` / shortcut `⌘A` → `selectAll()`
- `🔍 Fit View` → `onFitView?.()`

**Edge menu items** (when `menu.context.type === 'edge'`):
- `📦 Insert Node ▸` → `NodeCategorySubmenu` (same helper, but action is `insertNodeOnEdge`)
- separator
- `🗑️ Delete Edge` (className `text-destructive`) / shortcut `⌫` → `deleteEdge(edge.id)`

**Coordinate conversion:** For canvas menu actions that place nodes (`Add Node`, `Add Sticky Note`, `Paste`), convert the stored viewport position to flow coordinates:

```typescript
const flowPos = screenToFlowPosition
  ? screenToFlowPosition(menu.position)
  : menu.position
```

For `Add Node` via submenu on canvas, pass `flowPos` to `addNode(type, flowPos)`. For `Insert Node` on edge, coordinates come from the edge midpoint calculation inside the store — no conversion needed.

**NodeCategorySubmenu helper:**

```typescript
function NodeCategorySubmenu({
  onSelect,
}: {
  onSelect: (nodeType: string) => void
}) {
  return (
    <>
      {CATEGORIES.map(({ key, label }) => {
        const nodes = NODE_TYPES.filter((n) => n.category === key)
        if (nodes.length === 0) return null
        return (
          <ContextMenuSub key={key}>
            <ContextMenuSubTrigger>{label}</ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-64 overflow-y-auto">
              {nodes.map((n) => (
                <ContextMenuItem
                  key={n.type}
                  onSelect={() => onSelect(n.type)}
                >
                  {n.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )
      })}
      {/* Hardcoded Annotation category for sticky notes */}
      <ContextMenuSub>
        <ContextMenuSubTrigger>📎 Annotation</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onSelect={() => onSelect("sticky_note")}>
            Sticky Note
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
    </>
  )
}
```

For canvas "Add Node", the `onSelect` callback converts position and calls `addNode`. For edge "Insert Node", it calls `insertNodeOnEdge(edge.id, nodeType)`.

- [ ] **Step 2: Verify build**

```bash
cd /Users/me/Development/flowbot && pnpm frontend build
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/flow-editor/FlowContextMenu.tsx
git commit -m "feat(frontend): add FlowContextMenu component with node/edge/canvas variants"
```

---

### Task 6: Migrate FlowEditorInner to Zustand Store

**Files:**
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`

This is the integration task. Replace local state with store, wire context menu, add coordinate conversion.

- [ ] **Step 1: Create store instance scoped to component**

Import the factory and component:

```typescript
import { createFlowStore } from "@/lib/flow-editor/flow-store"
import { FlowContextMenu } from "@/components/flow-editor/FlowContextMenu"
import { useReactFlow } from "@xyflow/react"
```

Inside `FlowEditorInner`, create the store via `useRef` to scope it per component instance:

```typescript
const storeRef = useRef<ReturnType<typeof createFlowStore>>(undefined)
if (!storeRef.current) {
  storeRef.current = createFlowStore()
}
const useFlowStore = storeRef.current
```

Get the ReactFlow instance for `fitView` and `screenToFlowPosition`:

```typescript
const reactFlowInstance = useReactFlow()
```

- [ ] **Step 2: Replace state reads with store selectors**

Replace these local state declarations:

```typescript
// REMOVE:
const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
const [selectedNode, setSelectedNode] = useState<Node | null>(null)

// REPLACE WITH:
const nodes = useFlowStore(s => s.nodes)
const edges = useFlowStore(s => s.edges)
const setNodes = useFlowStore(s => s.setNodes)
const setEdges = useFlowStore(s => s.setEdges)
const onNodesChange = useFlowStore(s => s.applyNodeChanges)
const onEdgesChange = useFlowStore(s => s.applyEdgeChanges)
const selectedNode = useFlowStore(s => s.selectedNode)
const setSelectedNode = useFlowStore(s => s.setSelectedNode)
const addEdge = useFlowStore(s => s.addEdge)
const addNode = useFlowStore(s => s.addNode)
const updateNodeData = useFlowStore(s => s.updateNodeData)
```

Remove `useNodesState`, `useEdgesState` from `@xyflow/react` imports.

- [ ] **Step 3: Replace handlers with store actions**

**`onConnect`** — Replace the `useCallback` wrapping `setEdges(eds => addEdge(connection, eds))` with just `addEdge` from store.

**`handleDrop`** — Replace the full `useCallback` with `addNode` from store. This works because `FlowCanvas.onDrop` already has the signature `(type: string, position: { x: number; y: number }) => void` — FlowCanvas internally handles the drag event, extracts the node type from `dataTransfer`, converts viewport coordinates to flow-space via `getBoundingClientRect()`, and calls `onDrop(type, flowPosition)`. So `store.addNode` is a direct match.

**`handleAddNode`** (from command palette) — Call `addNode(type, { x: 250, y: 250 })`.

**`handleNodeDataChange`** — Replace with `updateNodeData`. Remove the `useCallback` that manually maps over `setNodes` and `setSelectedNode`.

**`handleNodeSelect`** — Replace with `setSelectedNode`.

- [ ] **Step 4: Update load/restore effects to use store setters**

**Load flow data** (the `useEffect` with `api.getFlow`):
```typescript
useEffect(() => {
  api.getFlow(flowId).then((flow) => {
    setFlowName(flow.name)
    setFlowStatus(flow.status)
    setFlowVersion(flow.version)
    setNodes((flow.nodesJson || []) as Node[])
    setEdges((flow.edgesJson || []) as Edge[])
    // ... rest unchanged
  })
}, [flowId, setNodes, setEdges])
```

**Draft restore** (the `useEffect` with `api.getFlowDraft`):
```typescript
// Same pattern — use setNodes/setEdges from store
if (shouldRestore) {
  setNodes(draft.nodesJson as Node[])
  setEdges(draft.edgesJson as Edge[])
}
```

**`handleRestore`** (version restore):
```typescript
const handleRestore = useCallback(async (version: number) => {
  try {
    const versions = await api.getFlowVersions(flowId)
    const target = versions.find((v) => v.version === version)
    if (!target) return
    const restored = await api.restoreFlowVersion(flowId, target.id)
    setNodes((restored.nodesJson || []) as Node[])
    setEdges((restored.edgesJson || []) as Edge[])
    setFlowVersion(restored.version)
    setShowHistory(false)
  } catch {
    alert("Failed to restore version.")
  }
}, [flowId, setNodes, setEdges])
```

- [ ] **Step 5: Wire FlowContextMenu and context menu callbacks**

Wrap the center pane (FlowCanvas) with `FlowContextMenu`:

```typescript
<FlowContextMenu
  useStore={useFlowStore}
  onFitView={() => reactFlowInstance.fitView()}
  onEditNode={(nodeId) => {
    const node = useFlowStore.getState().nodes.find(n => n.id === nodeId)
    if (node) setSelectedNode(node)
  }}
  screenToFlowPosition={(pos) => reactFlowInstance.screenToFlowPosition(pos)}
>
  <FlowCanvas
    nodes={styledNodes}
    edges={styledEdges}
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    onConnect={addEdge}
    onNodeSelect={setSelectedNode}
    onDrop={addNode}
    onNodeContextMenu={(e, node) => {
      e.preventDefault()
      useFlowStore.getState().openNodeMenu(node, { x: e.clientX, y: e.clientY })
    }}
    onEdgeContextMenu={(e, edge) => {
      e.preventDefault()
      useFlowStore.getState().openEdgeMenu(edge, { x: e.clientX, y: e.clientY })
    }}
    onPaneContextMenu={(e) => {
      e.preventDefault()
      useFlowStore.getState().openCanvasMenu({ x: e.clientX, y: e.clientY })
    }}
  />
</FlowContextMenu>
```

Note: `useFlowStore.getState()` is valid in event handlers — it's Zustand's imperative access pattern, not a hook call.

- [ ] **Step 6: Add disabled node visual treatment**

Add a `useMemo` after `applyExecutionStyles` that applies disabled styles:

```typescript
const disabledStyledNodes = useMemo(() => {
  return styledNodes.map((node) =>
    node.data?.disabled
      ? {
          ...node,
          style: {
            ...node.style,
            opacity: 0.4,
            borderStyle: "dashed" as const,
          },
        }
      : node,
  )
}, [styledNodes])
```

Pass `disabledStyledNodes` to `FlowCanvas` instead of `styledNodes`.

- [ ] **Step 7: Verify build and manual test**

```bash
cd /Users/me/Development/flowbot && pnpm frontend build
```

Manual test checklist:
1. Open a flow in the editor — nodes and edges load correctly
2. Drag nodes — positions update
3. Connect edges — new edges appear
4. Click a node — PropertyPanel opens
5. Right-click a node — context menu appears
6. Right-click canvas — canvas menu appears
7. Right-click edge — edge menu appears
8. Auto-save fires after changes
9. Command palette (⌘K) still works

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx
git commit -m "refactor(frontend): migrate flow editor state to Zustand store and wire context menus"
```

---

### Task 7: Add Keyboard Shortcuts

**Files:**
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx`

- [ ] **Step 1: Add useEffect keydown listener**

Add a `useEffect` in `FlowEditorInner` with an empty dependency array. The handler reads fresh state via `useFlowStore.getState()` (safe in event handlers).

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) return

    const state = useFlowStore.getState()
    const { selectedNode, copiedNode } = state
    const meta = e.metaKey || e.ctrlKey

    if ((e.key === "Backspace" || e.key === "Delete") && selectedNode) {
      state.deleteNode(selectedNode.id)
      return
    }
    if (meta && e.key === "d" && selectedNode) {
      e.preventDefault()
      state.duplicateNode(selectedNode.id)
      return
    }
    if (meta && e.key === "c" && selectedNode) {
      e.preventDefault()
      state.copyNode(selectedNode.id)
      return
    }
    if (meta && e.key === "v" && copiedNode) {
      e.preventDefault()
      // Paste at viewport center
      const center = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      state.pasteNode(center)
      return
    }
    if (meta && e.key === "/" && selectedNode) {
      e.preventDefault()
      state.toggleNode(selectedNode.id)
      return
    }
    if (meta && e.key === "a") {
      e.preventDefault()
      state.selectAll()
      return
    }
  }

  window.addEventListener("keydown", handler)
  return () => window.removeEventListener("keydown", handler)
}, [useFlowStore, reactFlowInstance])
```

Note: `Enter` is not included as a standalone keyboard shortcut — it's only available in the context menu. When `selectedNode` is set, the PropertyPanel is already visible.

- [ ] **Step 2: Verify build**

```bash
cd /Users/me/Development/flowbot && pnpm frontend build
```

- [ ] **Step 3: Manual test shortcuts**

1. Select a node → press `⌫` → node deleted
2. Select a node → press `⌘D` → node duplicated with offset
3. Select a node → press `⌘C` then `⌘V` → node pasted at viewport center
4. Select a node → press `⌘/` → node becomes visually disabled (dashed, faded)
5. Press `⌘A` → all nodes selected
6. Type in flow name input → shortcuts do NOT fire

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx
git commit -m "feat(frontend): add keyboard shortcuts for flow editor actions"
```

---

### Task 8: Final Integration Test & Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full manual test of context menus**

**Node right-click:**
1. Right-click a node → menu appears with: Edit, Duplicate, Copy, Disable, Add Note, Delete
2. Click "Duplicate" → new node at +30px offset
3. Click "Copy" → right-click canvas → "Paste" enabled → click → node appears at click position
4. Click "Disable" → node faded/dashed → right-click again → label says "Enable"
5. Click "Add Note" → sticky note near node
6. Click "Delete" → node and connected edges removed

**Canvas right-click:**
7. Right-click empty canvas → Add Node, Add Sticky Note, Paste, Select All, Fit View
8. Hover "Add Node" → category submenu → hover category → node types listed
9. Click a node type → node created at correct flow position (not viewport position)
10. Click "Fit View" → canvas zooms to fit

**Edge right-click:**
11. Right-click edge → Insert Node, Delete Edge
12. Hover "Insert Node" → category submenu → click type → node at edge midpoint, edge split
13. Click "Delete Edge" → edge removed

**Interactions:**
14. Left-click drag still works (Radix doesn't interfere)
15. Node palette drag-and-drop still works
16. Command palette (⌘K) still works
17. Auto-save fires after changes
18. Zoom/pan then right-click canvas → "Add Node" places at correct position (coordinate conversion)

- [ ] **Step 2: Verify full build**

```bash
cd /Users/me/Development/flowbot && pnpm frontend build
```

- [ ] **Step 3: Clean up unused imports**

Review `edit/page.tsx` — remove `useNodesState`, `useEdgesState`, `addEdge as xyAddEdge` from `@xyflow/react` imports if still present. Remove any dead `useCallback` wrappers that were replaced by store actions.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(frontend): complete flow builder right-click context menu

- Zustand store replaces local state for nodes/edges/selection
- Context menus for nodes, canvas, and edges with all 13 actions
- Nested category submenus for Add Node with all NODE_TYPES
- Keyboard shortcuts (⌘D/⌘C/⌘V/⌘A/⌘//⌫)
- Disabled node visual treatment (opacity + dashed border)
- Viewport-to-flow coordinate conversion for accurate node placement
- shadcn context-menu.tsx UI component"
```
