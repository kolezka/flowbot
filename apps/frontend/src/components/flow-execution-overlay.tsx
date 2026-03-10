"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type Node, type Edge } from "@xyflow/react";
import { api, type FlowExecution } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

// --- Types ---

interface NodeResult {
  status: "running" | "completed" | "failed";
  output?: any;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

type NodeResults = Record<string, NodeResult>;

interface ExecutionState {
  execution: FlowExecution | null;
  nodeResults: NodeResults;
  traversedEdges: Set<string>;
  isRunning: boolean;
}

// --- Utility: apply execution styles to nodes/edges ---

export function applyExecutionStyles(
  nodes: Node[],
  edges: Edge[],
  executionState: ExecutionState,
): { styledNodes: Node[]; styledEdges: Edge[] } {
  const { nodeResults, traversedEdges } = executionState;

  const styledNodes = nodes.map((node) => {
    const result = nodeResults[node.id];
    if (!result) return node;

    let borderColor: string;
    let boxShadow: string;

    switch (result.status) {
      case "running":
        borderColor = "#eab308";
        boxShadow = "0 0 0 2px rgba(234,179,8,0.4), 0 0 12px rgba(234,179,8,0.3)";
        break;
      case "completed":
        borderColor = "#22c55e";
        boxShadow = "0 0 0 2px rgba(34,197,94,0.3)";
        break;
      case "failed":
        borderColor = "#ef4444";
        boxShadow = "0 0 0 2px rgba(239,68,68,0.3)";
        break;
    }

    return {
      ...node,
      style: {
        ...(node.style as Record<string, unknown>),
        border: `2px solid ${borderColor}`,
        boxShadow,
        transition: "border-color 0.3s, box-shadow 0.3s",
      },
    };
  });

  const styledEdges = edges.map((edge) => {
    const edgeKey = `${edge.source}->${edge.target}`;
    if (!traversedEdges.has(edgeKey)) return edge;

    return {
      ...edge,
      style: {
        ...(edge.style as Record<string, unknown>),
        stroke: "#22c55e",
        strokeWidth: 2,
      },
      animated: true,
    };
  });

  return { styledNodes, styledEdges };
}

// --- Status icon for nodes (rendered as custom label suffix) ---

export function getNodeStatusIcon(
  nodeId: string,
  nodeResults: NodeResults,
): React.ReactNode {
  const result = nodeResults[nodeId];
  if (!result) return null;

  switch (result.status) {
    case "running":
      return <Loader2 className="inline-block ml-1 h-3.5 w-3.5 text-yellow-500 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="inline-block ml-1 h-3.5 w-3.5 text-green-500" />;
    case "failed":
      return <XCircle className="inline-block ml-1 h-3.5 w-3.5 text-red-500" />;
  }
}

// --- Execution Toolbar Button ---

interface ExecutionToolbarProps {
  flowId: string;
  nodes: Node[];
  edges: Edge[];
  executionState: ExecutionState;
  onExecutionStateChange: (state: ExecutionState) => void;
}

export function ExecutionToolbar({
  flowId,
  nodes,
  edges,
  executionState,
  onExecutionStateChange,
}: ExecutionToolbarProps) {
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const computeTraversedEdges = useCallback(
    (results: NodeResults): Set<string> => {
      const traversed = new Set<string>();
      for (const edge of edges) {
        const sourceResult = results[edge.source];
        const targetResult = results[edge.target];
        if (
          sourceResult &&
          (sourceResult.status === "completed" || sourceResult.status === "failed") &&
          targetResult
        ) {
          traversed.add(`${edge.source}->${edge.target}`);
        }
      }
      return traversed;
    },
    [edges],
  );

  const pollExecution = useCallback(
    async (executionId: string) => {
      try {
        const exec = await api.getFlowExecution(executionId);
        const results = (exec.nodeResults ?? {}) as NodeResults;
        const traversed = computeTraversedEdges(results);
        const isRunning = exec.status === "running";

        onExecutionStateChange({
          execution: exec,
          nodeResults: results,
          traversedEdges: traversed,
          isRunning,
        });

        if (!isRunning) {
          stopPolling();
        }
      } catch {
        stopPolling();
      }
    },
    [computeTraversedEdges, onExecutionStateChange, stopPolling],
  );

  const handleTestExecute = async () => {
    if (executionState.isRunning) return;
    if (nodes.length === 0) return;

    try {
      const exec = await api.testExecuteFlow(flowId);

      onExecutionStateChange({
        execution: exec,
        nodeResults: {},
        traversedEdges: new Set(),
        isRunning: true,
      });

      // Start polling
      stopPolling();
      pollingRef.current = setInterval(() => {
        pollExecution(exec.id);
      }, 500);
    } catch (e: any) {
      alert(e.message || "Failed to start test execution");
    }
  };

  const handleClearExecution = () => {
    stopPolling();
    onExecutionStateChange({
      execution: null,
      nodeResults: {},
      traversedEdges: new Set(),
      isRunning: false,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTestExecute}
        disabled={executionState.isRunning || nodes.length === 0}
      >
        {executionState.isRunning ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play className="mr-1 h-4 w-4" />
            Test Run
          </>
        )}
      </Button>
      {executionState.execution && !executionState.isRunning && (
        <Button variant="ghost" size="sm" onClick={handleClearExecution}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}

// --- Execution Panel (side/bottom) ---

interface ExecutionPanelProps {
  executionState: ExecutionState;
  nodes: Node[];
}

export function ExecutionPanel({ executionState, nodes }: ExecutionPanelProps) {
  const { execution, nodeResults, isRunning } = executionState;
  const [expanded, setExpanded] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  if (!execution) return null;

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const statusBadge = () => {
    switch (execution.status) {
      case "running":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Running</Badge>;
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Failed</Badge>;
      default:
        return <Badge variant="secondary">{execution.status}</Badge>;
    }
  };

  const duration = execution.completedAt
    ? Math.round(
        (new Date(execution.completedAt).getTime() -
          new Date(execution.startedAt).getTime()) /
          1000 *
          10,
      ) / 10
    : null;

  // Sort nodes by execution order (startedAt)
  const executedNodeIds = Object.keys(nodeResults).sort((a, b) => {
    const aTime = nodeResults[a]?.startedAt ?? "";
    const bTime = nodeResults[b]?.startedAt ?? "";
    return aTime.localeCompare(bTime);
  });

  return (
    <div className="border-t border-border bg-card">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Execution</span>
          {statusBadge()}
          {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />}
          {duration !== null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {duration}s
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </div>

      {/* Body */}
      {expanded && (
        <div className="max-h-64 overflow-y-auto px-4 pb-3">
          {execution.error && (
            <div className="mb-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600">
              {execution.error}
            </div>
          )}

          {executedNodeIds.length === 0 && isRunning && (
            <p className="text-xs text-muted-foreground py-2">Waiting for nodes to execute...</p>
          )}

          <div className="space-y-1">
            {executedNodeIds.map((nodeId) => {
              const result = nodeResults[nodeId];
              if (!result) return null;
              const node = nodes.find((n) => n.id === nodeId);
              const label = node?.data?.label ?? nodeId;
              const isExpanded = expandedNodes.has(nodeId);

              const nodeDuration =
                result.completedAt && result.startedAt
                  ? Math.round(
                      (new Date(result.completedAt).getTime() -
                        new Date(result.startedAt).getTime()),
                    )
                  : null;

              return (
                <div
                  key={nodeId}
                  className="rounded-md border border-border text-xs"
                >
                  <div
                    className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleNode(nodeId)}
                  >
                    <div className="flex items-center gap-1.5">
                      {result.status === "running" && (
                        <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                      )}
                      {result.status === "completed" && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                      {result.status === "failed" && (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="font-medium">{String(label)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {nodeDuration !== null && <span>{nodeDuration}ms</span>}
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </div>
                  </div>

                  {isExpanded && result.output && (
                    <div className="border-t border-border px-2.5 py-1.5 bg-muted/30">
                      <pre className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                        {JSON.stringify(result.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {isExpanded && result.error && (
                    <div className="border-t border-border px-2.5 py-1.5 bg-red-500/5">
                      <p className="text-red-600 text-[11px]">{result.error}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Hook for managing execution state ---

export function useExecutionState() {
  const [executionState, setExecutionState] = useState<ExecutionState>({
    execution: null,
    nodeResults: {},
    traversedEdges: new Set(),
    isRunning: false,
  });

  return { executionState, setExecutionState };
}
