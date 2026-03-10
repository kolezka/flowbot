"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { FlowVersion, FlowDefinition } from "@/lib/api";
import { diffFlowVersions, type FlowDiffResult, type DiffStatus } from "@/lib/flow-diff";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  RotateCcw,
  GitCompareArrows,
  Plus,
  Minus,
  Pencil,
  Circle,
  ChevronRight,
  Save,
} from "lucide-react";

// --- Types ---

interface VersionEntry {
  id: string;
  version: number;
  nodesJson: unknown[];
  edgesJson: unknown[];
  createdBy?: string;
  createdAt: string;
  isCurrent?: boolean;
}

// --- Loading skeleton ---

function VersionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

// --- Diff badge colors ---

const STATUS_STYLES: Record<DiffStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  added: {
    bg: "bg-green-500/10 border-green-500/30",
    text: "text-green-600 dark:text-green-400",
    icon: <Plus className="h-3 w-3" />,
  },
  removed: {
    bg: "bg-red-500/10 border-red-500/30",
    text: "text-red-600 dark:text-red-400",
    icon: <Minus className="h-3 w-3" />,
  },
  modified: {
    bg: "bg-yellow-500/10 border-yellow-500/30",
    text: "text-yellow-600 dark:text-yellow-400",
    icon: <Pencil className="h-3 w-3" />,
  },
  unchanged: {
    bg: "bg-muted/50 border-border",
    text: "text-muted-foreground",
    icon: <Circle className="h-3 w-3" />,
  },
};

// --- Diff panel ---

