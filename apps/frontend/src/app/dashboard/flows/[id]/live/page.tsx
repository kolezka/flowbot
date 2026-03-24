"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";
import type { FlowDefinition, FlowExecution } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  success: "#22c55e",
  completed: "#22c55e",
  error: "#ef4444",
  failed: "#ef4444",
  running: "#eab308",
  pending: "#9ca3af",
};

function getNodeStatusColor(status: string | undefined): string {
  if (!status) return STATUS_COLORS.pending ?? "#9ca3af";
  return STATUS_COLORS[status] ?? STATUS_COLORS.pending ?? "#9ca3af";
}

function statusBadgeVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "completed" || status === "success") return "default";
  if (status === "failed" || status === "error") return "destructive";
  return "secondary";
}

export default function LiveExecutionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const flowId = params.id as string;
  const executionId = searchParams.get("executionId");

  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [execution, setExecution] = useState<FlowExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const flowData = await api.getFlow(flowId);
        setFlow(flowData);

        if (executionId) {
          const execsResponse = await api.getFlowExecutions(flowId);
          const matched = execsResponse.data.find((e) => e.id === executionId);
          if (matched) {
            setExecution(matched);
          } else {
            setError("Execution not found");
          }
        }
      } catch {
        setError("Failed to load flow data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [flowId, executionId]);

  const nodeResults: Record<string, { status: string; output?: unknown }> = useMemo(() => {
    if (!execution?.nodeResults) return {};
    if (typeof execution.nodeResults === "object" && !Array.isArray(execution.nodeResults)) {
      return execution.nodeResults as Record<string, { status: string; output?: unknown }>;
    }
    return {};
  }, [execution]);

  const overlayedNodes: Node[] = useMemo(() => {
    if (!flow) return [];
    const baseNodes = (flow.nodesJson || []) as Node[];
    return baseNodes.map((node) => {
      const result = nodeResults[node.id];
      const status = result?.status;
      const borderColor = getNodeStatusColor(status);
      return {
        ...node,
        draggable: false,
        selectable: false,
        style: {
          ...(typeof node.style === "object" ? node.style : {}),
          border: `3px solid ${borderColor}`,
          borderRadius: 8,
          padding: 8,
          minWidth: 150,
          opacity: status === "pending" || !status ? 0.6 : 1,
        },
      };
    });
  }, [flow, nodeResults]);

  const edges: Edge[] = useMemo(() => {
    if (!flow) return [];
    return (flow.edgesJson || []) as Edge[];
  }, [flow]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center" role="status" aria-busy="true">
        <div className="space-y-3 text-center">
          <Skeleton className="mx-auto h-12 w-12 rounded-full" />
          <Skeleton className="mx-auto h-4 w-48" />
        </div>
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-destructive">{error || "Flow not found"}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">{flow.name}</h2>
          <Badge variant="secondary">Live View</Badge>
          {execution && (
            <Badge variant={statusBadgeVariant(execution.status)}>
              {execution.status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS.success }} />
              Success
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS.error }} />
              Error
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS.running }} />
              Running
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS.pending }} />
              Pending
            </span>
          </div>
        </div>
      </div>

      {/* Canvas + Variable Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Read-only canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={overlayedNodes}
            edges={edges}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Variable / Context Panel */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Execution Context</h3>

          {!execution && (
            <p className="text-xs text-muted-foreground">
              No execution selected. Pass an executionId query parameter to view execution details.
            </p>
          )}

          {execution && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Execution Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 p-3 pt-0 text-xs">
                  <p><span className="font-medium">ID:</span> {execution.id.slice(0, 12)}...</p>
                  <p><span className="font-medium">Status:</span> {execution.status}</p>
                  <p><span className="font-medium">Started:</span> {new Date(execution.startedAt).toLocaleString()}</p>
                  {execution.completedAt && (
                    <p><span className="font-medium">Completed:</span> {new Date(execution.completedAt).toLocaleString()}</p>
                  )}
                  {execution.error && (
                    <p className="text-destructive"><span className="font-medium">Error:</span> {execution.error}</p>
                  )}
                </CardContent>
              </Card>

              {execution.triggerData && (
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Trigger Data</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(execution.triggerData, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {Object.keys(nodeResults).length > 0 && (
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Node Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0">
                    {Object.entries(nodeResults).map(([nodeId, result]) => (
                      <div key={nodeId} className="rounded border border-border p-2">
                        <p className="text-xs font-medium">{nodeId.slice(0, 20)}</p>
                        <Badge variant={statusBadgeVariant(result.status)} className="mt-1 text-[10px]">
                          {result.status}
                        </Badge>
                        {result.output !== undefined && (
                          <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-1 text-[10px]">
                            {JSON.stringify(result.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
