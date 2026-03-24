"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { FlowDefinition } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Plus, Workflow } from "lucide-react";

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFlows({ limit: 50 }).then((r) => setFlows(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const flow = await api.createFlow({ name: "New Flow", description: "" });
    window.location.href = `/dashboard/flows/${flow.id}/edit`;
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flows</h1>
        <Button onClick={handleCreate} size="sm"><Plus className="mr-2 h-4 w-4" />New Flow</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {flows.map((flow) => (
          <Link key={flow.id} href={`/dashboard/flows/${flow.id}/edit`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{flow.name}</CardTitle>
                  <Badge variant={flow.status === "active" ? "default" : "secondary"}>{flow.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{flow.description || "No description"}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>v{flow.version}</span>
                  <span>{flow._count?.executions ?? 0} executions</span>
                  <span>{new Date(flow.updatedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {flows.length === 0 && (
        <EmptyState
          icon={Workflow}
          title="No flows yet"
          description="Create your first automation flow"
          action={{ label: "Create Flow", onClick: handleCreate }}
        />
      )}
    </div>
  );
}
