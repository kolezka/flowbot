# Flow Builder Context Menu

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Right-click context menus for nodes, edges, and canvas in the flow editor

## Overview

Add right-click context menus to the flow builder with a Zustand-based controller pattern. A factory function `createFlowContextMenu()` produces a store hook and a self-wired React component. The store owns all flow state (nodes, edges, selection, clipboard) and context menu state, eliminating the need for prop drilling or callback registration.

## Prerequisites

Install dependencies before implementation:

```bash
pnpm --filter @flowbot/frontend add zustand @radix-ui/react-context-menu
```

| Package | Purpose |
|---------|---------|
| `zustand` | State management for flow + context menu state |
| `@radix-ui/react-context-menu` | Accessible context menu primitives |

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `components/ui/context-menu.tsx` | shadcn-style wrapper around `@radix-ui/react-context-menu` |
| `lib/flow-editor/flow-store.ts` | Zustand store factory — `createFlowContextMenu()` |
| `components/flow-editor/FlowContextMenu.tsx` | Context menu component with node/edge/canvas variants |

### Modified Files

| File | Change |
|------|--------|
| `app/dashboard/flows/[id]/edit/page.tsx` | Replace `useNodesState`/`useEdgesState` with Zustand store. Remove local `useState` for nodes, edges, selectedNode. Wire ReactFlow as controlled component from store. |
| `components/flow-editor/FlowCanvas.tsx` | Add `onNodeContextMenu`, `onEdgeContextMenu`, `onPaneContextMenu` handlers. Accept store hook or controller for opening menus. |

## Architecture

### Factory Pattern

```typescript
const [useFlowStore, FlowContextMenu] = createFlowContextMenu()
```

Returns a tuple:
- `useFlowStore` — Zustand hook for reading/writing all flow and menu state
- `FlowContextMenu` — React component pre-wired to the store, renders the context menu with zero props

### Store Shape

```typescript
interface FlowContextMenuStore {
  // Flow state (replaces useNodesState/useEdgesState)
  nodes: Node[]
  edges: Edge[]
  selectedNode: Node | null
  copiedNode: Node | null

  // Context menu state
  menu: {
    isOpen: boolean
    position: { x: number; y: number }
    context:
      | { type: 'node'; node: Node }
      | { type: 'edge'; edge: Edge }
      | { type: 'canvas' }
  } | null

  // Flow actions
  applyNodeChanges: (changes: NodeChange[]) => void
  applyEdgeChanges: (changes: EdgeChange[]) => void
  addEdge: (connection: Connection) => void
  addNode: (type: string, position: { x: number; y: number }) => void
  setSelectedNode: (node: Node | null) => void

  // Context menu openers
  openNodeMenu: (node: Node, position: { x: number; y: number }) => void
  openEdgeMenu: (edge: Edge, position: { x: number; y: number }) => void
  openCanvasMenu: (position: { x: number; y: number }) => void
  closeMenu: () => void

  // Context menu actions
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  copyNode: (id: string) => void
  pasteNode: (position: { x: number; y: number }) => void
  toggleNode: (id: string) => void
  addStickyNote: (position: { x: number; y: number }) => void
  deleteEdge: (id: string) => void
  insertNodeOnEdge: (edgeId: string, nodeType: string) => void
  selectAll: () => void
}
```

Note: `fitView` requires ReactFlow's instance method via `useReactFlow()`. The store does not own this — `FlowEditorInner` calls `reactFlowInstance.fitView()` directly when the context menu triggers it, via a thin callback passed to the component or invoked from a store subscription.

### Data Flow

```
ReactFlow events (onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu)
  → store.openNodeMenu / openEdgeMenu / openCanvasMenu
  → store.menu state updates
  → FlowContextMenu reads menu state, renders appropriate variant
  → user clicks menu item
  → store action (deleteNode, duplicateNode, etc.) mutates nodes/edges
  → ReactFlow re-renders with updated nodes/edges from store
```

### Integration with FlowEditorInner

The edit page simplifies significantly:

- `useNodesState` / `useEdgesState` → removed, replaced by `useFlowStore(s => s.nodes)` and `useFlowStore(s => s.edges)`
- `selectedNode` / `setSelectedNode` → from store
- `handleDrop` → calls `store.addNode(type, position)`
- `handleNodeDataChange` → operates on store nodes directly
- Auto-save: In `FlowEditorInner`, read nodes/edges from the store at the component level (`const nodes = useFlowStore(s => s.nodes)`) then pass them to `useAutoSave({ flowId, nodesJson: nodes, edgesJson: edges, onSave: handleAutoSave })` — the hook signature remains unchanged
- Execution overlay: `applyExecutionStyles` receives nodes/edges from store
- PropertyPanel reads `selectedNode` from store

