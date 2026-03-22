"use client";

import { useMemo, useCallback } from "react";
import { X, CheckCircle, AlertTriangle } from "lucide-react";
import { NODE_TYPES } from "@flowbot/flow-shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getNodeSchema } from "@flowbot/flow-shared";
import { getOrDefaultPanel } from "./property-panels/registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PropertyPanelProps {
  node: { id: string; type: string; data: Record<string, unknown> } | null;
  onClose: () => void;
  onChange: (nodeId: string, key: string, value: unknown) => void;
  connections: Array<{ id: string; name: string; status: string }>;
  selectedConnectionId?: string;
  onConnectionChange: (connectionId: string) => void;
  availableVariables: Array<{ name: string; type: string; source: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  trigger: "Trigger",
  condition: "Condition",
  action: "Action",
  advanced: "Advanced",
  annotation: "Annotation",
};

const CATEGORY_COLORS: Record<string, string> = {
  trigger: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  condition: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  action: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  advanced: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  annotation: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  active: "bg-green-500",
  connected: "bg-green-500",
  inactive: "bg-gray-400",
  error: "bg-red-500",
  pending: "bg-yellow-500",
};

function getStatusDotColor(status: string): string {
  return STATUS_DOT_COLORS[status] ?? "bg-gray-400";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] ?? category;
  const colorClass = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${colorClass}`}
    >
      {label}
    </span>
  );
}

interface ValidationBadgeProps {
  isValid: boolean;
}

function ValidationBadge({ isValid }: ValidationBadgeProps) {
  if (isValid) {
    return (
      <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
        <CheckCircle className="h-3 w-3" aria-hidden="true" />
        Valid
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Issues
    </span>
  );
}

interface ConnectionSelectorProps {
  connections: Array<{ id: string; name: string; status: string }>;
  selectedConnectionId?: string;
  onConnectionChange: (connectionId: string) => void;
}

function ConnectionSelector({
  connections,
  selectedConnectionId,
  onConnectionChange,
}: ConnectionSelectorProps) {
  if (connections.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No connections available.</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Connection
      </span>
      <Select
        value={selectedConnectionId ?? ""}
        onValueChange={onConnectionChange}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Select connection..." />
        </SelectTrigger>
        <SelectContent>
          {connections.map((conn) => (
            <SelectItem key={conn.id} value={conn.id}>
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${getStatusDotColor(conn.status)}`}
                  aria-hidden="true"
                />
                {conn.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validity detection from rendered form
// ---------------------------------------------------------------------------

/**
 * Determine if the current node config is "valid" by checking required fields
 * from the schema. We do a lightweight required-field check here; NodeConfigForm
 * itself does deeper per-field validation internally.
 */
function useNodeValidity(
  nodeType: string,
  nodeData: Record<string, unknown>,
): boolean {
  return useMemo(() => {
    const schema = getNodeSchema(nodeType);
    if (!schema) return true; // No schema = no required fields = valid
    return schema.fields
      .filter((f) => f.required)
      .every((f) => {
        const val = nodeData[f.key];
        return val !== undefined && val !== null && String(val).trim() !== "";
      });
  }, [nodeType, nodeData]);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PropertyPanel({
  node,
  onClose,
  onChange,
  connections,
  selectedConnectionId,
  onConnectionChange,
  availableVariables,
}: PropertyPanelProps) {
  const nodeTypeDef = useMemo(
    () => (node ? NODE_TYPES.find((n) => n.type === node.type) : undefined),
    [node],
  );

  const isValid = useNodeValidity(
    node?.type ?? "",
    node?.data ?? {},
  );

  const handleConfigChange = useCallback(
    (updatedConfig: Record<string, unknown>) => {
      if (!node) return;
      for (const [key, value] of Object.entries(updatedConfig)) {
        onChange(node.id, key, value);
      }
    },
    [node, onChange],
  );

  // Resolve which panel to render — custom or schema-backed default.
  // Memoized so that the default panel component identity is stable across
  // renders (prevents React from resetting form state on every render).
  const PanelComponent = useMemo(
    () => (node ? getOrDefaultPanel(node.type) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node?.type],
  );

  if (!node || !PanelComponent) {
    return null;
  }

  const label = nodeTypeDef?.label ?? node.type;
  const category = nodeTypeDef?.category ?? "action";

  // Build upstream nodes shape expected by PanelProps from availableVariables
  const upstreamNodes = availableVariables
    .filter((v) => v.source === "node")
    .map((v) => {
      const parts = v.name.split(".");
      const id = parts[1] ?? v.name;
      return { id, type: "unknown", label: id };
    });

  return (
    <aside
      className="flex h-full w-[280px] shrink-0 flex-col border-l border-border bg-background"
      aria-label="Node properties"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-2 border-b border-border px-3.5 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold leading-tight">
              {label}
            </span>
            <ValidationBadge isValid={isValid} />
          </div>
          <CategoryBadge category={category} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close properties panel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Form content — scrollable                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5">
        <PanelComponent
          nodeId={node.id}
          nodeType={node.type}
          config={node.data}
          onChange={handleConfigChange}
          flowId=""
          upstreamNodes={upstreamNodes}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer — connection selector                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-t border-border px-3.5 py-3">
        <ConnectionSelector
          connections={connections}
          selectedConnectionId={selectedConnectionId}
          onConnectionChange={onConnectionChange}
        />
      </div>
    </aside>
  );
}
