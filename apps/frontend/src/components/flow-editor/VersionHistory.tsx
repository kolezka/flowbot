"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { api, type FlowVersion } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VersionHistoryProps {
  flowId: string;
  currentVersion: number;
  open: boolean;
  onClose: () => void;
  onRestore: (version: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// VersionItem
// ---------------------------------------------------------------------------

interface VersionItemProps {
  version: FlowVersion;
  isCurrent: boolean;
  onRestore: (v: FlowVersion) => void;
}

function VersionItem({ version, isCurrent, onRestore }: VersionItemProps) {
  return (
    <div
      className={`rounded-md mb-2 px-3 py-2.5 transition-colors ${
        isCurrent
          ? "border-[1.5px] border-blue-500 bg-blue-50 dark:bg-blue-950/20"
          : "border border-border bg-background hover:bg-muted/50"
      }`}
    >
      {/* Top row: version number + badge / restore link */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">
          v{version.version}
        </span>
        {isCurrent ? (
          <span className="text-[11px] font-semibold text-blue-500 bg-blue-100 dark:bg-blue-900/40 rounded px-1.5 py-px">
            current
          </span>
        ) : (
          <button
            onClick={() => onRestore(version)}
            className="text-xs text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-transparent border-none cursor-pointer p-0"
          >
            restore
          </button>
        )}
      </div>

      {/* Second row: createdBy */}
      {version.createdBy && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {version.createdBy}
        </div>
      )}

      {/* Third row: timestamp */}
      <div className="text-[11px] text-muted-foreground/70 mt-0.5">
        {formatRelativeTime(version.createdAt)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VersionHistory
// ---------------------------------------------------------------------------

export function VersionHistory({
  flowId,
  currentVersion,
  open,
  onClose,
  onRestore,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch versions whenever the panel opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getFlowVersions(flowId)
      .then((data) => {
        if (cancelled) return;
        // Sort newest first
        const sorted = [...data].sort((a, b) => b.version - a.version);
        setVersions(sorted);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load versions";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, flowId]);

  const handleRestore = useCallback(
    async (v: FlowVersion) => {
      const confirmed = window.confirm(
        `Restore flow to version v${v.version}? This will overwrite the current state.`
      );
      if (!confirmed) return;

      try {
        await api.restoreFlowVersion(flowId, v.id);
        onRestore(v.version);
        onClose();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Restore failed";
        alert(`Restore failed: ${message}`);
      }
    },
    [flowId, onRestore, onClose]
  );

  if (!open) return null;

  return (
    <div className="w-[280px] h-full border-l border-border bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-[13px] font-semibold text-foreground">
          Version History
        </span>
        <button
          onClick={onClose}
          aria-label="Close version history"
          className="bg-transparent border-none cursor-pointer p-1 rounded text-muted-foreground flex items-center hover:bg-accent hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        {loading && (
          <div className="text-[13px] text-muted-foreground text-center mt-8">
            Loading...
          </div>
        )}

        {!loading && error && (
          <div className="text-[13px] text-destructive text-center mt-8">
            {error}
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <div className="text-[13px] text-muted-foreground/70 text-center mt-8">
            No versions saved yet.
          </div>
        )}

        {!loading && !error && versions.map((v) => (
          <VersionItem
            key={v.id}
            version={v}
            isCurrent={v.version === currentVersion}
            onRestore={handleRestore}
          />
        ))}
      </div>
    </div>
  );
}