### Component Placement in JSX

`FlowContextMenu` renders a `ContextMenu.Root` that wraps the ReactFlow canvas div inside `FlowCanvas`. The component tree looks like:

```tsx
// Inside FlowCanvas
<ContextMenu.Root>
  <ContextMenu.Trigger asChild>
    <div ref={wrapperRef} className="flex-1 ...">
      <ReactFlow
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        ...
      />
    </div>
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content>
      {/* Menu items based on store.menu.context.type */}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
```

The `ContextMenu.Trigger` wraps the entire canvas, so any right-click within it opens the Radix menu. ReactFlow's `onNodeContextMenu`/`onEdgeContextMenu`/`onPaneContextMenu` fire first (during capture phase), setting the store context before Radix opens the menu content. This means a single `ContextMenu.Root` handles all three variants — the content switches based on `store.menu.context.type`.

### Integration with FlowCanvas

`FlowCanvas` gains three new **callback props** on `FlowCanvasProps` (preserving its controlled component design):

```typescript
export interface FlowCanvasProps {
  // ... existing props ...
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void
  onPaneContextMenu?: (event: React.MouseEvent | MouseEvent) => void
}
```

`FlowEditorInner` wires these to store actions:

```typescript
<FlowCanvas
  onNodeContextMenu={(event, node) => {
    event.preventDefault()
    store.openNodeMenu(node, { x: event.clientX, y: event.clientY })
  }}
  onEdgeContextMenu={(event, edge) => {
    event.preventDefault()
    store.openEdgeMenu(edge, { x: event.clientX, y: event.clientY })
  }}
  onPaneContextMenu={(event) => {
    event.preventDefault()
    store.openCanvasMenu({ x: event.clientX, y: event.clientY })
  }}
  ...
/>
```

`FlowCanvas` passes these callbacks through to ReactFlow's matching props. The store is NOT accessed directly inside `FlowCanvas`.

## Context Menu Variants

### Node Menu

| Item | Emoji | Shortcut | Action |
|------|-------|----------|--------|
| Edit Node | ✏️ | Enter | Select node, open PropertyPanel |
| Duplicate | 📋 | ⌘D | Clone node with +30px offset |
| Copy | 📄 | ⌘C | Store node snapshot in `copiedNode` |
| — separator — | | | |
| Disable / Enable | 🚫 | ⌘/ | Toggle `data.disabled` boolean |
| Add Note | 📝 | — | Create sticky note at +50px offset from node |
| — separator — | | | |
| Delete | 🗑️ | ⌫ | Remove node and connected edges |

"Disable" label toggles to "Enable" when `node.data.disabled === true`.

### Canvas Menu

| Item | Emoji | Shortcut | Action |
|------|-------|----------|--------|
| Add Node ▸ | 📦 | — | Nested submenu by category |
| Add Sticky Note | 📝 | — | Create sticky note at click position |
| — separator — | | | |
| Paste | 📋 | ⌘V | Paste copied node at click position (disabled when clipboard empty) |
| — separator — | | | |
| Select All | 🔲 | ⌘A | Select all nodes |
| Fit View | 🔍 | — | Fit all nodes in viewport |

### Edge Menu

| Item | Emoji | Shortcut | Action |
|------|-------|----------|--------|
| Insert Node ▸ | 📦 | — | Nested submenu by category (same as Add Node) |
| — separator — | | | |
| Delete Edge | 🗑️ | ⌫ | Remove edge |

### Add Node Submenu (nested)

Uses `ContextMenu.Sub` → `ContextMenu.SubTrigger` → `ContextMenu.SubContent` with 5 categories from `NODE_TYPES` in `@flowbot/flow-shared`:

| Category | Color | Example nodes |
|----------|-------|---------------|
| 🟢 Triggers | green | Message Received, User Joins, Schedule, Webhook |
| 🟡 Conditions | yellow | Keyword Match, User Role, Time Based, Regex Match |
| 🔵 Actions | blue | Send Message, Ban User, Create Poll, Send Photo |
| 🟣 Advanced | purple | Delay, HTTP Request, Transform, Run Subflow |
| 📎 Annotation | gray | Sticky Note |

