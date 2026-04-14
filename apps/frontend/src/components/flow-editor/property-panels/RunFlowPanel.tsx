"use client";

import { useState, useEffect } from "react";
import type { PanelProps } from "./registry";

const API_URL = "";

interface FlowSummary {
  id: string;
  name: string;
  status: string;
}

export function RunFlowPanel({ config, onChange }: PanelProps) {
  const [flows, setFlows] = useState<FlowSummary[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/flows?limit=100`)
      .then((res) => res.json())
      .then((data: { data: FlowSummary[] }) => {
        setFlows(data.data);
      })
      .catch(() => {});
  }, []);

  const flowId = String(config.flowId ?? "");
  const waitForResult = Boolean(config.waitForResult ?? true);
  const inputVariables = (config.inputVariables ?? {}) as Record<string, string>;
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");

  const addVariable = () => {
    if (!newVarKey.trim()) return;
    onChange({
      ...config,
      inputVariables: { ...inputVariables, [newVarKey]: newVarValue },
    });
    setNewVarKey("");
    setNewVarValue("");
  };

  const removeVariable = (key: string) => {
    const updated = { ...inputVariables };
    delete updated[key];
    onChange({ ...config, inputVariables: updated });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Target Flow</label>
        <select
          value={flowId}
          onChange={(e) => onChange({ ...config, flowId: e.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Select a flow...</option>
          {flows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.status})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={waitForResult}
          onChange={(e) => onChange({ ...config, waitForResult: e.target.checked })}
          id="waitForResult"
          className="rounded border-border"
        />
        <label htmlFor="waitForResult" className="text-xs text-muted-foreground">
          Wait for result (subflow mode)
        </label>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Input Variables</label>
        <div className="mt-1 space-y-1">
          {Object.entries(inputVariables).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="text-xs font-mono bg-muted px-1 rounded">{key}</span>
              <span className="text-xs text-muted-foreground">=</span>
              <span className="text-xs font-mono flex-1 truncate">{val}</span>
              <button
                onClick={() => removeVariable(key)}
                className="text-xs text-destructive hover:underline"
              >
                x
              </button>
            </div>
          ))}
          <div className="flex gap-1 mt-2">
            <input
              type="text"
              value={newVarKey}
              onChange={(e) => setNewVarKey(e.target.value)}
              placeholder="key"
              className="w-24 rounded-md border border-border bg-background px-1.5 py-1 text-xs"
            />
            <input
              type="text"
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
              placeholder="value or {{var}}"
              className="flex-1 rounded-md border border-border bg-background px-1.5 py-1 text-xs"
            />
            <button
              onClick={addVariable}
              className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
