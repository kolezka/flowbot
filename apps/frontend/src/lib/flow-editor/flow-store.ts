import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as xyAddEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import { NODE_TYPES } from "@flowbot/flow-shared";

export interface Position {
  x: number;
  y: number;
}

export type MenuContext =
  | { type: "node"; node: Node }
  | { type: "edge"; edge: Edge }
  | { type: "canvas" };

export interface MenuState {
  isOpen: boolean;
  position: Position;
  context: MenuContext;
}

export interface FlowStore {
  // Flow state
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  copiedNode: Node | null;
  menu: MenuState | null;

  // Flow state setters
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  applyNodeChanges: (changes: NodeChange[]) => void;
  applyEdgeChanges: (changes: EdgeChange[]) => void;
  addEdge: (connection: Connection) => void;
  addNode: (type: string, position: Position) => void;
  setSelectedNode: (node: Node | null) => void;
  updateNodeData: (nodeId: string, key: string, value: unknown) => void;

  // Menu openers
  openNodeMenu: (node: Node, position: Position) => void;
  openEdgeMenu: (edge: Edge, position: Position) => void;
  openCanvasMenu: (position: Position) => void;
  closeMenu: () => void;

  // Context menu actions
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  copyNode: (id: string) => void;
  pasteNode: (position: Position) => void;
  toggleNode: (id: string) => void;
  addStickyNote: (position: Position) => void;
  deleteEdge: (id: string) => void;
  insertNodeOnEdge: (edgeId: string, nodeType: string) => void;
  selectAll: () => void;
}

