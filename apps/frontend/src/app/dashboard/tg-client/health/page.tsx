"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { TransportHealth, ClientLog } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Wifi } from "lucide-react";

// ---------------------------------------------------------------------------
// Types for internal metrics derived from the API
// ---------------------------------------------------------------------------

interface DerivedMetrics {
  activeSessions: number;
  healthySessions: number;
  errorSessions: number;
  errorRate: number;
  circuitBreakerState: "closed" | "open" | "half-open" | "unknown";
  recentErrors: ClientLog[];
  recentInfo: ClientLog[];
  messagesPerMinute: number;
  lastChecked: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveMetrics(health: TransportHealth): DerivedMetrics {
  const total = health.activeSessions || 1;
  const errorRate = total > 0 ? health.errorSessions / total : 0;

  // Derive circuit breaker state from error ratio
  let circuitBreakerState: DerivedMetrics["circuitBreakerState"] = "closed";
  if (errorRate >= 0.8) {
    circuitBreakerState = "open";
  } else if (errorRate >= 0.3) {
    circuitBreakerState = "half-open";
  }

  const recentErrors = health.recentLogs?.filter((l) => l.level === "error") ?? [];
  const recentInfo = health.recentLogs?.filter((l) => l.level !== "error") ?? [];

  // Estimate messages per minute from info log frequency
  const now = Date.now();
  const recentWindow = health.recentLogs?.filter(
    (l) => now - new Date(l.createdAt).getTime() < 60_000
  ) ?? [];
  const messagesPerMinute = recentWindow.length;

  return {
    activeSessions: health.activeSessions,
    healthySessions: health.healthySessions,
    errorSessions: health.errorSessions,
    errorRate,
    circuitBreakerState,
    recentErrors,
    recentInfo,
    messagesPerMinute,
    lastChecked: health.lastChecked,
  };
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CircuitBreakerIndicator({ state }: { state: DerivedMetrics["circuitBreakerState"] }) {
  const config = {
    closed: { label: "Closed (Healthy)", color: "bg-green-500", badge: "default" as const, icon: CheckCircle },
    "half-open": { label: "Half-Open (Testing)", color: "bg-yellow-500", badge: "secondary" as const, icon: AlertTriangle },
    open: { label: "Open (Tripped)", color: "bg-red-500", badge: "destructive" as const, icon: XCircle },
    unknown: { label: "Unknown", color: "bg-muted-foreground", badge: "outline" as const, icon: Activity },
  }[state];

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div className={`h-4 w-4 rounded-full ${config.color} animate-pulse`} />
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        <Badge variant={config.badge} className="mt-1">{state}</Badge>
      </div>
    </div>
  );
}

function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-12">
      {data.map((val, idx) => (
        <div
          key={idx}
          className={`flex-1 rounded-t-sm transition-all ${color}`}
          style={{ height: `${Math.max(2, (val / max) * 100)}%` }}
          title={`${val}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TransportHealthPage() {
  const [health, setHealth] = useState<TransportHealth | null>(null);
  const [metrics, setMetrics] = useState<DerivedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a rolling window of messages-per-minute samples (last 10 polls)
  const [mpmHistory, setMpmHistory] = useState<number[]>([]);

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getTransportHealth();
      setHealth(data);
      const m = deriveMetrics(data);
      setMetrics(m);
      setMpmHistory((prev) => [...prev.slice(-9), m.messagesPerMinute]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load health data";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-9 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-card p-6 shadow">
              <div className="h-4 w-2/3 bg-muted rounded mb-3" />
              <div className="h-8 w-1/2 bg-muted rounded mb-2" />
              <div className="h-3 w-3/4 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-48" />
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-48" />
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Transport Health</h1>
        <div className="rounded-lg bg-destructive/10 p-6 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Transport Health</h1>
        <div className="flex items-center gap-3">
          {metrics && (
            <span className="text-xs text-muted-foreground">
              Updated {timeAgo(metrics.lastChecked)}
            </span>
          )}
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
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Wifi className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeSessions ?? 0}</div>
            <p className="text-xs text-muted-foreground">Transport connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {metrics?.healthySessions ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Passing health checks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {metrics?.errorSessions ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Sessions with errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Msgs/min</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.messagesPerMinute ?? 0}</div>
            <p className="text-xs text-muted-foreground">Recent throughput</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Circuit Breaker + Error Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Circuit Breaker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {metrics && <CircuitBreakerIndicator state={metrics.circuitBreakerState} />}

            <div className="space-y-4">
              <MetricBar
                label="Error Rate"
                value={Math.round((metrics?.errorRate ?? 0) * 100)}
                max={100}
                color={
                  (metrics?.errorRate ?? 0) < 0.3
                    ? "bg-green-500"
                    : (metrics?.errorRate ?? 0) < 0.8
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }
              />
              <MetricBar
                label="Healthy Sessions"
                value={metrics?.healthySessions ?? 0}
                max={metrics?.activeSessions ?? 1}
                color="bg-green-500"
              />
              <MetricBar
                label="Error Sessions"
                value={metrics?.errorSessions ?? 0}
                max={metrics?.activeSessions ?? 1}
                color="bg-red-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Throughput mini-chart */}
        <Card>
          <CardHeader>
            <CardTitle>Message Throughput</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{metrics?.messagesPerMinute ?? 0}</div>
              <p className="text-xs text-muted-foreground">messages in the last minute</p>
            </div>

            {mpmHistory.length > 1 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Recent samples (30s intervals)</p>
                <MiniBarChart
                  data={mpmHistory}
                  color="bg-primary"
                />
              </div>
            )}

            {mpmHistory.length <= 1 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Collecting throughput data... (samples every 30s)
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Errors */}
      {metrics && metrics.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop */}
            <div className="hidden md:block rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Level</th>
                    <th className="px-3 py-2 text-left font-medium">Message</th>
                    <th className="px-3 py-2 text-left font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentErrors.slice(0, 10).map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Badge variant="destructive">{log.level}</Badge>
                      </td>
                      <td className="px-3 py-2 max-w-md truncate">{log.message}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {timeAgo(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {metrics.recentErrors.slice(0, 10).map((log) => (
                <div key={log.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive">{log.level}</Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
                  </div>
                  <p className="text-sm break-words">{log.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
