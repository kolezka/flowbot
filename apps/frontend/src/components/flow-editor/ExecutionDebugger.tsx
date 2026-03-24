"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket, useSocketEvent } from "@/lib/websocket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 600;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExecutionUpdate {
  executionId: string;
  nodeId: string;
  status: "running" | "completed" | "failed" | "skipped";
  variables?: Record<string, unknown>;
  output?: unknown;
  duration?: number;
  error?: string;
}

type StepStatus = "completed" | "running" | "pending" | "failed";

interface StepEntry {
  nodeId: string;
  nodeName: string;
  status: StepStatus;
  description: string;
  duration?: number;
  variables?: Record<string, unknown>;
}

type ActiveTab = "steps" | "variables" | "output";

interface ExecutionDebuggerProps {
  flowId: string;
  executionId: string | null;
  onClose: () => void;
  onNodeHighlight?: (nodeId: string | null) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusIcon(status: StepStatus): string {
  switch (status) {
    case "completed":
      return "✓";
    case "running":
      return "⟳";
    case "failed":
      return "✗";
    case "pending":
      return "○";
  }
}

function statusColor(status: StepStatus): string {
  switch (status) {
    case "completed":
      return "text-green-500";
    case "running":
      return "text-blue-500 animate-spin inline-block";
    case "failed":
      return "text-red-500";
    case "pending":
      return "text-muted-foreground";
  }
}

function statusBg(status: StepStatus): string {
  switch (status) {
    case "completed":
      return "hover:bg-green-50 dark:hover:bg-green-950/30";
    case "running":
      return "bg-blue-50 dark:bg-blue-950/20";
    case "failed":
      return "hover:bg-red-50 dark:hover:bg-red-950/30";
    case "pending":
      return "hover:bg-muted/50";
  }
}

function variableSourceColor(key: string): string {
  if (key.startsWith("trigger.")) return "text-purple-600 dark:text-purple-400";
  if (key.startsWith("condition.")) return "text-amber-600 dark:text-amber-400";
  if (key.startsWith("action.")) return "text-blue-600 dark:text-blue-400";
  return "text-foreground";
}

function variableValueColor(value: unknown): string {
  if (typeof value === "boolean") {
    return value
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
  }
  if (typeof value === "number") return "text-blue-600 dark:text-blue-400";
  return "text-foreground";
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function useElapsedTimer(running: boolean): string {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        setElapsed(Date.now() - (startRef.current ?? Date.now()));
      }, 100);
      return () => clearInterval(id);
    } else {
      startRef.current = null;
      return undefined;
    }
  }, [running]);

  if (!running && elapsed === 0) return "";
  const s = Math.floor(elapsed / 1000);
  const ms = elapsed % 1000;
  return s > 0 ? `${s}.${String(Math.floor(ms / 100))}s` : `${ms}ms`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExecutionDebugger({
  flowId,
  executionId,
  onClose,
  onNodeHighlight,
}: ExecutionDebuggerProps) {
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [activeTab, setActiveTab] = useState<ActiveTab>("steps");
  const [debugStatus, setDebugStatus] = useState<
    "idle" | "running" | "completed" | "failed"
  >("idle");
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [outputLog, setOutputLog] = useState<unknown[]>([]);

  const { connected, joinRoom, leaveRoom } = useWebSocket();
  const activeStepRef = useRef<HTMLButtonElement>(null);

  const isRunning = debugStatus === "running";
  const elapsedTime = useElapsedTimer(isRunning);

  // Auto-scroll to the active (running) step when steps update
  const activeStepIndex = steps.findIndex((s) => s.status === "running");
  useEffect(() => {
    activeStepRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeStepIndex]);

  // ── Merge an execution update into the step list ──────────────────────────
  const applyUpdate = useCallback((update: ExecutionUpdate) => {
    setSteps((prev) => {
      const existing = prev.findIndex((s) => s.nodeId === update.nodeId);
      const entry: StepEntry = {
        nodeId: update.nodeId,
        nodeName: update.nodeId.slice(0, 14),
        status: update.status === "skipped" ? "completed" : update.status,
        description:
          update.status === "running"
            ? "executing..."
            : update.status === "completed"
              ? update.output !== undefined
                ? "completed"
                : "done"
              : update.status === "failed"
                ? (update.error ?? "failed")
                : "skipped",
        duration: update.duration,
        variables: update.variables,
      };

      if (existing === -1) {
        return [...prev, entry];
      }
      return prev.map((s, i) => (i === existing ? entry : s));
    });

    if (update.output !== undefined) {
      setOutputLog((prev) => [
        ...prev,
        { nodeId: update.nodeId, output: update.output },
      ]);
    }

    if (update.status === "completed" || update.status === "failed") {
      setDebugStatus((prev) =>
        prev === "running" ? (update.status as "completed" | "failed") : prev,
      );
    }
  }, []);

  // ── WebSocket subscription ────────────────────────────────────────────────
  useSocketEvent<ExecutionUpdate>("flow:execution:update", (data) => {
    if (data.executionId === executionId) {
      applyUpdate(data);
    }
  });

  useEffect(() => {
    if (!executionId || !connected) return;
    const room = `flow:execution:${executionId}`;
    joinRoom(room);
    return () => leaveRoom(room);
  }, [executionId, connected, joinRoom, leaveRoom]);

  // ── Polling fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!executionId || !polling || connected) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/flows/executions/${executionId}`,
        );
        const data = (await res.json()) as {
          status?: string;
          nodeResults?: Record<
            string,
            {
              status: string;
              output?: unknown;
              startedAt?: string;
              completedAt?: string;
              error?: string;
            }
          >;
        };

        if (data.nodeResults) {
          for (const [nodeId, result] of Object.entries(data.nodeResults)) {
            const duration =
              result.completedAt && result.startedAt
                ? new Date(result.completedAt).getTime() -
                  new Date(result.startedAt).getTime()
                : undefined;
            applyUpdate({
              executionId,
              nodeId,
              status: result.status as ExecutionUpdate["status"],
              output: result.output,
              duration,
              error: result.error,
            });
          }
        }

        if (data.status === "completed" || data.status === "failed") {
          setDebugStatus(data.status as "completed" | "failed");
          setPolling(false);
        }
      } catch {
        // Ignore transient polling errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [executionId, polling, connected, applyUpdate]);

  // ── Start test execution ──────────────────────────────────────────────────
  const startDebugExecution = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/flows/${flowId}/test-execute`, {
        method: "POST",
        body: JSON.stringify({ triggerData: {} }),
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { executionId?: string };
      if (data.executionId) {
        setDebugStatus("running");
        setPolling(true);
        setSteps([]);
        setOutputLog([]);
        setSelectedStepId(null);
      }
    } catch {
      // Handle gracefully — user can retry
    }
  }, [flowId]);

  // ── Resize handle drag ────────────────────────────────────────────────────
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startH: panelHeight };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - ev.clientY;
        const newH = Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, dragRef.current.startH + delta),
        );
        setPanelHeight(newH);
      };

      const onMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelHeight],
  );

  // ── Selected step variables ───────────────────────────────────────────────
  const selectedStep = steps.find((s) => s.nodeId === selectedStepId);
  const inspectedVariables: Record<string, unknown> =
    selectedStep?.variables ?? {};

  // ── Content height (panel minus toolbar/tabs bar) ─────────────────────────
  const contentHeight = panelHeight - 72; // 3px handle + 37px toolbar + 32px tabs

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t border-border bg-card shadow-lg z-50 flex flex-col"
      style={{ height: panelHeight }}
    >
      {/* ── Resize handle ── */}
      <div
        className="h-[3px] w-full cursor-row-resize bg-border hover:bg-primary/40 transition-colors flex-shrink-0"
        onMouseDown={onResizeMouseDown}
      />

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Execution</span>

          {/* Status dot */}
          {isRunning ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          ) : debugStatus === "completed" ? (
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
          ) : debugStatus === "failed" ? (
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/40" />
          )}

          {/* Elapsed timer */}
          {elapsedTime && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {elapsedTime}
            </span>
          )}

          {/* WS indicator */}
          <span
            className={`text-[9px] px-1 rounded ${connected ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}
          >
            {connected ? "live" : "polling"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab selector */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["steps", "variables", "output"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-0.5 capitalize ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {!executionId && (
            <button
              onClick={startDebugExecution}
              className="rounded-md bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
            >
              Run
            </button>
          )}

          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close debugger"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{ height: contentHeight }}
      >
        {activeTab === "steps" && (
          <>
            {/* Left: Step timeline */}
            <div className="w-1/2 overflow-y-auto border-r border-border">
              {steps.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">
                  {isRunning
                    ? "Waiting for step results…"
                    : "No results yet. Run an execution to see step-by-step results."}
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {steps.map((step, idx) => (
                    <button
                      key={step.nodeId}
                      ref={idx === activeStepIndex ? activeStepRef : undefined}
                      onClick={() => {
                        setSelectedStepId(step.nodeId);
                        onNodeHighlight?.(step.nodeId);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 transition-colors ${statusBg(step.status)} ${selectedStepId === step.nodeId ? "ring-1 ring-inset ring-primary" : ""}`}
                    >
                      <span
                        className={`mt-0.5 text-sm leading-none ${statusColor(step.status)}`}
                      >
                        {statusIcon(step.status)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-foreground">
                          {step.nodeName}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {step.description}
                        </div>
                      </div>
                      {step.duration !== undefined && (
                        <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                          {step.duration}ms
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Variable inspector */}
            <div className="w-1/2 overflow-y-auto">
              {selectedStep ? (
                <div>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                    Variables at{" "}
                    <span className="font-mono text-foreground">
                      {selectedStep.nodeName}
                    </span>
                  </div>
                  {Object.keys(inspectedVariables).length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      No variables captured at this step.
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="px-3 py-1 text-left text-[10px] font-medium text-muted-foreground">
                            Name
                          </th>
                          <th className="px-3 py-1 text-left text-[10px] font-medium text-muted-foreground">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {Object.entries(inspectedVariables).map(
                          ([key, value]) => (
                            <tr
                              key={key}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td
                                className={`px-3 py-1 font-mono ${variableSourceColor(key)}`}
                              >
                                {key}
                              </td>
                              <td
                                className={`px-3 py-1 font-mono max-w-[200px] truncate ${variableValueColor(value)}`}
                                title={formatValue(value)}
                              >
                                {formatValue(value)}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <p className="p-4 text-xs text-muted-foreground">
                  Click a step to inspect its variables.
                </p>
              )}
            </div>
          </>
        )}

        {activeTab === "variables" && (
          <div className="w-full overflow-y-auto p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-2 py-1 text-left text-[10px] font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="px-2 py-1 text-left text-[10px] font-medium text-muted-foreground">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {steps.flatMap((step) =>
                  Object.entries(step.variables ?? {}).map(([key, value]) => (
                    <tr
                      key={`${step.nodeId}:${key}`}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td
                        className={`px-2 py-1 font-mono ${variableSourceColor(key)}`}
                      >
                        {key}
                      </td>
                      <td
                        className={`px-2 py-1 font-mono max-w-[300px] truncate ${variableValueColor(value)}`}
                        title={formatValue(value)}
                      >
                        {formatValue(value)}
                      </td>
                    </tr>
                  )),
                )}
                {steps.every((s) => Object.keys(s.variables ?? {}).length === 0) && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-2 py-4 text-center text-muted-foreground"
                    >
                      No variables captured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "output" && (
          <div className="w-full overflow-y-auto p-3">
            {outputLog.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No output yet.
              </p>
            ) : (
              <div className="space-y-2">
                {outputLog.map((entry, i) => (
                  <div key={i} className="rounded border border-border bg-muted/30 px-2 py-1.5">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(entry, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
