"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { FlowGlobalAnalytics } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Workflow,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type DateRange = 7 | 30 | 90;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 bg-muted rounded-xl" />
        <div className="h-80 bg-muted rounded-xl" />
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}

export default function FlowAnalyticsPage() {
  const [data, setData] = useState<FlowGlobalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<DateRange>(30);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getFlowGlobalAnalytics(days)
      .then(setData)
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load analytics";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.dailyStats.map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Flow Analytics</h1>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Executions
                </p>
                <p className="text-2xl font-bold">
                  {data.totalExecutions.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{data.successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {formatDuration(data.avgDurationMs)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Workflow className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Flows</p>
                <p className="text-2xl font-bold">
                  {data.activeFlowsCount}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {data.totalFlowsCount}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Executions Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Executions Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {data.totalExecutions === 0 ? (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                No execution data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    name="Total"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Success vs Failure */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Success vs Failure</CardTitle>
          </CardHeader>
          <CardContent>
            {data.totalExecutions === 0 ? (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                No execution data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0}>
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="completed"
                    stackId="a"
                    fill="#22c55e"
                    name="Completed"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="failed"
                    stackId="a"
                    fill="#ef4444"
                    name="Failed"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Flows Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <CardTitle className="text-base">Top Flows</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {data.topFlows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No flow executions in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">Flow</th>
                    <th className="py-2 font-medium text-center">Status</th>
                    <th className="py-2 font-medium text-right">Executions</th>
                    <th className="py-2 font-medium text-right">
                      Success Rate
                    </th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topFlows.map((flow) => (
                    <tr key={flow.flowId} className="border-b">
                      <td className="py-2 font-medium">{flow.name}</td>
                      <td className="py-2 text-center">
                        <Badge
                          variant={
                            flow.status === "active" ? "default" : "secondary"
                          }
                        >
                          {flow.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {flow.executions.toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={
                            flow.successRate >= 90
                              ? "text-green-600"
                              : flow.successRate >= 70
                                ? "text-amber-600"
                                : "text-red-600"
                          }
                        >
                          {flow.successRate}%
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Link href={`/dashboard/flows/${flow.flowId}/edit`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Distribution */}
      {data.commonErrors.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <CardTitle className="text-base">Common Errors</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.commonErrors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                >
                  <code className="text-xs text-muted-foreground break-all">
                    {err.error}
                  </code>
                  <Badge variant="destructive" className="shrink-0">
                    {err.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
