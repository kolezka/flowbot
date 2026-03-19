"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ConnectionHealth } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/platform-badge";
import { RefreshCw, CheckCircle, XCircle, Globe } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className="h-2 rounded-full bg-green-500 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ConnectionHealthPage() {
  const [health, setHealth] = useState<ConnectionHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.getConnectionHealth();
      setHealth(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load health data";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Connection Health</h1>
        <div className="rounded-lg bg-destructive/10 p-6 text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Connection Health</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {health && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Connections
                </CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{health.totalConnections}</div>
                <ProgressBar value={health.activeConnections} max={health.totalConnections} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {health.activeConnections} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {health.activeConnections}
                </div>
                <p className="text-xs text-muted-foreground">
                  {health.totalConnections > 0
                    ? Math.round((health.activeConnections / health.totalConnections) * 100)
                    : 0}
                  % healthy
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Errors
                </CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {health.errorConnections}
                </div>
                <p className="text-xs text-muted-foreground">Require attention</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-platform breakdown */}
          {Object.keys(health.platforms).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Per-Platform Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(health.platforms).map(([platform, stats]) => (
                  <div key={platform} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <PlatformBadge platform={platform} />
                      <span className="text-sm text-muted-foreground">
                        {stats.active} / {stats.total} active
                        {stats.error > 0 && (
                          <span className="ml-2 text-destructive">
                            &middot; {stats.error} error{stats.error !== 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                    </div>
                    <ProgressBar value={stats.active} max={stats.total} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No platform data available. Add connections to see health breakdown.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
