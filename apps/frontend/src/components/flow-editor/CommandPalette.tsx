"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Command,
  Play,
  ShieldCheck,
  Save,
  Upload,
  Undo2,
  Redo2,
  ZoomIn,
  Grid3X3,
  Map,
} from "lucide-react";
import { NODE_TYPES, type NodeTypeDefinition } from "@flowbot/flow-shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAddNode: (type: string) => void;
  onAction: (action: string) => void;
}

interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

interface SettingItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

type ResultItem =
  | { kind: "node"; node: NodeTypeDefinition; highlightedLabel: React.ReactNode }
  | { kind: "action"; item: ActionItem }
  | { kind: "setting"; item: SettingItem };

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const ACTIONS: ActionItem[] = [
  { id: "test-run", label: "Test Run", icon: <Play className="h-4 w-4" />, shortcut: "⌘⏎" },
  { id: "validate", label: "Validate", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "save", label: "Save Draft", icon: <Save className="h-4 w-4" />, shortcut: "⌘S" },
  { id: "publish", label: "Publish", icon: <Upload className="h-4 w-4" /> },
  { id: "undo", label: "Undo", icon: <Undo2 className="h-4 w-4" />, shortcut: "⌘Z" },
  { id: "redo", label: "Redo", icon: <Redo2 className="h-4 w-4" />, shortcut: "⌘⇧Z" },
];

const SETTINGS: SettingItem[] = [
  { id: "zoom", label: "Reset Zoom", icon: <ZoomIn className="h-4 w-4" /> },
  { id: "toggle-grid", label: "Toggle Grid", icon: <Grid3X3 className="h-4 w-4" /> },
  { id: "toggle-minimap", label: "Toggle Minimap", icon: <Map className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_PER_CATEGORY = 8;

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-bold text-foreground">
        {text.slice(idx, idx + query.length)}
      </strong>
      {text.slice(idx + query.length)}
    </>
  );
}

function matchesQuery(node: NodeTypeDefinition, query: string): boolean {
  const q = query.toLowerCase();
  return (
    node.label.toLowerCase().includes(q) ||
    node.type.toLowerCase().includes(q) ||
    node.platform.toLowerCase().includes(q) ||
    node.category.toLowerCase().includes(q)
  );
}

