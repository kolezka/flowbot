"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, type BotInstance } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Play, Square, BarChart3, History, Bot } from "lucide-react";
import { ExpressionBuilder, type ExpressionValue } from "@/components/expression-builder";
import Link from "next/link";
import {
  ExecutionToolbar,
  ExecutionPanel,
  applyExecutionStyles,
  useExecutionState,
} from "@/components/flow-execution-overlay";

const NODE_TYPES_CONFIG = [
  { type: "message_received", label: "Message Received", category: "trigger", color: "#22c55e" },
  { type: "user_joins", label: "User Joins", category: "trigger", color: "#22c55e" },
  { type: "schedule", label: "Schedule", category: "trigger", color: "#22c55e" },
  { type: "webhook", label: "Webhook", category: "trigger", color: "#22c55e" },
  { type: "keyword_match", label: "Keyword Match", category: "condition", color: "#eab308" },
  { type: "user_role", label: "User Role", category: "condition", color: "#eab308" },
  { type: "time_based", label: "Time Based", category: "condition", color: "#eab308" },
  { type: "send_message", label: "Send Message", category: "action", color: "#3b82f6" },
  { type: "forward_message", label: "Forward Message", category: "action", color: "#3b82f6" },
  { type: "ban_user", label: "Ban User", category: "action", color: "#ef4444" },
  { type: "mute_user", label: "Mute User", category: "action", color: "#ef4444" },
  { type: "api_call", label: "API Call", category: "action", color: "#3b82f6" },
  { type: "delay", label: "Delay", category: "action", color: "#8b5cf6" },
  { type: "bot_action", label: "Bot Action", category: "action", color: "#f97316" },
  { type: "parallel_branch", label: "Parallel Branch", category: "advanced", color: "#a855f7" },
  { type: "db_query", label: "Database Query", category: "advanced", color: "#a855f7" },
  { type: "loop", label: "Loop", category: "advanced", color: "#a855f7" },
  { type: "switch", label: "Switch/Router", category: "advanced", color: "#a855f7" },
  { type: "transform", label: "Transform", category: "advanced", color: "#a855f7" },
];

