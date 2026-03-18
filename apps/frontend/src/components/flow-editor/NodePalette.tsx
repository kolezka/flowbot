"use client";

import { useState, useMemo, useEffect } from "react";
import { NODE_TYPES, type NodeTypeDefinition } from "@flowbot/flow-shared";

type PlatformFilter = "all" | "telegram" | "discord" | "general";

const RECENT_KEY = "flow-editor-recent-nodes";
const PLATFORM_KEY = "flow-editor-platform";
const MAX_RECENT = 8;

interface NodePaletteProps {
  onDragStart: (type: string, label: string, category: string) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentTypes, setRecentTypes] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const categories = ["trigger", "condition", "action", "advanced"];

  // Load persisted state from localStorage
  useEffect(() => {
    try {
      const storedRecent = localStorage.getItem(RECENT_KEY);
      if (storedRecent) setRecentTypes(JSON.parse(storedRecent));
      const storedPlatform = localStorage.getItem(PLATFORM_KEY);
      if (storedPlatform) setPlatformFilter(storedPlatform as PlatformFilter);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist platform filter
  useEffect(() => {
    try {
      localStorage.setItem(PLATFORM_KEY, platformFilter);
    } catch {
      // Ignore
    }
  }, [platformFilter]);

  const filteredNodes = useMemo(() => {
    let nodes = NODE_TYPES as NodeTypeDefinition[];

    // Platform filter
    if (platformFilter !== "all") {
      nodes = nodes.filter(
        (n) => n.platform === platformFilter || n.platform === "general",
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q),
      );
    }

    return nodes;
  }, [platformFilter, searchQuery]);

  const recentNodes = useMemo(() => {
    if (searchQuery) return [];
    return recentTypes
      .map((type) => NODE_TYPES.find((n) => n.type === type))
      .filter((n): n is NodeTypeDefinition => n !== undefined)
      .slice(0, MAX_RECENT);
  }, [recentTypes, searchQuery]);

  const handleDragStart = (
    e: React.DragEvent,
    node: NodeTypeDefinition,
  ) => {
    e.dataTransfer.setData("application/reactflow-type", node.type);
    e.dataTransfer.setData("application/reactflow-label", node.label);
    e.dataTransfer.setData("application/reactflow-category", node.category);

    // Track recently used
    const updated = [node.type, ...recentTypes.filter((t) => t !== node.type)].slice(0, MAX_RECENT);
    setRecentTypes(updated);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    onDragStart(node.type, node.label, node.category);
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <div className="w-56 border-r border-border bg-card p-3 overflow-y-auto">
      <h3 className="mb-2 text-sm font-semibold">Node Palette</h3>

      {/* Search */}
      <input
        type="text"
        placeholder="Search nodes..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground"
      />

      {/* Platform filter */}
      <div className="mb-3 flex gap-1 flex-wrap">
        {(["all", "telegram", "discord", "general"] as PlatformFilter[]).map(
          (p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                platformFilter === p
                  ? p === "discord"
                    ? "bg-[#5865F2] text-white"
                    : p === "telegram"
                      ? "bg-[#0088cc] text-white"
                      : "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ),
        )}
      </div>

      {/* Recently used */}
      {recentNodes.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Recent
          </h4>
          <div className="space-y-1">
            {recentNodes.map((node) => (
              <div
                key={`recent-${node.type}`}
                draggable
                onDragStart={(e) => handleDragStart(e, node)}
                className="cursor-grab rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                style={{ borderLeftColor: node.color, borderLeftWidth: 3 }}
              >
                {node.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorized nodes */}
      {categories.map((cat) => {
        const catNodes = filteredNodes.filter((n) => n.category === cat);
        if (catNodes.length === 0) return null;
        const isCollapsed = collapsedCategories.has(cat);
        return (
          <div key={cat} className="mb-4">
            <button
              onClick={() => toggleCategory(cat)}
              className="mb-1 flex w-full items-center justify-between text-xs font-medium uppercase text-muted-foreground hover:text-foreground"
            >
              <span>
                {cat}s ({catNodes.length})
              </span>
              <span className="text-[10px]">{isCollapsed ? "+" : "-"}</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-1">
                {catNodes.map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node)}
                    className="cursor-grab rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                    style={{
                      borderLeftColor: node.color,
                      borderLeftWidth: 3,
                    }}
                  >
                    {node.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
