"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { TransportHealth, ClientLog } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wifi,
  Pause,
  Play,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DerivedMetrics {
  activeSessions: number;
  healthySessions: number;
  errorSessions: number;
  errorRate: number;
  circuitBreakerState: "closed" | "open" | "half-open" | "unknown";
  recentLogs: ClientLog[];
  messagesPerMinute: number;
  lastChecked: string;
}

interface TimeSample {
  time: string;
  mpm: number;
  errors: number;
  latency: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveMetrics(health: TransportHealth): DerivedMetrics {
  const total = health.activeSessions || 1;
  const errorRate = total > 0 ? health.errorSessions / total : 0;

  let circuitBreakerState: DerivedMetrics["circuitBreakerState"] = "closed";
  if (errorRate >= 0.8) {
    circuitBreakerState = "open";
  } else if (errorRate >= 0.3) {
    circuitBreakerState = "half-open";
  }

  const now = Date.now();
  const recentWindow =
    health.recentLogs?.filter(
      (l) => now - new Date(l.createdAt).getTime() < 60_000
    ) ?? [];
  const messagesPerMinute = recentWindow.length;

  return {
    activeSessions: health.activeSessions,
    healthySessions: health.healthySessions,
    errorSessions: health.errorSessions,
    errorRate,
    circuitBreakerState,
    recentLogs: health.recentLogs ?? [],
    messagesPerMinute,
    lastChecked: health.lastChecked,
  };
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Chart color constants (CSS variable-aware)
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  healthy: "hsl(142, 71%, 45%)",
  error: "hsl(0, 84%, 60%)",
  primary: "hsl(var(--primary))",
  muted: "hsl(var(--muted))",
  foreground: "hsl(var(--foreground))",
  mutedForeground: "hsl(var(--muted-foreground))",
};

const PIE_COLORS = [CHART_COLORS.healthy, CHART_COLORS.error, CHART_COLORS.muted];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CircuitBreakerIndicator({
  state,
}: {
  state: DerivedMetrics["circuitBreakerState"];
}) {
  const config = {
    closed: {
      label: "Closed (Healthy)",
      dotColor: "bg-green-500",
      badge: "default" as const,
      icon: CheckCircle,
    },
    "half-open": {
      label: "Half-Open (Testing)",
      dotColor: "bg-yellow-500",
      badge: "secondary" as const,
      icon: AlertTriangle,
    },
    open: {
      label: "Open (Tripped)",
      dotColor: "bg-red-500",
      badge: "destructive" as const,
      icon: XCircle,
    },
    unknown: {
      label: "Unknown",
      dotColor: "bg-muted-foreground",
      badge: "outline" as const,
      icon: Activity,
    },
  }[state];

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div className={`h-4 w-4 rounded-full ${config.dotColor} animate-pulse`} />
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        <Badge variant={config.badge} className="mt-1">
          {state}
        </Badge>
      </div>
    </div>
  );
}