function NodePalette({ onDragStart }: { onDragStart: (type: string, label: string, category: string) => void }) {
  const categories = ["trigger", "condition", "action", "advanced"];

  return (
    <div className="w-56 border-r border-border bg-card p-3 overflow-y-auto">
      <h3 className="mb-3 text-sm font-semibold">Node Palette</h3>
      {categories.map((cat) => (
        <div key={cat} className="mb-4">
          <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">{cat}s</h4>
          <div className="space-y-1">
            {NODE_TYPES_CONFIG.filter((n) => n.category === cat).map((node) => (
              <div
                key={node.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/reactflow-type", node.type);
                  e.dataTransfer.setData("application/reactflow-label", node.label);
                  e.dataTransfer.setData("application/reactflow-category", node.category);
                  onDragStart(node.type, node.label, node.category);
                }}
                className="cursor-grab rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                style={{ borderLeftColor: node.color, borderLeftWidth: 3 }}
              >
                {node.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FlowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  const [flowName, setFlowName] = useState("");
  const [flowStatus, setFlowStatus] = useState("draft");
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [botInstances, setBotInstances] = useState<BotInstance[]>([]);

  // Execution visualization state
  const { executionState, setExecutionState } = useExecutionState();

  useEffect(() => {
    api.getBotInstances().then(setBotInstances).catch(() => {});
  }, []);

  useEffect(() => {
    api.getFlow(flowId).then((flow) => {
      setFlowName(flow.name);
      setFlowStatus(flow.status);
      const loadedNodes = (flow.nodesJson || []) as Node[];
      const loadedEdges = (flow.edgesJson || []) as Edge[];
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setLoaded(true);
    }).catch(() => router.push("/dashboard/flows"));
  }, [flowId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow-type");
      const label = e.dataTransfer.getData("application/reactflow-label");
      const category = e.dataTransfer.getData("application/reactflow-category");
      if (!type) return;

      const bounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
      if (!bounds) return;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: "default",
        position: {
          x: e.clientX - bounds.left - 75,
          y: e.clientY - bounds.top - 20,
        },
        data: {
          label,
          nodeType: type,
          category,
          config: {},
        },
        style: {
          border: `2px solid ${NODE_TYPES_CONFIG.find((n) => n.type === type)?.color ?? "#888"}`,
          borderRadius: 8,
          padding: 8,
          minWidth: 150,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateFlow(flowId, { nodesJson: nodes, edgesJson: edges });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    try {
      const result = await api.activateFlow(flowId);
      setFlowStatus(result.status);
    } catch (e: any) {
      alert(e.message || "Activation failed");
    }
  };

  const handleDeactivate = async () => {
    const result = await api.deactivateFlow(flowId);
    setFlowStatus(result.status);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const isConditionNode = selectedNode?.data?.category === "condition";
  const isBotActionNode = selectedNode?.data?.nodeType === "bot_action";

  const updateNodeConfig = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, unknown>), [key]: value } } }
            : n,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const handleExpressionChange = useCallback(
    (expression: ExpressionValue) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, unknown>), expression } } }
            : n,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Apply execution styles to nodes and edges for visualization
  const { styledNodes, styledEdges } = useMemo(() => {
    if (!executionState.execution) {
      return { styledNodes: nodes, styledEdges: edges };
    }
    return applyExecutionStyles(nodes, edges, executionState);
  }, [nodes, edges, executionState]);

  if (!loaded) return <div className="h-screen animate-pulse bg-muted" />;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">{flowName}</h2>
          <Badge variant={flowStatus === "active" ? "default" : "secondary"}>{flowStatus}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <ExecutionToolbar
            flowId={flowId}
            nodes={nodes}
            edges={edges}
            executionState={executionState}
            onExecutionStateChange={setExecutionState}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <Link href={`/dashboard/flows/${flowId}/analytics`}>
            <Button variant="ghost" size="sm"><BarChart3 className="mr-1 h-4 w-4" />Analytics</Button>
          </Link>
          <Link href={`/dashboard/flows/${flowId}/versions`}>
            <Button variant="ghost" size="sm"><History className="mr-1 h-4 w-4" />Versions</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />{saving ? "Saving..." : "Save"}
          </Button>
          {flowStatus !== "active" ? (
            <Button size="sm" onClick={handleActivate}><Play className="mr-1 h-4 w-4" />Activate</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleDeactivate}><Square className="mr-1 h-4 w-4" />Deactivate</Button>
          )}
        </div>
      </div>

      {/* Canvas + Panels */}
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex flex-1 min-h-0">
        <NodePalette onDragStart={() => {}} />
        <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        {/* Property panel for selected condition nodes */}
        {selectedNode && isConditionNode && (
          <div className="w-72 border-l border-border bg-card p-3 overflow-y-auto">
            <h3 className="mb-3 text-sm font-semibold">
              Condition: {String(selectedNode.data.label ?? "")}
            </h3>
            <ExpressionBuilder
              value={(selectedNode.data.config as Record<string, unknown>)?.expression as ExpressionValue | undefined}
              onChange={handleExpressionChange}
            />
          </div>
        )}
        {/* Property panel for bot_action nodes */}
        {selectedNode && isBotActionNode && (
          <div className="w-72 border-l border-border bg-card p-3 overflow-y-auto">
            <h3 className="mb-3 text-sm font-semibold flex items-center gap-1">
              <Bot className="h-4 w-4" />Bot Action
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bot Instance</label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={String((selectedNode.data.config as Record<string, unknown>)?.botInstanceId ?? "")}
                  onChange={(e) => updateNodeConfig("botInstanceId", e.target.value)}
                >
                  <option value="">Select a bot...</option>
                  {botInstances.filter((b) => b.isActive).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.botUsername ? ` (@${b.botUsername})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Action</label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={String((selectedNode.data.config as Record<string, unknown>)?.action ?? "")}
                  onChange={(e) => updateNodeConfig("action", e.target.value)}
                >
                  <option value="">Select action...</option>
                  <option value="sendMessage">Send Message</option>
                  <option value="setCommands">Set Commands</option>
                  <option value="sendBroadcast">Send Broadcast</option>
                  <option value="moderateUser">Moderate User</option>
                  <option value="crossPost">Cross Post</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Parameters (JSON)</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
                  rows={5}
                  placeholder='{"chatId": "123", "text": "Hello"}'
                  value={(() => {
                    const params = (selectedNode.data.config as Record<string, unknown>)?.params;
                    if (!params) return "";
                    if (typeof params === "string") return params;
                    return JSON.stringify(params, null, 2);
                  })()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    try {
                      const parsed = JSON.parse(raw);
                      updateNodeConfig("params", parsed);
                    } catch {
                      updateNodeConfig("params", raw);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Execution panel (bottom) */}
        <ExecutionPanel executionState={executionState} nodes={nodes} />
      </div>
    </div>
  );
}
