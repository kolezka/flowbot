"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export default function CommunityWarningsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    loadWarnings();
  }, [id, page, activeFilter]);

  const loadWarnings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCommunityWarnings(id, {
        page,
        limit: pageSize,
        isActive: activeFilter !== null ? activeFilter : undefined,
      });
      setWarnings(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load warnings");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/communities/${id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Community
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              Warnings
              <Badge variant="secondary">{total}</Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant={activeFilter === null ? "default" : "outline"}
                size="sm"
                onClick={() => { setActiveFilter(null); setPage(1); }}
              >
                All
              </Button>
              <Button
                variant={activeFilter === true ? "destructive" : "outline"}
                size="sm"
                onClick={() => { setActiveFilter(true); setPage(1); }}
              >
                Active
              </Button>
              <Button
                variant={activeFilter === false ? "default" : "outline"}
                size="sm"
                onClick={() => { setActiveFilter(false); setPage(1); }}
              >
                Inactive
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : warnings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No warnings found</p>
          ) : (
            <div className="space-y-2">
              {warnings.map((w: any) => (
                <div
                  key={w.id}
                  className="grid grid-cols-[1fr_auto] gap-4 rounded-lg border border-border p-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      Member:{" "}
                      <span className="text-muted-foreground">
                        {w.platformAccountId ?? w.userId ?? "—"}
                      </span>
                    </div>
                    {w.reason && (
                      <div className="text-xs text-muted-foreground">{w.reason}</div>
                    )}
                    {w.expiresAt && (
                      <div className="text-xs text-muted-foreground">
                        Expires: {new Date(w.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {w.isActive ? (
                      <Badge variant="destructive">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to{" "}
                {Math.min(page * pageSize, total)} of {total} warnings
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
