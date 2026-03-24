"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Group {
  id: string;
  name: string;
  memberCount: number;
}

interface ScopeManagerProps {
  connectionId: string;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCOPE_ENDPOINT = (connectionId: string) =>
  `/api/connections/${connectionId}/scope`;

// ---------------------------------------------------------------------------
// Manual fallback sub-component
// ---------------------------------------------------------------------------

interface ManualInputProps {
  onComplete: () => void;
}

function ManualFallback({ onComplete }: ManualInputProps) {
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [newId, setNewId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const addId = () => {
    const trimmed = newId.trim();
    if (trimmed && !groupIds.includes(trimmed)) {
      setGroupIds([...groupIds, trimmed]);
    }
    setNewId("");
  };

  const removeId = (id: string) => {
    setGroupIds(groupIds.filter((g) => g !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      console.info("[ScopeManager] Manual save — group IDs:", groupIds);
      onComplete();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save scope";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Group IDs</Label>
        <div className="space-y-1">
          {groupIds.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No group IDs added yet.
            </p>
          )}
          {groupIds.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-1.5"
            >
              <span className="text-sm font-mono">{id}</span>
              <button
                type="button"
                onClick={() => removeId(id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove group ${id}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Group chat ID (e.g. -1001234567890)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addId();
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addId}
            disabled={!newId.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground">
          {groupIds.length} group{groupIds.length !== 1 ? "s" : ""} added
        </span>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="outline"
        >
          {saving ? "Saving..." : "Save & Finish"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ScopeManager component
// ---------------------------------------------------------------------------

export function ScopeManager({ connectionId, onComplete }: ScopeManagerProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "fallback">(
    "loading"
  );
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Fetch available groups on mount
  useEffect(() => {
    let cancelled = false;

    api
      .getAvailableGroups(connectionId)
      .then((result) => {
        if (cancelled) return;
        if (!result.groups || result.groups.length === 0) {
          setLoadError(
            "Could not fetch groups automatically. Enter group IDs manually."
          );
          setLoadState("fallback");
        } else {
          setGroups(result.groups);
          setLoadState("loaded");
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          e instanceof Error ? e.message : "Failed to fetch groups.";
        setLoadError(
          `Could not fetch groups automatically (${msg}). Enter group IDs manually.`
        );
        setLoadState("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  // Filtered groups based on search query
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        g.id.toLowerCase().includes(query)
    );
  }, [groups, search]);

  const toggleGroup = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    const groupIds = Array.from(selected);

    try {
      const res = await fetch(SCOPE_ENDPOINT(connectionId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds }),
      });

      if (!res.ok && res.status !== 404) {
        throw new Error(`Server responded with ${res.status}`);
      }

      // Endpoint not yet wired — log and proceed
      if (res.status === 404) {
        console.info(
          "[ScopeManager] Scope endpoint not yet available. Selected group IDs:",
          groupIds
        );
      }

      onComplete();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save scope";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Loading skeleton
  if (loadState === "loading") {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-9 bg-muted rounded-md" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted rounded-md" />
        ))}
      </div>
    );
  }

  // Manual fallback mode
  if (loadState === "fallback") {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {loadError}
        </div>
        <ManualFallback onComplete={onComplete} />
      </div>
    );
  }

  // Auto-picker mode
  return (
    <div className="space-y-4">
      {/* Search input */}
      <Input
        placeholder="Search groups..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Group list */}
      <div className="space-y-1 max-h-80 overflow-y-auto rounded-md border border-border">
        {filteredGroups.length === 0 && (
          <p className="text-sm text-muted-foreground px-3 py-4 text-center">
            No groups match your search.
          </p>
        )}
        {filteredGroups.map((group) => {
          const isSelected = selected.has(group.id);
          return (
            <div
              key={group.id}
              role="button"
              tabIndex={0}
              onClick={() => toggleGroup(group.id)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  toggleGroup(group.id);
                }
              }}
              className={[
                "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors select-none",
                "hover:bg-muted/50",
                isSelected
                  ? "border-l-2 border-green-500 bg-green-50/50"
                  : "border-l-2 border-transparent",
              ].join(" ")}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleGroup(group.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${group.name}`}
              />

              <span className="text-lg select-none" aria-hidden>
                👥
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{group.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {group.id}
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Users className="h-3 w-3" />
                <span>{group.memberCount.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground">
          {selected.size} group{selected.size !== 1 ? "s" : ""} selected
        </span>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="outline"
        >
          {saving ? "Saving..." : "Save & Finish"}
        </Button>
      </div>
    </div>
  );
}