function DiffPanel({ diff }: { diff: FlowDiffResult }) {
  const hasChanges =
    diff.summary.nodesAdded +
    diff.summary.nodesRemoved +
    diff.summary.nodesModified +
    diff.summary.edgesAdded +
    diff.summary.edgesRemoved +
    diff.summary.edgesModified > 0;

  const changedNodes = diff.nodes.filter((n) => n.status !== "unchanged");
  const changedEdges = diff.edges.filter((e) => e.status !== "unchanged");

  if (!hasChanges) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        No differences found between these versions.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-3">
        <SummaryBadge status="added" label="Added" nodeCount={diff.summary.nodesAdded} edgeCount={diff.summary.edgesAdded} />
        <SummaryBadge status="removed" label="Removed" nodeCount={diff.summary.nodesRemoved} edgeCount={diff.summary.edgesRemoved} />
        <SummaryBadge status="modified" label="Modified" nodeCount={diff.summary.nodesModified} edgeCount={diff.summary.edgesModified} />
      </div>

      {/* Node changes */}
      {changedNodes.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Node Changes</h4>
          <div className="space-y-2">
            {changedNodes.map((nd) => {
              const style = STATUS_STYLES[nd.status];
              return (
                <div
                  key={nd.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${style.bg}`}
                >
                  <span className={`mt-0.5 ${style.text}`}>{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${style.text}`}>
                        {nd.label}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {nd.category}
                      </Badge>
                    </div>
                    {nd.changes && nd.changes.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {nd.changes.map((change, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            {change}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                      {nd.id}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edge changes */}
      {changedEdges.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Edge Changes</h4>
          <div className="space-y-2">
            {changedEdges.map((ed) => {
              const style = STATUS_STYLES[ed.status];
              return (
                <div
                  key={ed.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${style.bg}`}
                >
                  <span className={style.text}>{style.icon}</span>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="font-mono text-xs truncate max-w-[120px]">
                      {ed.source}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-xs truncate max-w-[120px]">
                      {ed.target}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBadge({
  status,
  label,
  nodeCount,
  edgeCount,
}: {
  status: DiffStatus;
  label: string;
  nodeCount: number;
  edgeCount: number;
}) {
  const total = nodeCount + edgeCount;
  if (total === 0) return null;
  const style = STATUS_STYLES[status];

  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${style.bg} ${style.text}`}>
      {style.icon}
      <span className="font-medium">{label}:</span>
      <span>
        {nodeCount > 0 && `${nodeCount} node${nodeCount !== 1 ? "s" : ""}`}
        {nodeCount > 0 && edgeCount > 0 && ", "}
        {edgeCount > 0 && `${edgeCount} edge${edgeCount !== 1 ? "s" : ""}`}
      </span>
    </div>
  );
}

// --- Main page ---

export default function VersionHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  // For comparison
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);

  // For rollback confirmation dialog
  const [rollbackTarget, setRollbackTarget] = useState<VersionEntry | null>(null);

  useEffect(() => {
    Promise.all([api.getFlow(flowId), api.getFlowVersions(flowId)])
      .then(([f, v]) => {
        setFlow(f);
        setVersions(v);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [flowId]);

  // Build unified version list: current + saved
  const allVersions: VersionEntry[] = useMemo(() => {
    const entries: VersionEntry[] = [];
    if (flow) {
      entries.push({
        id: "current",
        version: flow.version,
        nodesJson: flow.nodesJson ?? [],
        edgesJson: flow.edgesJson ?? [],
        createdAt: flow.updatedAt,
        isCurrent: true,
      });
    }
    for (const v of versions) {
      entries.push({
        id: v.id,
        version: v.version,
        nodesJson: v.nodesJson ?? [],
        edgesJson: v.edgesJson ?? [],
        createdBy: v.createdBy,
        createdAt: v.createdAt,
        isCurrent: false,
      });
    }
    return entries;
  }, [flow, versions]);

  // Compute diff between selected versions
  const diff: FlowDiffResult | null = useMemo(() => {
    if (!selectedA || !selectedB || selectedA === selectedB) return null;
    const vA = allVersions.find((v) => v.id === selectedA);
    const vB = allVersions.find((v) => v.id === selectedB);
    if (!vA || !vB) return null;
    return diffFlowVersions(
      vA.nodesJson as any[],
      vA.edgesJson as any[],
      vB.nodesJson as any[],
      vB.edgesJson as any[]
    );
  }, [selectedA, selectedB, allVersions]);

  // Auto-select: when clicking a non-current version, compare it against current
  const handleVersionClick = (versionId: string) => {
    if (selectedA === versionId) {
      setSelectedA(null);
      return;
    }
    if (selectedB === versionId) {
      setSelectedB(null);
      return;
    }

    if (!selectedA) {
      // First selection: auto-pair with current
      if (versionId !== "current") {
        setSelectedA(versionId);
        setSelectedB("current");
      } else {
        setSelectedA("current");
      }
    } else if (!selectedB) {
      setSelectedB(versionId);
    } else {
      // Both already selected, replace second
      setSelectedB(versionId);
    }
  };

  const handleSaveVersion = async () => {
    setSaving(true);
    try {
      const version = await api.createFlowVersion(flowId);
      setVersions((prev) => [version, ...prev]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save version";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (entry: VersionEntry) => {
    setRestoring(entry.id);
    try {
      await api.restoreFlowVersion(flowId, entry.id);
      router.push(`/dashboard/flows/${flowId}/edit`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to restore version";
      alert(msg);
    } finally {
      setRestoring(null);
      setRollbackTarget(null);
    }
  };

  const clearComparison = () => {
    setSelectedA(null);
    setSelectedB(null);
  };

  if (loading) return <VersionsSkeleton />;

  const getNodeCount = (json: unknown[]): number =>
    Array.isArray(json) ? json.length : 0;
  const getEdgeCount = (json: unknown[]): number =>
    Array.isArray(json) ? json.length : 0;

  const versionA = allVersions.find((v) => v.id === selectedA);
  const versionB = allVersions.find((v) => v.id === selectedB);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="text-sm text-muted-foreground">{flow?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/flows/${flowId}/edit`)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Editor
          </Button>
          <Button onClick={handleSaveVersion} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving..." : "Save Current Version"}
          </Button>
        </div>
      </div>

      {/* Comparison controls */}
      {(selectedA || selectedB) && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Comparing:</span>
              {versionA ? (
                <Badge variant="outline">
                  {versionA.isCurrent ? "Current" : `v${versionA.version}`}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Select a version</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {versionB ? (
                <Badge variant="outline">
                  {versionB.isCurrent ? "Current" : `v${versionB.version}`}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Select a version</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearComparison}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Version timeline */}
      <div className="space-y-3">
        {allVersions.map((entry) => {
          const nodeCount = getNodeCount(entry.nodesJson);
          const edgeCount = getEdgeCount(entry.edgesJson);
          const isSelected = entry.id === selectedA || entry.id === selectedB;
          const isRestoringThis = restoring === entry.id;

          return (
            <Card
              key={entry.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleVersionClick(entry.id)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  {/* Timeline dot */}
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      entry.isCurrent
                        ? "border-primary bg-primary"
                        : isSelected
                        ? "border-primary bg-primary/30"
                        : "border-muted-foreground bg-transparent"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={entry.isCurrent ? "default" : "secondary"}
                      >
                        v{entry.version}
                      </Badge>
                      {entry.isCurrent && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-green-500/50 text-green-600 dark:text-green-400"
                        >
                          Current
                        </Badge>
                      )}
                      {entry.createdBy && (
                        <span className="text-xs text-muted-foreground">
                          by {entry.createdBy}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nodeCount} node{nodeCount !== 1 ? "s" : ""},{" "}
                      {edgeCount} edge{edgeCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  {!entry.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRollbackTarget(entry);
                      }}
                      disabled={isRestoringThis}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      {isRestoringThis ? "Restoring..." : "Restore"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {allVersions.length <= 1 && (
          <p className="py-8 text-center text-muted-foreground">
            No saved versions yet. Click &quot;Save Current Version&quot; to
            create a snapshot.
          </p>
        )}
      </div>

      {/* Visual diff */}
      {diff && selectedA && selectedB && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Changes: {versionA?.isCurrent ? "Current" : `v${versionA?.version}`}
            {" "}
            <ChevronRight className="inline h-4 w-4" />{" "}
            {versionB?.isCurrent ? "Current" : `v${versionB?.version}`}
          </h2>
          <DiffPanel diff={diff} />
        </div>
      )}

      {/* Rollback confirmation dialog */}
      <DialogContent
        open={rollbackTarget !== null}
        onClose={() => setRollbackTarget(null)}
      >
        <DialogHeader>
          <DialogTitle>Restore Version</DialogTitle>
          <DialogDescription>
            Are you sure you want to restore to{" "}
            <strong>v{rollbackTarget?.version}</strong>? The current flow
            definition will be overwritten with this version&apos;s nodes and
            edges. This action cannot be undone unless you save the current
            version first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => setRollbackTarget(null)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => rollbackTarget && handleRestore(rollbackTarget)}
            disabled={restoring !== null}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            {restoring ? "Restoring..." : "Restore Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </div>
  );
}