function SessionDonutChart({
  healthy,
  errors,
  inactive,
}: {
  healthy: number;
  errors: number;
  inactive: number;
}) {
  const data = [
    { name: "Healthy", value: healthy },
    { name: "Error", value: errors },
    ...(inactive > 0 ? [{ name: "Inactive", value: inactive }] : []),
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    data.push({ name: "No sessions", value: 1 });
  }

  const total = healthy + errors;

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              color: "hsl(var(--foreground))",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-sm text-muted-foreground mt-1">
        {total} active session{total !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function ThroughputChart({ data }: { data: TimeSample[] }) {
  return (
    <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
      <LineChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
        />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
          }}
        />
        <Line
          type="monotone"
          dataKey="mpm"
          name="Msgs/min"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ErrorRateChart({ data }: { data: TimeSample[] }) {
  return (
    <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
      <AreaChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
        />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
          }}
        />
        <Area
          type="monotone"
          dataKey="errors"
          name="Errors"
          stroke={CHART_COLORS.error}
          fill={CHART_COLORS.error}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function LatencyChart({ data }: { data: TimeSample[] }) {
  return (
    <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
      <LineChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
        />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
          unit="ms"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
          }}
          formatter={(value) => [`${value}ms`, "Latency"]}
        />
        <Line
          type="monotone"
          dataKey="latency"
          name="Latency"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function LogLevelBadge({ level }: { level: string }) {
  const variant =
    level === "error"
      ? "destructive"
      : level === "warn"
        ? "secondary"
        : "outline";
  return <Badge variant={variant as "destructive" | "secondary" | "outline"}>{level}</Badge>;
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeSeries, setTimeSeries] = useState<TimeSample[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await api.getTransportHealth();
        setHealth(data);
        const m = deriveMetrics(data);
        setMetrics(m);

        // Build a time-series sample from the current poll
        const errorLogs =
          data.recentLogs?.filter((l) => l.level === "error") ?? [];
        // Simulate latency from log timing spread (ms between first and last log)
        let latency = 0;
        if (data.recentLogs && data.recentLogs.length >= 2) {
          const times = data.recentLogs.map((l) =>
            new Date(l.createdAt).getTime()
          );
          const spread = Math.max(...times) - Math.min(...times);
          latency = Math.round(spread / Math.max(data.recentLogs.length, 1));
        }

        const sample: TimeSample = {
          time: formatTime(new Date().toISOString()),
          mpm: m.messagesPerMinute,
          errors: errorLogs.length,
          latency,
        };
        setTimeSeries((prev) => [...prev.slice(-119), sample]);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load health data";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchHealth(true), 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchHealth]);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-9 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border bg-card p-6 shadow"
            >
              <div className="h-4 w-2/3 bg-muted rounded mb-3" />
              <div className="h-8 w-1/2 bg-muted rounded mb-2" />
              <div className="h-3 w-3/4 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-64" />
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-64" />
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-64" />
        </div>
        <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-48" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
            onClick={() => setAutoRefresh((prev) => !prev)}
            title={autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
          >
            {autoRefresh ? (
              <Pause className="mr-2 h-3 w-3" />
            ) : (
              <Play className="mr-2 h-3 w-3" />
            )}
            {autoRefresh ? "Auto" : "Paused"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
            />
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
            <CardTitle className="text-sm font-medium">
              Active Sessions
            </CardTitle>
            <Wifi className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.activeSessions ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Transport connections
            </p>
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
            <p className="text-xs text-muted-foreground">
              Passing health checks
            </p>
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
            <p className="text-xs text-muted-foreground">
              Sessions with errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Msgs/min</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.messagesPerMinute ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Recent throughput</p>
          </CardContent>
        </Card>
      </div>

      {/* Session Health Donut + Circuit Breaker */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session Health Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionDonutChart
              healthy={metrics?.healthySessions ?? 0}
              errors={metrics?.errorSessions ?? 0}
              inactive={0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Circuit Breaker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {metrics && (
              <CircuitBreakerIndicator state={metrics.circuitBreakerState} />
            )}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Error Rate</span>
                  <span className="font-medium">
                    {Math.round((metrics?.errorRate ?? 0) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      (metrics?.errorRate ?? 0) < 0.3
                        ? "bg-green-500"
                        : (metrics?.errorRate ?? 0) < 0.8
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.round((metrics?.errorRate ?? 0) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Healthy Sessions
                  </span>
                  <span className="font-medium">
                    {metrics?.healthySessions ?? 0} /{" "}
                    {metrics?.activeSessions ?? 0}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all duration-500"
                    style={{
                      width: `${
                        (metrics?.activeSessions ?? 0) > 0
                          ? Math.round(
                              ((metrics?.healthySessions ?? 0) /
                                (metrics?.activeSessions ?? 1)) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Throughput + Error Rate */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Message Throughput</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeries.length > 1 ? (
              <ThroughputChart data={timeSeries} />
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                Collecting throughput data... (samples every 30s)
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeries.length > 1 ? (
              <ErrorRateChart data={timeSeries} />
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                Collecting error data... (samples every 30s)
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latency Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Response Latency</CardTitle>
        </CardHeader>
        <CardContent>
          {timeSeries.length > 1 ? (
            <LatencyChart data={timeSeries} />
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
              Collecting latency data... (samples every 30s)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Logs */}
      {metrics && metrics.recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop table */}
            <div className="hidden md:block rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Level</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Message
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentLogs.slice(0, 10).map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <LogLevelBadge level={log.level} />
                      </td>
                      <td className="px-3 py-2 max-w-md truncate">
                        {log.message}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {timeAgo(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {metrics.recentLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <LogLevelBadge level={log.level} />
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(log.createdAt)}
                    </span>
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
