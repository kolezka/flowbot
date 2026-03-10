"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { FlowVersion, FlowDefinition } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function VersionHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getFlow(flowId),
      api.getFlowVersions(flowId),
    ])
      .then(([f, v]) => {
        setFlow(f);
        setVersions(v);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [flowId]);

  const handleSaveVersion = async () => {
    setSaving(true);
    try {
      const version = await api.createFlowVersion(flowId);
      setVersions((prev) => [version, ...prev]);
    } catch (e: any) {
      alert(e.message || "Failed to save version");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!confirm("Are you sure you want to restore this version? Current unsaved changes will be overwritten.")) {
      return;
    }
    setRestoring(versionId);
    try {
      await api.restoreFlowVersion(flowId, versionId);
      router.push(`/dashboard/flows/${flowId}/edit`);
    } catch (e: any) {
      alert(e.message || "Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  const getNodeCount = (nodesJson: any[]): number => {
    return Array.isArray(nodesJson) ? nodesJson.length : 0;
  };

  const getEdgeCount = (edgesJson: any[]): number => {
    return Array.isArray(edgesJson) ? edgesJson.length : 0;
  };

  if (loading) return <div className="animate-pulse h-64 bg-muted rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="text-sm text-muted-foreground">{flow?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/flows/${flowId}/edit`)}>
            Back to Editor
          </Button>
          <Button onClick={handleSaveVersion} disabled={saving}>
            {saving ? "Saving..." : "Save Current Version"}
          </Button>
        </div>
      </div>

      {/* Current version */}
      {flow && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Current</span>
                  <Badge>v{flow.version}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {getNodeCount(flow.nodesJson)} nodes, {getEdgeCount(flow.edgesJson)} edges
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                Updated {new Date(flow.updatedAt).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved versions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Saved Versions</h2>
        {versions.map((version) => {
          const nodeCount = getNodeCount(version.nodesJson);
          const edgeCount = getEdgeCount(version.edgesJson);
          const isRestoring = restoring === version.id;

          return (
            <Card key={version.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">v{version.version}</Badge>
                    {version.createdBy && (
                      <span className="text-xs text-muted-foreground">by {version.createdBy}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nodeCount} nodes, {edgeCount} edges
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(version.id)}
                    disabled={isRestoring}
                  >
                    {isRestoring ? "Restoring..." : "Restore"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {versions.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No saved versions yet. Click &quot;Save Current Version&quot; to create one.
          </p>
        )}
      </div>
    </div>
  );
}
