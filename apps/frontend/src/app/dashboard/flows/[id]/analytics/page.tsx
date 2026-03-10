"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { FlowAnalytics, FlowDefinition } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function FlowAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [analytics, setAnalytics] = useState<FlowAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getFlow(flowId),
      api.getFlowAnalytics(flowId),
    ])
      .then(([f, a]) => {
        setFlow(f);
        setAnalytics(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [flowId]);

  if (loading) return <div className="animate-pulse h-64 bg-muted rounded-xl" />;
  if (!analytics || !flow) return <p className="text-muted-foreground">Failed to load analytics.</p>;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flow Analytics</h1>
          <p className="text-sm text-muted-foreground">{flow.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/flows/${flowId}/edit`)}>
            Back to Editor
          </Button>
          <Button variant="outline" onClick={() => router.push(`/dashboard/flows/${flowId}/versions`)}>
            Versions
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Executions" value={analytics.totalExecutions} />
        <StatCard label="Successful" value={analytics.completedCount} />
        <StatCard
          label="Failed"
          value={analytics.failedCount}
          sub={`${analytics.errorRate}% error rate`}
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(analytics.avgDurationMs)}
        />
      </div>

      {/* Status breakdown */}
      <Card>
        <CardContent className="py-4">
          <h3 className="mb-3 font-semibold">Status Breakdown</h3>
          {analytics.totalExecutions > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Completed</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 rounded bg-green-500"
                    style={{
                      width: `${Math.max(4, (analytics.completedCount / analytics.totalExecutions) * 200)}px`,
                    }}
                  />
                  <span className="text-muted-foreground">{analytics.completedCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Failed</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 rounded bg-red-500"
                    style={{
                      width: `${Math.max(4, (analytics.failedCount / analytics.totalExecutions) * 200)}px`,
                    }}
                  />
                  <span className="text-muted-foreground">{analytics.failedCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Running</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 rounded bg-yellow-500"
                    style={{
                      width: `${Math.max(4, (analytics.runningCount / analytics.totalExecutions) * 200)}px`,
                    }}
                  />
                  <span className="text-muted-foreground">{analytics.runningCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No executions yet</p>
          )}
        </CardContent>
      </Card>

      {/* Common errors */}
      <Card>
        <CardContent className="py-4">
          <h3 className="mb-3 font-semibold">Common Errors</h3>
          {analytics.commonErrors.length > 0 ? (
            <div className="space-y-2">
              {analytics.commonErrors.map((err, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-xs break-all">
                    {err.error}
                  </code>
                  <Badge variant="destructive">{err.count}x</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No errors recorded</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