export function createFlowStore(): UseBoundStore<StoreApi<FlowStore>> {
  return create<FlowStore>((set, get) => ({
    // Initial state
    nodes: [],
    edges: [],
    selectedNode: null,
    copiedNode: null,
    menu: null,

    // Flow state setters
    setNodes: (nodes) => set(() => ({ nodes })),

    setEdges: (edges) => set(() => ({ edges })),

    applyNodeChanges: (changes) =>
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
      })),

    applyEdgeChanges: (changes) =>
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      })),

    addEdge: (connection) =>
      set((state) => ({
        edges: xyAddEdge(connection, state.edges),
      })),

    addNode: (type, position) => {
      const nodeDef = NODE_TYPES.find((n) => n.type === type);
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: "default",
        position,
        data: {
          label: nodeDef?.label ?? type,
          nodeType: type,
          category: nodeDef?.category ?? "action",
          requiresConnection: nodeDef?.requiresConnection ?? false,
          config: {},
        },
        style: {
          border: `2px solid ${nodeDef?.color ?? "#888"}`,
          borderRadius: 8,
          padding: 8,
          minWidth: 150,
        },
      };
      set((state) => ({ nodes: [...state.nodes, newNode] }));
    },

    setSelectedNode: (node) => set(() => ({ selectedNode: node })),

    updateNodeData: (nodeId, key, value) =>
      set((state) => {
        const updatedNodes = state.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            data: {
              ...n.data,
              config: {
                ...(n.data.config as Record<string, unknown>),
                [key]: value,
              },
            },
          };
        });

        const updatedSelectedNode =
          state.selectedNode?.id === nodeId
            ? (updatedNodes.find((n) => n.id === nodeId) ?? null)
            : state.selectedNode;

        return { nodes: updatedNodes, selectedNode: updatedSelectedNode };
      }),

    // Menu openers
    openNodeMenu: (node, position) =>
      set(() => ({
        menu: { isOpen: true, position, context: { type: "node", node } },
      })),

    openEdgeMenu: (edge, position) =>
      set(() => ({
        menu: { isOpen: true, position, context: { type: "edge", edge } },
      })),

    openCanvasMenu: (position) =>
      set(() => ({
        menu: { isOpen: true, position, context: { type: "canvas" } },
      })),

    closeMenu: () => set(() => ({ menu: null })),

    // Context menu actions
    deleteNode: (id) =>
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter(
          (e) => e.source !== id && e.target !== id
        ),
        selectedNode:
          state.selectedNode?.id === id ? null : state.selectedNode,
        menu: null,
      })),

    duplicateNode: (id) => {
      const { nodes } = get();
      const original = nodes.find((n) => n.id === id);
      if (!original) return;

      const cloned = structuredClone(original);
      const nodeType = (cloned.data.nodeType as string) ?? id;
      const newId = `${nodeType}-${Date.now()}`;
      const newNode: Node = {
        ...cloned,
        id: newId,
        position: {
          x: cloned.position.x + 30,
          y: cloned.position.y + 30,
        },
        selected: true,
      };

      set((state) => ({
        nodes: [
          ...state.nodes.map((n) => ({ ...n, selected: false as const })),
          newNode,
        ],
        selectedNode: newNode,
        menu: null,
      }));
    },

    copyNode: (id) => {
      const { nodes } = get();
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      set(() => ({ copiedNode: structuredClone(node), menu: null }));
    },

    pasteNode: (position) => {
      const { copiedNode } = get();
      if (!copiedNode) return;

      const nodeType = (copiedNode.data.nodeType as string) ?? copiedNode.id;
      const newId = `${nodeType}-${Date.now()}`;
      const pasted: Node = {
        ...structuredClone(copiedNode),
        id: newId,
        position,
      };

      set((state) => ({
        nodes: [...state.nodes, pasted],
        copiedNode: structuredClone(pasted),
        menu: null,
      }));
    },

    toggleNode: (id) =>
      set((state) => {
        const updatedNodes = state.nodes.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              disabled: !(n.data.disabled as boolean | undefined),
            },
          };
        });

        const updatedSelectedNode =
          state.selectedNode?.id === id
            ? (updatedNodes.find((n) => n.id === id) ?? null)
            : state.selectedNode;

        return {
          nodes: updatedNodes,
          selectedNode: updatedSelectedNode,
          menu: null,
        };
      }),

    addStickyNote: (position) => {
      const newNode: Node = {
        id: `sticky_note-${Date.now()}`,
        type: "sticky_note",
        position,
        data: {
          config: { text: "Note", color: "yellow" },
        },
      };
      set((state) => ({ nodes: [...state.nodes, newNode], menu: null }));
    },

    deleteEdge: (id) =>
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== id),
        menu: null,
      })),

    insertNodeOnEdge: (edgeId, nodeType) => {
      const { nodes, edges } = get();
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      const position: Position =
        sourceNode && targetNode
          ? {
              x: (sourceNode.position.x + targetNode.position.x) / 2,
              y: (sourceNode.position.y + targetNode.position.y) / 2,
            }
          : { x: 250, y: 250 };

      const nodeDef = NODE_TYPES.find((n) => n.type === nodeType);
      const newNodeId = `${nodeType}-${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        type: "default",
        position,
        data: {
          label: nodeDef?.label ?? nodeType,
          nodeType,
          category: nodeDef?.category ?? "action",
          requiresConnection: nodeDef?.requiresConnection ?? false,
          config: {},
        },
        style: {
          border: `2px solid ${nodeDef?.color ?? "#888"}`,
          borderRadius: 8,
          padding: 8,
          minWidth: 150,
        },
      };

      const sourceEdge: Edge = {
        id: `${edge.source}-${newNodeId}-${Date.now()}`,
        source: edge.source,
        target: newNodeId,
      };

      const targetEdge: Edge = {
        id: `${newNodeId}-${edge.target}-${Date.now()}`,
        source: newNodeId,
        target: edge.target,
      };

      set((state) => ({
        nodes: [...state.nodes, newNode],
        edges: [
          ...state.edges.filter((e) => e.id !== edgeId),
          sourceEdge,
          targetEdge,
        ],
        menu: null,
      }));
    },

    selectAll: () =>
      set((state) => ({
        nodes: state.nodes.map((n) => ({ ...n, selected: true })),
        menu: null,
      })),
  }));
}
