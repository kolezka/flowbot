"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  api,
  type BotInstance,
  type PlatformConnectionType,
  getConnections,
} from "@/lib/api";
import {
  ExecutionToolbar,
  ExecutionPanel,
  applyExecutionStyles,
  useExecutionState,
} from "@/components/flow-execution-overlay";

// New extracted components
import { NodePalette } from "@/components/flow-editor/NodePalette";
import { FlowCanvas } from "@/components/flow-editor/FlowCanvas";
import { FlowContextMenu } from "@/components/flow-editor/FlowContextMenu";
import { PropertyPanel } from "@/components/flow-editor/PropertyPanel";
import { CanvasToolbar } from "@/components/flow-editor/CanvasToolbar";
import { CommandPalette } from "@/components/flow-editor/CommandPalette";
import { VersionHistory } from "@/components/flow-editor/VersionHistory";
import { ExecutionDebugger } from "@/components/flow-editor/ExecutionDebugger";

// New hooks and utilities
import { useAutoSave } from "@/lib/flow-editor/use-auto-save";
import { useCommandPalette } from "@/lib/flow-editor/use-command-palette";
import { getAvailableVariables } from "@/lib/flow-editor/variable-registry";
import { createFlowStore } from "@/lib/flow-editor/flow-store";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Inner component — must be inside ReactFlowProvider
// ---------------------------------------------------------------------------

