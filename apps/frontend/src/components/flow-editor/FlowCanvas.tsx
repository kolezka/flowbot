"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SubflowNode } from "./SubflowNode";
import { StickyNote } from "./StickyNote";

const DEFAULT_NODE_TYPES = {
  subflow: SubflowNode,
  sticky_note: StickyNote,
};

export interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeSelect: (node: Node | null) => void;
  onDrop: (type: string, position: { x: number; y: number }) => void;
  nodeTypes?: Record<string, React.ComponentType<any>>;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeSelect,
  onDrop,
  nodeTypes: extraNodeTypes,
}: FlowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const mergedNodeTypes = useMemo(
    () => ({ ...DEFAULT_NODE_TYPES, ...extraNodeTypes }),
    [extraNodeTypes],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset when leaving the wrapper itself, not child elements
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as globalThis.Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const type = e.dataTransfer.getData("application/reactflow-type");
      if (!type) return;

      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: e.clientX - bounds.left - 75,
        y: e.clientY - bounds.top - 20,
      };

      onDrop(type, position);
    },
    [onDrop],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect(node);
    },
    [onNodeSelect],
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div
      ref={wrapperRef}
      className={`flex-1 transition-colors ${isDragOver ? "bg-primary/5 border-2 border-dashed border-primary/20" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={mergedNodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
