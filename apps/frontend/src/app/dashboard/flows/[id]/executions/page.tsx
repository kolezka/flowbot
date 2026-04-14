"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import type { FlowExecution } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ExecutionsPage() {
  const params = useParams();
  const flowId = params.id as string;
  const [executions, setExecutions] = useState<FlowExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/flows/${flowId}/executions`)
      .then(r => r.json())
      .then(data => setExecutions(data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [flowId]);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Execution History</h1>

      <div className="space-y-3">
        {executions.map((exec) => (
          <Card key={exec.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-mono text-sm">{exec.id.slice(0, 12)}...</p>
                <p className="text-xs text-muted-foreground">{new Date(exec.startedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                {exec.completedAt && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round((new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)}s
                  </span>
                )}
                <Badge variant={
                  exec.status === 'completed' ? 'default' :
                  exec.status === 'failed' ? 'destructive' : 'secondary'
                }>
                  {exec.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {executions.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No executions yet</p>
        )}
      </div>
    </div>
  );
}