function FlowEditorInner() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  // ── Zustand store scoped to this component instance ─────────────────────
  const storeRef = useRef<ReturnType<typeof createFlowStore>>(undefined);
  if (!storeRef.current) {
    storeRef.current = createFlowStore();
  }
  const useFlowStore = storeRef.current;

  // ── ReactFlow instance ───────────────────────────────────────────────────
  const reactFlowInstance = useReactFlow();

  // ── Core flow state ─────────────────────────────────────────────────────
  const [flowName, setFlowName] = useState("");
  const [flowStatus, setFlowStatus] = useState("draft");
  const [flowVersion, setFlowVersion] = useState(1);
  const [loaded, setLoaded] = useState(false);

  // ── Store-backed state ───────────────────────────────────────────────────
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setNodes = useFlowStore((s) => s.setNodes);
  const setEdges = useFlowStore((s) => s.setEdges);
  const onNodesChange = useFlowStore((s) => s.applyNodeChanges);
  const onEdgesChange = useFlowStore((s) => s.applyEdgeChanges);
  const selectedNode = useFlowStore((s) => s.selectedNode);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const addEdgeAction = useFlowStore((s) => s.addEdge);
  const addNode = useFlowStore((s) => s.addNode);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  // ── Panel visibility ────────────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);

  // ── Platform & transport config ─────────────────────────────────────────
  const [botInstances, setBotInstances] = useState<BotInstance[]>([]);
  const [mtprotoConnections, setMtprotoConnections] = useState<
    PlatformConnectionType[]
  >([]);
  const [transportConfig, setTransportConfig] = useState<{
    transport: string;
    botInstanceId?: string;
    discordBotInstanceId?: string;
    platformConnectionId?: string;
  }>({ transport: "auto" });
  const [flowPlatform, setFlowPlatform] = useState<
    "telegram" | "discord" | "cross-platform"
  >("telegram");

  // ── Execution overlay state ─────────────────────────────────────────────
  const { executionState, setExecutionState } = useExecutionState();

  // ── Command palette ─────────────────────────────────────────────────────
  const cmdPalette = useCommandPalette();

  // ── Auto-save ───────────────────────────────────────────────────────────
  const handleAutoSave = useCallback(
    async (data: { nodesJson: unknown; edgesJson: unknown }) => {
      await api.saveFlowDraft(flowId, data);
    },
    [flowId],
  );

  const { saveState, lastSaved, saveNow } = useAutoSave({
    flowId,
    nodesJson: nodes,
    edgesJson: edges,
    onSave: handleAutoSave,
  });

  // ── Available variables for PropertyPanel ───────────────────────────────
  const availableVariables = useMemo(() => {
    if (!selectedNode) return [];
    return [...getAvailableVariables(selectedNode.id, nodes, edges)];
  }, [selectedNode, nodes, edges]);

  // ── Connections for PropertyPanel ───────────────────────────────────────
  const connectionsList = useMemo(
    () =>
      mtprotoConnections.map((c) => ({
        id: c.id,
        name: c.name + (c.metadata?.phone ? ` (${String(c.metadata.phone)})` : ""),
        status: c.status,
      })),
    [mtprotoConnections],
  );

  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | undefined
  >(undefined);

  // Keep selectedConnectionId in sync with transport config
  useEffect(() => {
    setSelectedConnectionId(transportConfig.platformConnectionId);
  }, [transportConfig.platformConnectionId]);

  const handleConnectionChange = useCallback(
    (connectionId: string) => {
      setSelectedConnectionId(connectionId);
      setTransportConfig((prev) => ({
        ...prev,
        platformConnectionId: connectionId || undefined,
      }));
    },
    [],
  );

  // ── Fetch bot instances & connections on mount ──────────────────────────
  useEffect(() => {
    api.getBotInstances().then(setBotInstances).catch(() => {});
    getConnections({ limit: 100 })
      .then((res) => {
        const active = res.data.filter(
          (c) => c.connectionType === "mtproto" && c.status === "active",
        );
        setMtprotoConnections(active);
      })
      .catch(() => {});
  }, []);

  // ── Load flow data ──────────────────────────────────────────────────────
  useEffect(() => {
    api
      .getFlow(flowId)
      .then((flow) => {
        setFlowName(flow.name);
        setFlowStatus(flow.status);
        setFlowVersion(flow.version);
        const loadedNodes = (flow.nodesJson || []) as Node[];
        const loadedEdges = (flow.edgesJson || []) as Edge[];
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setTransportConfig(
          flow.transportConfig ?? { transport: "auto" },
        );
        if (flow.platform === "discord") setFlowPlatform("discord");
        else if (flow.platform === "cross-platform")
          setFlowPlatform("cross-platform");
        else setFlowPlatform("telegram");
        setLoaded(true);
      })
      .catch(() => router.push("/dashboard/flows"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]);

  // ── Draft restore prompt ────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    api
      .getFlowDraft(flowId)
      .then((draft) => {
        if (!draft) return;
        const shouldRestore = window.confirm(
          "An unsaved draft was found. Would you like to restore it?",
        );
        if (shouldRestore) {
          setNodes(draft.nodesJson as Node[]);
          setEdges(draft.edgesJson as Edge[]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, flowId]);

  // ── Beforeunload warning for unsaved changes ────────────────────────────
  useEffect(() => {
    if (saveState !== "unsaved") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  // ── Edge connection handler ─────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => addEdgeAction(connection),
    [addEdgeAction],
  );

  // ── Node selection ──────────────────────────────────────────────────────
  const handleNodeSelect = useCallback(
    (node: Node | null) => setSelectedNode(node),
    [setSelectedNode],
  );

  // ── Node data change (from PropertyPanel) ───────────────────────────────
  const handleNodeDataChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      updateNodeData(nodeId, key, value);
    },
    [updateNodeData],
  );

  // ── Drop handler (add node from palette or command palette) ─────────────
  const handleDrop = useCallback(
    (type: string, position: { x: number; y: number }) => {
      addNode(type, position);
    },
    [addNode],
  );

  // ── Add node from command palette (center of viewport) ──────────────────
  const handleAddNode = useCallback(
    (type: string) => {
      addNode(type, { x: 250, y: 250 });
    },
    [addNode],
  );

  // ── Save handler ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    await api.updateFlow(flowId, {
      name: flowName,
      nodesJson: nodes,
      edgesJson: edges,
      transportConfig,
      platform: flowPlatform,
    });
  }, [flowId, flowName, nodes, edges, transportConfig, flowPlatform]);

  // ── Publish (activate) ──────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    try {
      await handleSave();
      const result = await api.activateFlow(flowId);
      setFlowStatus(result.status);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Activation failed";
      alert(msg);
    }
  }, [flowId, handleSave]);

  // ── Validate ────────────────────────────────────────────────────────────
  const handleValidate = useCallback(async () => {
    try {
      const result = await api.validateFlow(flowId);
      if (result.valid) {
        alert("Flow is valid!");
      } else {
        alert(`Validation errors:\n${result.errors.join("\n")}`);
      }
    } catch {
      alert("Validation failed.");
    }
  }, [flowId]);

  // ── Test run ────────────────────────────────────────────────────────────
  const handleTestRun = useCallback(() => {
    // Delegate to ExecutionToolbar — it handles the test run flow.
    // For now, we open the debugger if an execution is available.
    setShowDebugger(true);
  }, []);

  // ── Version restore ─────────────────────────────────────────────────────
  const handleRestore = useCallback(
    async (version: number) => {
      try {
        const versions = await api.getFlowVersions(flowId);
        const target = versions.find((v) => v.version === version);
        if (!target) return;
        const restored = await api.restoreFlowVersion(flowId, target.id);
        setNodes((restored.nodesJson || []) as Node[]);
        setEdges((restored.edgesJson || []) as Edge[]);
        setFlowVersion(restored.version);
        setShowHistory(false);
      } catch {
        alert("Failed to restore version.");
      }
    },
    [flowId, setNodes, setEdges],
  );

  // ── Command palette action handler ──────────────────────────────────────
  const handleCommandAction = useCallback(
    (action: string) => {
      switch (action) {
        case "save":
          saveNow();
          break;
        case "test-run":
          handleTestRun();
          break;
        case "validate":
          handleValidate();
          break;
        case "publish":
          handlePublish();
          break;
        default:
          break;
      }
    },
    [saveNow, handleTestRun, handleValidate, handlePublish],
  );

  // ── Apply execution styles to nodes/edges ───────────────────────────────
  const { styledNodes, styledEdges } = useMemo(() => {
    if (executionState.execution) {
      return applyExecutionStyles(nodes, edges, executionState);
    }
    return { styledNodes: nodes, styledEdges: edges };
  }, [nodes, edges, executionState]);

  // ── Apply disabled node visual treatment ────────────────────────────────
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
    );
  }, [styledNodes]);

  // ── Loading state ───────────────────────────────────────────────────────
  if (!loaded) return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-10 w-10 rounded-full" />
        <Skeleton className="mx-auto h-4 w-36" />
        <Skeleton className="mx-auto h-3 w-24" />
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <CanvasToolbar
        flowName={flowName}
        onNameChange={setFlowName}
        version={flowVersion}
        saveState={saveState}
        lastSaved={lastSaved}
        onSaveDraft={saveNow}
        onPublish={handlePublish}
        onTestRun={handleTestRun}
        onValidate={handleValidate}
        onOpenHistory={() => setShowHistory(true)}
        onOpenCommandPalette={() => cmdPalette.setOpen(true)}
        onBack={() => router.push("/dashboard/flows")}
      />

      {/* Main three-pane layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Node Palette */}
        <NodePalette onDragStart={() => {}} />

        {/* Center: Flow Canvas with Context Menu */}
        <FlowContextMenu
          useStore={useFlowStore}
          onFitView={() => reactFlowInstance?.fitView()}
          onEditNode={(nodeId) => {
            const node = useFlowStore.getState().nodes.find((n: Node) => n.id === nodeId);
            if (node) setSelectedNode(node);
          }}
          screenToFlowPosition={(pos) =>
            reactFlowInstance?.screenToFlowPosition(pos) ?? pos
          }
        >
          <FlowCanvas
            nodes={disabledStyledNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeSelect={handleNodeSelect}
            onDrop={handleDrop}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              useFlowStore.getState().openNodeMenu(node, { x: e.clientX, y: e.clientY });
            }}
            onEdgeContextMenu={(e, edge) => {
              e.preventDefault();
              useFlowStore.getState().openEdgeMenu(edge, { x: e.clientX, y: e.clientY });
            }}
            onPaneContextMenu={(e) => {
              e.preventDefault();
              useFlowStore.getState().openCanvasMenu({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
            }}
          />
        </FlowContextMenu>

        {/* Right: Property Panel or Version History */}
        {showHistory ? (
          <VersionHistory
            flowId={flowId}
            currentVersion={flowVersion}
            open
            onClose={() => setShowHistory(false)}
            onRestore={handleRestore}
          />
        ) : selectedNode ? (
          <PropertyPanel
            node={{
              id: selectedNode.id,
              type: String(selectedNode.data?.nodeType ?? selectedNode.type ?? ""),
              data: (selectedNode.data?.config as Record<string, unknown>) ?? {},
            }}
            onClose={() => setSelectedNode(null)}
            onChange={handleNodeDataChange}
            connections={connectionsList}
            selectedConnectionId={selectedConnectionId}
            onConnectionChange={handleConnectionChange}
            availableVariables={availableVariables}
          />
        ) : null}
      </div>

      {/* Bottom: Execution Panel (existing overlay) */}
      <ExecutionPanel executionState={executionState} nodes={nodes} />

      {/* Bottom: Execution Debugger (new) */}
      {showDebugger && (
        <ExecutionDebugger
          flowId={flowId}
          executionId={executionId}
          onClose={() => setShowDebugger(false)}
        />
      )}

      {/* Floating: Execution Toolbar (test run controls) */}
      <div className="absolute top-14 right-4 z-10">
        <ExecutionToolbar
          flowId={flowId}
          nodes={nodes}
          edges={edges}
          executionState={executionState}
          onExecutionStateChange={setExecutionState}
        />
      </div>

      {/* Floating: Command Palette */}
      <CommandPalette
        open={cmdPalette.open}
        onClose={cmdPalette.close}
        onAddNode={handleAddNode}
        onAction={handleCommandAction}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper — provides ReactFlowProvider context
// ---------------------------------------------------------------------------

export default function FlowEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
