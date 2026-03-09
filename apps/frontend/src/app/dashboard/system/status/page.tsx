"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, SystemStatus, SystemComponent } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const STATUS_COLORS: Record<string, string> = {
  up: "bg-green-500",
  degraded: "bg-yellow-500",
  down: "bg-red-500",
  unreachable: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  up: "Operational",
  degraded: "Degraded",
  down: "Down",
  unreachable: "Unreachable",
};

const BANNER_STYLES: Record<string, string> = {
  up: "bg-green-50 border-green-200 text-green-800",
  degraded: "bg-yellow-50 border-yellow-200 text-yellow-800",
  down: "bg-red-50 border-red-200 text-red-800",
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString();
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${STATUS_COLORS[status] || "bg-gray-400"}`}
    />
  );
}

function ComponentCard({ component }: { component: SystemComponent }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base">{component.name}</h3>
          <div className="flex items-center gap-2">
            <StatusDot status={component.status} />
            <Badge
              variant={component.status === "up" ? "secondary" : "destructive"}
            >
              {STATUS_LABELS[component.status] || component.status}
            </Badge>
          </div>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          {component.uptime !== undefined && (
            <p>Uptime: {formatUptime(component.uptime)}</p>
          )}
          <p>Checked: {formatTime(component.lastChecked)}</p>
          {component.error && (
            <p className="text-red-600">Error: {component.error}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.getSystemStatus();
      setStatus(data);
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load system status";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadStatus, 30000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, loadStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading system status...</div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">System Status</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(checked === true)}
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              Auto-refresh (30s)
            </Label>
          </div>
          <button
            onClick={loadStatus}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Refresh now
          </button>
        </div>
      </div>

      {/* Overall Status Banner */}
      {status && (
        <div
          className={`rounded-lg border p-4 ${BANNER_STYLES[status.overall] || BANNER_STYLES.down}`}
        >
          <div className="flex items-center gap-3">
            <StatusDot status={status.overall} />
            <span className="font-semibold text-lg">
              {status.overall === "up"
                ? "All Systems Operational"
                : status.overall === "degraded"
                  ? "Some Systems Degraded"
                  : "System Outage Detected"}
            </span>
          </div>
          <p className="mt-1 text-sm opacity-75">
            Last checked: {formatTime(status.lastChecked)}
          </p>
        </div>
      )}

      {/* Component Status Cards */}
      {status && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {status.components.map((component) => (
            <ComponentCard key={component.name} component={component} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          Last refresh failed: {error}
        </div>
      )}
    </div>
  );
}
