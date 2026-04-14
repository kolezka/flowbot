"use client";

import { useState, useEffect } from "react";
import { VariableAutocomplete, buildVariableList } from "../VariableAutocomplete";
import type { PanelProps } from "./registry";

const API_URL = "";

export function ContextPanel({
  nodeType,
  config,
  onChange,
  upstreamNodes,
}: PanelProps) {
  const [contextKeys, setContextKeys] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/flows/context-keys`)
      .then((res) => res.json())
      .then((data: Array<{ key: string; count: number }>) => {
        setContextKeys(data.map((d) => d.key));
      })
      .catch(() => {
        // Ignore — autocomplete just won't show context keys
      });
  }, []);

  const variables = buildVariableList(undefined, upstreamNodes, contextKeys);

  const key = String(config.key ?? "");
  const value = String(config.value ?? "");
  const operator = String(config.operator ?? "equals");
  const conditionValue = String(config.value ?? "");
  const defaultValue = String(config.defaultValue ?? "");

  if (nodeType === "get_context") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Key</label>
          <input
            type="text"
            value={key}
            onChange={(e) => onChange({ ...config, key: e.target.value })}
            placeholder="e.g. language, onboarding_step"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            list="context-keys"
          />
          <datalist id="context-keys">
            {contextKeys.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Default Value</label>
          <input
            type="text"
            value={defaultValue}
            onChange={(e) => onChange({ ...config, defaultValue: e.target.value })}
            placeholder="Value if key not found"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>
    );
  }

  if (nodeType === "set_context") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Key</label>
          <input
            type="text"
            value={key}
            onChange={(e) => onChange({ ...config, key: e.target.value })}
            placeholder="e.g. language"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <VariableAutocomplete
          label="Value"
          value={value}
          onChange={(v) => onChange({ ...config, value: v })}
          variables={variables}
          placeholder="Static value or {{trigger.text}}"
        />
      </div>
    );
  }

  if (nodeType === "delete_context") {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground">Key</label>
        <input
          type="text"
          value={key}
          onChange={(e) => onChange({ ...config, key: e.target.value })}
          placeholder="Key to delete"
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          list="context-keys"
        />
        <datalist id="context-keys-del">
          {contextKeys.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </div>
    );
  }

  if (nodeType === "context_condition") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Key</label>
          <input
            type="text"
            value={key}
            onChange={(e) => onChange({ ...config, key: e.target.value })}
            placeholder="Context key to check"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            list="context-keys-cond"
          />
          <datalist id="context-keys-cond">
            {contextKeys.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Operator</label>
          <select
            value={operator}
            onChange={(e) => onChange({ ...config, operator: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="exists">Exists</option>
            <option value="equals">Equals</option>
            <option value="gt">Greater Than</option>
            <option value="lt">Less Than</option>
            <option value="contains">Contains</option>
          </select>
        </div>
        {operator !== "exists" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Value</label>
            <input
              type="text"
              value={conditionValue}
              onChange={(e) => onChange({ ...config, value: e.target.value })}
              placeholder="Expected value"
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}