**Note on Sticky Note:** The `sticky_note` type is not currently in `NODE_TYPES` in `flow-shared`. It is handled as a special case — `addStickyNote` in the store creates a node with `type: 'sticky_note'` directly (matching the existing `StickyNote` component registered in `FlowCanvas`'s `DEFAULT_NODE_TYPES`). In the "Add Node" submenu, Sticky Note appears as a hardcoded entry under "Annotation" rather than being sourced from `NODE_TYPES`. Future: add `sticky_note` to `NODE_TYPES` in `flow-shared` if more annotation types are needed.

Each category opens a sub-submenu listing all node types in that category. Clicking a node type calls `store.addNode(type, position)` where position is the original right-click location.

For the edge "Insert Node" submenu, the same category structure is used, but the action calls `store.insertNodeOnEdge(edgeId, nodeType)` instead.

## Action Details

### duplicateNode(id)

1. Find node by id in `nodes`
2. Create a new node with:
   - `id`: `${node.type}-${Date.now()}`
   - `position`: `{ x: node.position.x + 30, y: node.position.y + 30 }`
   - Deep clone of `data` (including `config`)
   - Same `style` and `type`
3. Append to nodes array (immutable update)
4. Select the new node

### copyNode(id) / pasteNode(position)

- `copyNode`: deep clones the node and stores in `copiedNode`
- `pasteNode`: creates a new node from `copiedNode` snapshot with new id and the provided position. Sets `copiedNode` to the new snapshot (allows repeated paste).

### toggleNode(id)

Sets `node.data.disabled = !node.data.disabled` (immutable update). Disabled nodes are not a backend concept yet — this is purely visual in the editor. Future: flow execution can skip disabled nodes.

### insertNodeOnEdge(edgeId, nodeType)

1. Find the edge by id — `edge.source` and `edge.target` are **node ID strings**, not coordinates
2. Look up source and target nodes from `nodes` array by ID
3. Calculate midpoint from node positions: `{ x: (sourceNode.position.x + targetNode.position.x) / 2, y: (sourceNode.position.y + targetNode.position.y) / 2 }`
   - If either node is not found, fall back to `{ x: 250, y: 250 }` (viewport center)
4. Create new node at midpoint
5. Remove original edge
6. Create two new edges: `source → newNode` and `newNode → target`

### deleteNode(id)

Remove the node and all edges connected to it (where `edge.source === id || edge.target === id`).

## Disabled Node Visual Treatment

When `node.data.disabled === true`, apply in a `useMemo` pass over nodes before passing to ReactFlow:

- `opacity: 0.4`
- `border-style: dashed`
- No change to handles (edges remain connected)

This follows the same pattern as the existing `applyExecutionStyles()`.

## Keyboard Shortcuts

Handled via a `useEffect` keydown listener in `FlowEditorInner`, checking if the canvas has focus (not an input/textarea):

| Shortcut | Action | Condition |
|----------|--------|-----------|
| ⌫ / Delete | Delete selected node or edge | `selectedNode` or selected edge exists |
| ⌘D | Duplicate selected node | `selectedNode` exists |
| ⌘C | Copy selected node | `selectedNode` exists |
| ⌘V | Paste at viewport center | `copiedNode` exists |
| ⌘/ | Toggle disable on selected node | `selectedNode` exists |
| ⌘A | Select all nodes | Always |
| Enter | Open PropertyPanel for selected node | `selectedNode` exists |

## Visual Style

Minimal shadcn/Radix aesthetic with emoji icons:
- Dark background (`bg-popover`), rounded corners (`rounded-md`)
- Emoji prefix on each item for quick scanning
- Keyboard shortcuts right-aligned in muted text
- Separator lines between logical groups
- Delete items in red (`text-destructive`)
- Disabled items at reduced opacity
- Hover highlight on items (`bg-accent`)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Large refactor of FlowEditorInner state | Incremental: first extract state to store, verify ReactFlow works as controlled component, then add context menu |
| ContextMenu.Trigger wrapping ReactFlow may interfere with drag-and-drop | Test early — Radix ContextMenu only captures right-click, should not interfere with left-click drag. If conflict found, fall back to manual positioning with DropdownMenu |
| NODE_TYPES list is long (~100 nodes) | Category submenus keep each list manageable. Platform filtering (telegram/discord/general) can be added later |
| `fitView` requires ReactFlow instance | Thin callback from `useReactFlow()` in FlowEditorInner, not stored in Zustand |
| Keyboard shortcuts (⌘A, ⌘C, ⌘V) may conflict with ReactFlow/browser builtins | The keydown listener must call `event.preventDefault()` and check `event.target` to avoid firing when typing in inputs/textareas. ReactFlow's internal ⌘A multi-select is overridden intentionally (our handler calls `store.selectAll()` which achieves the same result). ⌘C/⌘V only activate when a flow node is selected, not when browser text selection is active. Test keyboard interactions early in implementation. |