function matchesActionQuery(label: string, query: string): boolean {
  return label.toLowerCase().includes(query.toLowerCase());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CategoryHeaderProps {
  label: string;
}

function CategoryHeader({ label }: CategoryHeaderProps) {
  return (
    <div className="sticky top-0 bg-background/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
  );
}

interface NodeResultProps {
  node: NodeTypeDefinition;
  highlightedLabel: React.ReactNode;
  isHighlighted: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function NodeResult({
  node,
  highlightedLabel,
  isHighlighted,
  onClick,
  onMouseEnter,
}: NodeResultProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
        isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
      }`}
    >
      {/* Color bar */}
      <span
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: node.color }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{highlightedLabel}</div>
        <div className="truncate text-xs text-muted-foreground">
          {node.platform} · {node.category}
          {node.subcategory ? ` · ${node.subcategory}` : ""}
        </div>
      </div>
    </button>
  );
}

interface ActionResultProps {
  item: ActionItem | SettingItem;
  isHighlighted: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function ActionResult({
  item,
  isHighlighted,
  onClick,
  onMouseEnter,
}: ActionResultProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
        isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        {item.icon}
      </span>
      <span className="flex-1 text-sm text-foreground">{item.label}</span>
      {item.shortcut && (
        <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {item.shortcut}
        </kbd>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

export function CommandPalette({
  open,
  onClose,
  onAddNode,
  onAction,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
      // Focus input after paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build result list
  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim();

    const nodeResults: ResultItem[] = NODE_TYPES.filter((n) =>
      q === "" ? true : matchesQuery(n, q),
    )
      .slice(0, MAX_PER_CATEGORY)
      .map((node) => ({
        kind: "node" as const,
        node,
        highlightedLabel: highlightMatch(node.label, q),
      }));

    const actionResults: ResultItem[] = ACTIONS.filter((a) =>
      q === "" ? true : matchesActionQuery(a.label, q),
    )
      .slice(0, MAX_PER_CATEGORY)
      .map((item) => ({ kind: "action" as const, item }));

    const settingResults: ResultItem[] = SETTINGS.filter((s) =>
      q === "" ? true : matchesActionQuery(s.label, q),
    )
      .slice(0, MAX_PER_CATEGORY)
      .map((item) => ({ kind: "setting" as const, item }));

    return [...nodeResults, ...actionResults, ...settingResults];
  }, [query]);

  // Sections for rendering with headers
  const sections = useMemo(() => {
    const q = query.trim();

    const nodes: ResultItem[] = NODE_TYPES.filter((n) =>
      q === "" ? true : matchesQuery(n, q),
    )
      .slice(0, MAX_PER_CATEGORY)
      .map((node) => ({
        kind: "node" as const,
        node,
        highlightedLabel: highlightMatch(node.label, q),
      }));

    const actions: ResultItem[] = ACTIONS.filter((a) =>
      q === "" ? true : matchesActionQuery(a.label, q),
    )
      .slice(0, MAX_PER_CATEGORY)
      .map((item) => ({ kind: "action" as const, item }));

    const settings: ResultItem[] = SETTINGS.filter((s) =>
      q === "" ? true : matchesActionQuery(s.label, q),
    )
      .slice(0, MAX_PER_CATEGORY)
      .map((item) => ({ kind: "setting" as const, item }));

    return { nodes, actions, settings };
  }, [query]);

  // Clamp highlighted index when results change
  useEffect(() => {
    setHighlightedIndex((prev) => Math.min(prev, Math.max(0, results.length - 1)));
  }, [results.length]);

  const handleSelect = useCallback(
    (item: ResultItem) => {
      if (item.kind === "node") {
        onAddNode(item.node.type);
      } else if (item.kind === "action") {
        onAction(item.item.id);
      } else {
        onAction(item.item.id);
      }
      onClose();
    },
    [onAddNode, onAction, onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          results.length === 0 ? 0 : (prev + 1) % results.length,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          results.length === 0 ? 0 : (prev - 1 + results.length) % results.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[highlightedIndex];
        if (item) handleSelect(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, highlightedIndex, handleSelect, onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.querySelector("[data-highlighted='true']");
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  if (!open) return null;

  // Compute global index offsets for keyboard highlight
  const nodeOffset = 0;
  const actionOffset = sections.nodes.length;
  const settingOffset = sections.nodes.length + sections.actions.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 flex w-[480px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Command className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            placeholder="Search nodes, actions, settings..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-label="Search command palette"
            aria-autocomplete="list"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[320px] overflow-y-auto"
          role="listbox"
          aria-label="Results"
        >
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {sections.nodes.length > 0 && (
                <div role="group" aria-label="Nodes">
                  <CategoryHeader label="Nodes" />
                  {sections.nodes.map((item, i) => {
                    if (item.kind !== "node") return null;
                    const globalIdx = nodeOffset + i;
                    return (
                      <div
                        key={item.node.type}
                        data-highlighted={highlightedIndex === globalIdx ? "true" : undefined}
                        role="option"
                        aria-selected={highlightedIndex === globalIdx}
                      >
                        <NodeResult
                          node={item.node}
                          highlightedLabel={item.highlightedLabel}
                          isHighlighted={highlightedIndex === globalIdx}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setHighlightedIndex(globalIdx)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {sections.actions.length > 0 && (
                <div role="group" aria-label="Actions">
                  <CategoryHeader label="Actions" />
                  {sections.actions.map((item, i) => {
                    if (item.kind !== "action") return null;
                    const globalIdx = actionOffset + i;
                    return (
                      <div
                        key={item.item.id}
                        data-highlighted={highlightedIndex === globalIdx ? "true" : undefined}
                        role="option"
                        aria-selected={highlightedIndex === globalIdx}
                      >
                        <ActionResult
                          item={item.item}
                          isHighlighted={highlightedIndex === globalIdx}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setHighlightedIndex(globalIdx)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {sections.settings.length > 0 && (
                <div role="group" aria-label="Settings">
                  <CategoryHeader label="Settings" />
                  {sections.settings.map((item, i) => {
                    if (item.kind !== "setting") return null;
                    const globalIdx = settingOffset + i;
                    return (
                      <div
                        key={item.item.id}
                        data-highlighted={highlightedIndex === globalIdx ? "true" : undefined}
                        role="option"
                        aria-selected={highlightedIndex === globalIdx}
                      >
                        <ActionResult
                          item={item.item}
                          isHighlighted={highlightedIndex === globalIdx}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setHighlightedIndex(globalIdx)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono">⏎</kbd>{" "}
            select
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono">esc</kbd>{" "}
            close
          </span>
          <span className="ml-auto">
            <kbd className="rounded border border-border bg-muted px-1 font-mono">⌘K</kbd>{" "}
            to open
          </span>
        </div>
      </div>
    </div>
  );
}
