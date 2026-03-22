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
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 12px",
        borderRadius: 6,
        border: isCurrent ? "1.5px solid #3b82f6" : "1px solid #e5e7eb",
        backgroundColor: isCurrent ? "#eff6ff" : hovered ? "#f9fafb" : "#fff",
        marginBottom: 8,
        transition: "background-color 0.1s",
      }}
    >
      {/* Top row: version number + badge / restore link */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>
          v{version.version}
        </span>
        {isCurrent ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#3b82f6",
              backgroundColor: "#dbeafe",
              borderRadius: 4,
              padding: "1px 6px",
            }}
          >
            current
          </span>
        ) : (
          <button
            onClick={() => onRestore(version)}
            style={{
              fontSize: 12,
              color: hovered ? "#2563eb" : "#6b7280",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "color 0.1s",
            }}
          >
            restore
          </button>
        )}
      </div>

      {/* Second row: createdBy */}
      {version.createdBy && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
          {version.createdBy}
        </div>
      )}

      {/* Third row: timestamp */}
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
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
    <div
      style={{
        width: 280,
        height: "100%",
        borderLeft: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid #e5e7eb",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>
          Version History
        </span>
        <button
          onClick={onClose}
          aria-label="Close version history"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: 4,
            color: "#6b7280",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 12px",
        }}
      >
        {loading && (
          <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginTop: 32 }}>
            Loading…
          </div>
        )}

        {!loading && error && (
          <div style={{ fontSize: 13, color: "#ef4444", textAlign: "center", marginTop: 32 }}>
            {error}
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", marginTop: 32 }}>
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
