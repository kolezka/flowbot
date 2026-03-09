"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, HealthResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function formatUptime(seconds?: number): string {
  if (!seconds) return "N/A";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function statusColor(status: string): string {
  switch (status) {
    case "healthy":
      return "bg-green-500/15 text-green-700 border-green-500/30";
    case "degraded":
      return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    case "unreachable":
      return "bg-red-500/15 text-red-700 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "healthy":
      return "default";
    case "degraded":
      return "secondary";
    case "unreachable":
      return "destructive";
    default:
      return "outline";
  }
}

export default function AutomationHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const data = await api.getAutomationHealth();
      setHealth(data);
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load health data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadHealth();
      }, 10000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, loadHealth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading health data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with auto-refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">TG Client Health</h2>
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-refresh"
            checked={autoRefresh}
            onCheckedChange={(checked) => setAutoRefresh(checked === true)}
          />
          <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
            Auto-refresh (10s)
          </Label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {health && (
        <>
          {/* Overall Status Banner */}
          <div
            className={`rounded-lg border p-4 ${statusColor(health.status)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={statusBadgeVariant(health.status)}>
                  {health.status.toUpperCase()}
                </Badge>
                <span className="text-sm font-medium">
                  Overall System Status
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Last checked:{" "}
                {new Date(health.lastChecked).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* TG Client Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  TG Client Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Reachable</span>
                  <Badge
                    variant={
                      health.tgClient.reachable ? "default" : "destructive"
                    }
                  >
                    {health.tgClient.reachable ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Transport</span>
                  <span className="text-sm font-mono">
                    {health.tgClient.transport ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Session Valid</span>
                  <Badge
                    variant={
                      health.tgClient.sessionValid === true
                        ? "default"
                        : health.tgClient.sessionValid === false
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {health.tgClient.sessionValid === true
                      ? "Valid"
                      : health.tgClient.sessionValid === false
                        ? "Invalid"
                        : "N/A"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Uptime</span>
                  <span className="text-sm font-mono">
                    {formatUptime(health.tgClient.uptime)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Session Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Session Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Session Exists</span>
                  <Badge
                    variant={
                      health.session?.exists ? "default" : "destructive"
                    }
                  >
                    {health.session?.exists ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active</span>
                  <Badge
                    variant={
                      health.session?.isActive ? "default" : "destructive"
                    }
                  >
                    {health.session?.isActive ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Last Used</span>
                  <span className="text-sm text-muted-foreground">
                    {health.session?.lastUsedAt
                      ? new Date(health.session.lastUsedAt).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Last Updated</span>
                  <span className="text-sm text-muted-foreground">
                    {health.session?.updatedAt
                      ? new Date(health.session.updatedAt).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Job Throughput - Last Hour */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Job Throughput - Last Hour
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total</span>
                  <span className="text-2xl font-bold">
                    {health.jobMetrics.last1h.total}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="text-lg font-semibold text-green-600">
                    {health.jobMetrics.last1h.completed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Failed</span>
                  <span className="text-lg font-semibold text-red-600">
                    {health.jobMetrics.last1h.failed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Success Rate</span>
                  <span className="text-lg font-semibold">
                    {health.jobMetrics.successRate1h}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Job Throughput - Last 24h */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Job Throughput - Last 24h
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total</span>
                  <span className="text-2xl font-bold">
                    {health.jobMetrics.last24h.total}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="text-lg font-semibold text-green-600">
                    {health.jobMetrics.last24h.completed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Failed</span>
                  <span className="text-lg font-semibold text-red-600">
                    {health.jobMetrics.last24h.failed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Success Rate</span>
                  <span className="text-lg font-semibold">
                    {health.jobMetrics.successRate24h}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
