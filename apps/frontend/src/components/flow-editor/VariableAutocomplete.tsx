"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Variable {
  name: string;
  source: "trigger" | "node" | "context" | "loop";
  description?: string;
}

/** Variables sourced from the variable registry (upstream graph scoping). */
interface RegistryVariable {
  name: string;
  type: string;
  source: string;
}

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  /** Optional: registry variables from getAvailableVariables(). When provided,
   *  shown in the dropdown grouped by source with type hints. Legacy `variables`
   *  prop is still used as fallback when this is absent. */
  registryVariables?: ReadonlyArray<RegistryVariable>;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
  label?: string;
}

// ---------------------------------------------------------------------------
// Internal unified shape used by the dropdown
// ---------------------------------------------------------------------------

interface DropdownItem {
  name: string;
  source: string;
  typeHint?: string;
  description?: string;
}

function toDropdownItems(
  legacy: Variable[],
  registry: ReadonlyArray<RegistryVariable> | undefined,
): DropdownItem[] {
  if (registry && registry.length > 0) {
    return registry.map((v) => ({
      name: v.name,
      source: v.source,
      typeHint: v.type,
    }));
  }
  return legacy.map((v) => ({
    name: v.name,
    source: v.source,
    description: v.description,
  }));
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

interface GroupedItems {
  source: string;
  items: DropdownItem[];
}

function groupBySource(items: DropdownItem[]): GroupedItems[] {
  const map = new Map<string, DropdownItem[]>();
  for (const item of items) {
    const group = map.get(item.source);
    if (group) {
      group.push(item);
    } else {
      map.set(item.source, [item]);
    }
  }
  return Array.from(map.entries()).map(([source, groupItems]) => ({
    source,
    items: groupItems,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VariableAutocomplete({
  value,
  onChange,
  variables,
  registryVariables,
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

  const allItems = toDropdownItems(variables, registryVariables);

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

  const filteredItems = allItems.filter((v) =>
    v.name.toLowerCase().includes(filter.toLowerCase()),
  );

  // Keep legacy filteredVariables shape for keyboard navigation index
  const flatFiltered = filteredItems;

  const selectItem = useCallback(
    (item: DropdownItem) => {
      const before = value.slice(0, cursorPosition);
      const openIndex = before.lastIndexOf("{{");
      const after = value.slice(cursorPosition);
      const closeIndex = after.indexOf("}}");

      const prefix = value.slice(0, openIndex);
      const suffix = closeIndex >= 0 ? after.slice(closeIndex + 2) : after;
      const newValue = `${prefix}{{${item.name}}}${suffix}`;

      onChange(newValue);
      setShowDropdown(false);
    },
    [value, cursorPosition, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || flatFiltered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && showDropdown) {
        e.preventDefault();
        const selected = flatFiltered[selectedIndex];
        if (selected) selectItem(selected);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [showDropdown, flatFiltered, selectedIndex, selectItem],
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as globalThis.Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const baseClass =
    className ??
    "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

  // Determine whether to render grouped (registry) or flat (legacy) dropdown
  const useGrouped = registryVariables && registryVariables.length > 0;
  const groupedItems = useGrouped ? groupBySource(filteredItems) : null;

  // Build a flat index → item map for keyboard selection highlighting
  let flatIndex = 0;
  const indexMap = new Map<string, number>();
  if (groupedItems) {
    for (const group of groupedItems) {
      for (const item of group.items) {
        indexMap.set(item.name, flatIndex++);
      }
    }
  }

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
      {showDropdown && flatFiltered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {groupedItems ? (
            // Registry-sourced variables: grouped by source node with type hints
            groupedItems.map((group) => (
              <div key={group.source}>
                <div className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                  {group.source}
                </div>
                {group.items.map((item) => {
                  const itemIndex = indexMap.get(item.name) ?? 0;
                  return (
                    <button
                      key={item.name}
                      onClick={() => selectItem(item)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between ${
                        itemIndex === selectedIndex ? "bg-accent" : ""
                      }`}
                    >
                      <span className="font-mono text-xs text-primary">
                        {`{{${item.name}}}`}
                      </span>
                      {item.typeHint && (
                        <span className="ml-2 text-muted-foreground text-xs shrink-0">
                          {item.typeHint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            // Legacy flat list
            flatFiltered.map((item, i) => (
              <button
                key={item.name}
                onClick={() => selectItem(item)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${
                  i === selectedIndex ? "bg-accent" : ""
                }`}
              >
                <span className="font-mono text-xs text-primary">{`{{${item.name}}}`}</span>
                {item.description && (
                  <span className="ml-2 text-muted-foreground text-xs">
                    {item.description}
                  </span>
                )}
              </button>
            ))
          )}
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
