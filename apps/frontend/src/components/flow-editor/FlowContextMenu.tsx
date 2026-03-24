"use client"

import { type ReactNode } from "react"
import { type UseBoundStore, type StoreApi } from "zustand"
import { NODE_TYPES } from "@flowbot/flow-shared"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { type FlowStore, type Position } from "@/lib/flow-editor/flow-store"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowContextMenuProps {
  useStore: UseBoundStore<StoreApi<FlowStore>>
  children: ReactNode
  onFitView?: () => void
  onEditNode?: (nodeId: string) => void
  screenToFlowPosition?: (pos: Position) => Position
}

// ---------------------------------------------------------------------------
// Node category submenu
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: "trigger", label: "🟢 Triggers" },
  { key: "condition", label: "🟡 Conditions" },
  { key: "action", label: "🔵 Actions" },
  { key: "advanced", label: "🟣 Advanced" },
] as const

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
                <ContextMenuItem key={n.type} onSelect={() => onSelect(n.type)}>
                  {n.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )
      })}
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FlowContextMenu({
  useStore,
  children,
  onFitView,
  onEditNode,
  screenToFlowPosition,
}: FlowContextMenuProps) {
  const menu = useStore((s) => s.menu)
  const copiedNode = useStore((s) => s.copiedNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const duplicateNode = useStore((s) => s.duplicateNode)
  const copyNode = useStore((s) => s.copyNode)
  const pasteNode = useStore((s) => s.pasteNode)
  const toggleNode = useStore((s) => s.toggleNode)
  const addStickyNote = useStore((s) => s.addStickyNote)
  const addNode = useStore((s) => s.addNode)
  const deleteEdge = useStore((s) => s.deleteEdge)
  const insertNodeOnEdge = useStore((s) => s.insertNodeOnEdge)
  const selectAll = useStore((s) => s.selectAll)

  const getFlowPos = (pos: Position): Position =>
    screenToFlowPosition ? screenToFlowPosition(pos) : pos

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div style={{ display: "contents" }}>{children}</div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {/* ---------------------------------------------------------------- */}
        {/* Node context menu                                                 */}
        {/* ---------------------------------------------------------------- */}
        {menu?.context.type === "node" && (() => {
          const node = menu.context.node
          const isDisabled = node.data.disabled as boolean | undefined

          return (
            <>
              <ContextMenuItem onSelect={() => onEditNode?.(node.id)}>
                ✏️ Edit Node
                <ContextMenuShortcut>Enter</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => duplicateNode(node.id)}>
                📋 Duplicate
                <ContextMenuShortcut>⌘D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => copyNode(node.id)}>
                📄 Copy
                <ContextMenuShortcut>⌘C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => toggleNode(node.id)}>
                {isDisabled ? "✅ Enable" : "🚫 Disable"}
                <ContextMenuShortcut>⌘/</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() =>
                  addStickyNote({
                    x: node.position.x + 50,
                    y: node.position.y + 50,
                  })
                }
              >
                📝 Add Note
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive"
                onSelect={() => deleteNode(node.id)}
              >
                🗑️ Delete
                <ContextMenuShortcut>⌫</ContextMenuShortcut>
              </ContextMenuItem>
            </>
          )
        })()}

        {/* ---------------------------------------------------------------- */}
        {/* Canvas context menu                                               */}
        {/* ---------------------------------------------------------------- */}
        {menu?.context.type === "canvas" && (() => {
          const flowPos = getFlowPos(menu.position)

          return (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger>📦 Add Node</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <NodeCategorySubmenu
                    onSelect={(nodeType) => addNode(nodeType, flowPos)}
                  />
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuItem
                onSelect={() => addStickyNote(flowPos)}
              >
                📝 Add Sticky Note
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={!copiedNode}
                onSelect={() => pasteNode(flowPos)}
              >
                📋 Paste
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => selectAll()}>
                🔲 Select All
                <ContextMenuShortcut>⌘A</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onFitView?.()}>
                🔍 Fit View
              </ContextMenuItem>
            </>
          )
        })()}

        {/* ---------------------------------------------------------------- */}
        {/* Edge context menu                                                 */}
        {/* ---------------------------------------------------------------- */}
        {menu?.context.type === "edge" && (() => {
          const edge = menu.context.edge

          return (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger>📦 Insert Node</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <NodeCategorySubmenu
                    onSelect={(nodeType) =>
                      insertNodeOnEdge(edge.id, nodeType)
                    }
                  />
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive"
                onSelect={() => deleteEdge(edge.id)}
              >
                🗑️ Delete Edge
                <ContextMenuShortcut>⌫</ContextMenuShortcut>
              </ContextMenuItem>
            </>
          )
        })()}
      </ContextMenuContent>
    </ContextMenu>
  )
}
