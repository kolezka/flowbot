"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Variable {
  name: string;
  source: "trigger" | "node" | "context" | "loop";
  description?: string;
}

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
  label?: string;
}

export function VariableAutocomplete({
  value,
  onChange,
  variables,
  multiline,
  placeholder,
  className,
  rows = 3,
  label,
}: VariableAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback(
    (newValue: string, selectionStart: number) => {
      onChange(newValue);
      setCursorPosition(selectionStart);

      const before = newValue.slice(0, selectionStart);
      const openIndex = before.lastIndexOf("{{");
      const closeIndex = before.lastIndexOf("}}");

      if (openIndex > closeIndex) {
        const partial = before.slice(openIndex + 2);
        setFilter(partial);
        setShowDropdown(true);
        setSelectedIndex(0);
      } else {
        setShowDropdown(false);
      }
    },
    [onChange],
  );

  const filteredVariables = variables.filter((v) =>
    v.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const selectVariable = useCallback(
    (variable: Variable) => {
      const before = value.slice(0, cursorPosition);
      const openIndex = before.lastIndexOf("{{");
      const after = value.slice(cursorPosition);
      const closeIndex = after.indexOf("}}");

      const prefix = value.slice(0, openIndex);
      const suffix = closeIndex >= 0 ? after.slice(closeIndex + 2) : after;
      const newValue = `${prefix}{{${variable.name}}}${suffix}`;

      onChange(newValue);
      setShowDropdown(false);
    },
    [value, cursorPosition, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || filteredVariables.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredVariables.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && showDropdown) {
        e.preventDefault();
        const selected = filteredVariables[selectedIndex];
        if (selected) selectVariable(selected);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [showDropdown, filteredVariables, selectedIndex, selectVariable],
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as globalThis.Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const baseClass =
    className ??
    "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          className={`${baseClass} mt-1 font-mono`}
          onChange={(e) =>
            handleInput(e.target.value, e.target.selectionStart ?? 0)
          }
          onKeyDown={handleKeyDown}
          rows={rows}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          className={`${baseClass} mt-1`}
          onChange={(e) =>
            handleInput(e.target.value, e.target.selectionStart ?? 0)
          }
          onKeyDown={handleKeyDown}
        />
      )}
      {showDropdown && filteredVariables.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {filteredVariables.map((v, i) => (
            <button
              key={v.name}
              onClick={() => selectVariable(v)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${
                i === selectedIndex ? "bg-accent" : ""
              }`}
            >
              <span className="font-mono text-xs text-primary">{`{{${v.name}}}`}</span>
              {v.description && (
                <span className="ml-2 text-muted-foreground text-xs">
                  {v.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Build the default variable list for a flow context. */
export function buildVariableList(
  triggerType?: string,
  upstreamNodes?: Array<{ id: string; type: string; label: string }>,
  contextKeys?: string[],
): Variable[] {
  const vars: Variable[] = [];

  // Trigger variables
  const triggerVars = [
    "trigger.chatId",
    "trigger.userId",
    "trigger.userName",
    "trigger.text",
    "trigger.messageId",
    "trigger.platform",
    "trigger.platformUserId",
  ];
  if (triggerType === "callback_query") {
    triggerVars.push("trigger.callbackData");
  }
  if (triggerType === "command_received") {
    triggerVars.push("trigger.command", "trigger.args");
  }
  for (const name of triggerVars) {
    vars.push({ name, source: "trigger" });
  }

  // Node output variables
  if (upstreamNodes) {
    for (const node of upstreamNodes) {
      vars.push({
        name: `node.${node.id}.output`,
        source: "node",
        description: node.label,
      });
    }
  }

  // Context variables
  if (contextKeys) {
    for (const key of contextKeys) {
      vars.push({ name: `context.${key}`, source: "context" });
    }
  }

  // Loop variables
  vars.push(
    { name: "loop.index", source: "loop", description: "Current iteration index" },
    { name: "loop.item", source: "loop", description: "Current iteration item" },
  );

  return vars;
}
