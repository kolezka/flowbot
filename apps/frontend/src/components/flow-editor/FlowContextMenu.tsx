"use client"

import { useCallback } from "react"
import { type UseBoundStore, type StoreApi } from "zustand"
import { NODE_TYPES } from "@flowbot/flow-shared"
import {
  Pencil,
  Copy,
  ClipboardPaste,
  Clipboard,
  Ban,
  Check,
  StickyNote,
  Trash2,
  Plus,
  MousePointerSquareDashed,
  Maximize,
  SplitSquareHorizontal,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type FlowStore, type Position } from "@/lib/flow-editor/flow-store"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowContextMenuProps {
  useStore: UseBoundStore<StoreApi<FlowStore>>
  onFitView?: () => void
  onEditNode?: (nodeId: string) => void
  screenToFlowPosition?: (pos: Position) => Position
}

// ---------------------------------------------------------------------------
// Category config with colors
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: "trigger", label: "Triggers", color: "#22c55e" },
  { key: "condition", label: "Conditions", color: "#eab308" },
  { key: "action", label: "Actions", color: "#3b82f6" },
  { key: "advanced", label: "Advanced", color: "#a855f7" },
] as const

function CategoryDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

// ---------------------------------------------------------------------------
// Node category submenu
// ---------------------------------------------------------------------------

function NodeCategorySubmenu({
  onSelect,
}: {
  onSelect: (nodeType: string) => void
}) {
  return (
    <>
      {CATEGORIES.map(({ key, label, color }) => {
        const nodes = NODE_TYPES.filter((n) => n.category === key)
        if (nodes.length === 0) return null
        return (
          <DropdownMenuSub key={key}>
            <DropdownMenuSubTrigger className="gap-2">
              <CategoryDot color={color} />
              {label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto shadow-lg" style={{ backgroundColor: "white" }} sideOffset={4}>
              {nodes.map((n) => (
                <DropdownMenuItem
                  key={n.type}
                  onSelect={() => onSelect(n.type)}
                  className="text-xs"
                >
                  {n.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )
      })}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <CategoryDot color="#6b7280" />
          Annotation
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="shadow-lg" style={{ backgroundColor: "white" }} sideOffset={4}>
          <DropdownMenuItem
            onSelect={() => onSelect("sticky_note")}
            className="text-xs"
          >
            Sticky Note
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}

// ---------------------------------------------------------------------------
// Icon wrapper for consistent sizing
// ---------------------------------------------------------------------------

function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground">{children}</span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FlowContextMenu({
  useStore,
  onFitView,
  onEditNode,
  screenToFlowPosition,
}: FlowContextMenuProps) {
  const menu = useStore((s) => s.menu)
  const copiedNode = useStore((s) => s.copiedNode)
  const closeMenu = useStore((s) => s.closeMenu)
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

  const getFlowPos = useCallback(
    (pos: Position): Position =>
      screenToFlowPosition ? screenToFlowPosition(pos) : pos,
    [screenToFlowPosition],
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeMenu()
    },
    [closeMenu],
  )

  const isOpen = menu?.isOpen ?? false

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <div
          style={{
            position: "fixed",
            left: menu?.position.x ?? 0,
            top: menu?.position.y ?? 0,
            width: 0,
            height: 0,
            pointerEvents: "none",
          }}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-48" style={{ backgroundColor: "white" }} side="bottom" align="start" sideOffset={2}>
        {/* ── Node menu ──────────────────────────────────────── */}
        {menu?.context.type === "node" && (() => {
          const node = menu.context.node
          const isDisabled = node.data.disabled as boolean | undefined

          return (
            <>
              <DropdownMenuItem onSelect={() => onEditNode?.(node.id)}>
                <MenuIcon><Pencil className="h-3.5 w-3.5" /></MenuIcon>
                Edit Node
                <DropdownMenuShortcut>Enter</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicateNode(node.id)}>
                <MenuIcon><Copy className="h-3.5 w-3.5" /></MenuIcon>
                Duplicate
                <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => copyNode(node.id)}>
                <MenuIcon><Clipboard className="h-3.5 w-3.5" /></MenuIcon>
                Copy
                <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => toggleNode(node.id)}>
                <MenuIcon>
                  {isDisabled
                    ? <Check className="h-3.5 w-3.5" />
                    : <Ban className="h-3.5 w-3.5" />}
                </MenuIcon>
                {isDisabled ? "Enable" : "Disable"}
                <DropdownMenuShortcut>⌘/</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  addStickyNote({
                    x: node.position.x + 50,
                    y: node.position.y + 50,
                  })
                }
              >
                <MenuIcon><StickyNote className="h-3.5 w-3.5" /></MenuIcon>
                Add Note
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => deleteNode(node.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
                <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )
        })()}

        {/* ── Canvas menu ────────────────────────────────────── */}
        {menu?.context.type === "canvas" && (() => {
          const flowPos = getFlowPos(menu.position)

          return (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <MenuIcon><Plus className="h-3.5 w-3.5" /></MenuIcon>
                  Add Node
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="shadow-lg" style={{ backgroundColor: "white" }} sideOffset={4}>
                  <NodeCategorySubmenu
                    onSelect={(nodeType) => addNode(nodeType, flowPos)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => addStickyNote(flowPos)}>
                <MenuIcon><StickyNote className="h-3.5 w-3.5" /></MenuIcon>
                Add Sticky Note
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!copiedNode}
                onSelect={() => pasteNode(flowPos)}
              >
                <MenuIcon><ClipboardPaste className="h-3.5 w-3.5" /></MenuIcon>
                Paste
                <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => selectAll()}>
                <MenuIcon><MousePointerSquareDashed className="h-3.5 w-3.5" /></MenuIcon>
                Select All
                <DropdownMenuShortcut>⌘A</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onFitView?.()}>
                <MenuIcon><Maximize className="h-3.5 w-3.5" /></MenuIcon>
                Fit View
              </DropdownMenuItem>
            </>
          )
        })()}

        {/* ── Edge menu ──────────────────────────────────────── */}
        {menu?.context.type === "edge" && (() => {
          const edge = menu.context.edge

          return (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <MenuIcon><SplitSquareHorizontal className="h-3.5 w-3.5" /></MenuIcon>
                  Insert Node
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="shadow-lg" style={{ backgroundColor: "white" }} sideOffset={4}>
                  <NodeCategorySubmenu
                    onSelect={(nodeType) =>
                      insertNodeOnEdge(edge.id, nodeType)
                    }
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => deleteEdge(edge.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Edge
                <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )
        })()}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
