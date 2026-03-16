"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface NodeProgress {
  nodeId: string;
  status: "success" | "error" | "skipped";
  output?: unknown;
  duration?: number;
}

interface ExecutionDebuggerProps {
  flowId: string;
  executionId: string | null;
  onClose: () => void;
  onNodeHighlight?: (nodeId: string | null) => void;
}

export function ExecutionDebugger({
  flowId,
  executionId,
  onClose,
  onNodeHighlight,
}: ExecutionDebuggerProps) {
  const [debugStatus, setDebugStatus] = useState<
    "running" | "paused" | "completed" | "cancelled"
  >("running");
  const [nodeProgress, setNodeProgress] = useState<NodeProgress[]>([]);
  const [variables, setVariables] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<
    "variables" | "context" | "results"
  >("results");
  const [polling, setPolling] = useState(true);

  // Poll execution status
  useEffect(() => {
    if (!executionId || !polling) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/flows/executions/${executionId}`);
        const data = await res.json();

        if (data.nodeResults) {
          const results = Object.entries(
            data.nodeResults as Record<string, any>,
          ).map(([nodeId, result]: [string, any]) => ({
            nodeId,
            status: result.status,
            output: result.output,
            duration: result.completedAt && result.startedAt
              ? new Date(result.completedAt).getTime() -
                new Date(result.startedAt).getTime()
              : undefined,
          }));
          setNodeProgress(results);
        }

        if (
          data.status === "completed" ||
          data.status === "failed"
        ) {
          setDebugStatus("completed");
          setPolling(false);
        }
      } catch {
        // Ignore polling errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [executionId, polling]);

  const startDebugExecution = useCallback(async () => {
    try {
      const res = await api.post(`/api/flows/${flowId}/test-execute`, {
        body: JSON.stringify({ triggerData: {} }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.executionId) {
        setDebugStatus("running");
        setPolling(true);
        setNodeProgress([]);
      }
    } catch {
      // Handle error
    }
  }, [flowId]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t border-border bg-card shadow-lg z-50"
      style={{ height: "280px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold">Execution Debugger</h3>
        <div className="flex gap-2">
          {!executionId && (
            <button
              onClick={startDebugExecution}
              className="rounded-md bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
            >
              Run
            </button>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              debugStatus === "running"
                ? "bg-blue-100 text-blue-700"
                : debugStatus === "paused"
                  ? "bg-yellow-100 text-yellow-700"
                  : debugStatus === "completed"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
            }`}
          >
            {debugStatus}
          </span>
          <button
            onClick={onClose}
            className="rounded-md bg-muted px-2 py-1 text-xs hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["results", "variables", "context"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs capitalize ${
              activeTab === tab
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-y-auto p-3" style={{ height: "160px" }}>
        {activeTab === "results" && (
          <div className="space-y-1">
            {nodeProgress.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No results yet. Run an execution to see node results.
              </p>
            )}
            {nodeProgress.map((np) => (
              <button
                key={np.nodeId}
                onClick={() => onNodeHighlight?.(np.nodeId)}
                className={`w-full text-left rounded px-2 py-1 text-xs ${
                  np.status === "success"
                    ? "bg-green-50 dark:bg-green-950"
                    : np.status === "error"
                      ? "bg-red-50 dark:bg-red-950"
                      : "bg-muted"
                }`}
              >
                <span className="font-mono">{np.nodeId.slice(0, 12)}</span>
                <span className="ml-2 text-muted-foreground">
                  {np.status}
                </span>
                {np.duration !== undefined && (
                  <span className="ml-2 text-muted-foreground">
                    {np.duration}ms
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {activeTab === "variables" && (
          <pre className="text-xs font-mono text-muted-foreground">
            {JSON.stringify(variables, null, 2) || "{}"}
          </pre>
        )}
        {activeTab === "context" && (
          <p className="text-xs text-muted-foreground">
            Context values will be shown here during debug execution.
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-0.5 border-t border-border px-3 py-1 overflow-x-auto">
        {nodeProgress.map((np) => (
          <div
            key={np.nodeId}
            onClick={() => onNodeHighlight?.(np.nodeId)}
            className={`h-3 min-w-[20px] cursor-pointer rounded-sm ${
              np.status === "success"
                ? "bg-green-400"
                : np.status === "error"
                  ? "bg-red-400"
                  : "bg-gray-300"
            }`}
            title={`${np.nodeId}: ${np.status}`}
            style={{
              flex: `${Math.max(np.duration ?? 50, 20)} 0 auto`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
