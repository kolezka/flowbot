"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  StatsResponse,
  AnalyticsOverview,
  AutomationStats,
  WarningStats,
  ModerationLog,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Shield, Zap, AlertTriangle, Activity,
  ArrowRight, Layers, Package, Trophy, BarChart3,
  Radio, CheckCircle, XCircle,
} from "lucide-react";

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

function actionBadgeVariant(action: string): "secondary" | "outline" | "destructive" | "default" {
  switch (action) {
    case "warn":
      return "secondary";
    case "mute":
      return "outline";
    case "ban":
    case "kick":
      return "destructive";
    case "unban":
      return "default";
    default:
      return "default";
  }
}

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description: string;
  variant?: "default" | "destructive" | "success" | "muted";
}

function KpiCard({ title, value, icon, description, variant = "default" }: KpiCardProps) {
  const iconColor =
    variant === "destructive"
      ? "text-destructive"
      : variant === "success"
        ? "text-green-600 dark:text-green-400"
        : variant === "muted"
          ? "text-muted-foreground"
          : "text-primary";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={iconColor}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function SuccessRateBar({ rate, label }: { rate: number; label: string }) {
  const pct = Math.round(rate * 100);
  const barColor =
    pct >= 90
      ? "bg-green-500"
      : pct >= 70
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [automationStats, setAutomationStats] = useState<AutomationStats | null>(null);
  const [warningStats, setWarningStats] = useState<WarningStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const results = await Promise.allSettled([
        api.getStats(),
        api.getAnalyticsOverview(),
        api.getAutomationStats(),
        api.getWarningStats(),
        api.getModerationLogs({ limit: 5 }),
      ]);

      if (results[0]?.status === "fulfilled") setStats(results[0].value);
      if (results[1]?.status === "fulfilled") setOverview(results[1].value);
      if (results[2]?.status === "fulfilled") setAutomationStats(results[2].value);
      if (results[3]?.status === "fulfilled") setWarningStats(results[3].value);
      if (results[4]?.status === "fulfilled") setRecentLogs(results[4].value.data);

      setLoading(false);
    }

    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-card p-6 shadow">
              <div className="h-4 w-2/3 bg-muted rounded mb-4" />
              <div className="h-8 w-1/2 bg-muted rounded mb-2" />
              <div className="h-3 w-3/4 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 animate-pulse rounded-xl border bg-card p-6 shadow h-64" />
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-64" />
        </div>
      </div>
    );
  }

  const totalProducts = stats?.totalUsers !== undefined ? undefined : undefined; // products not in stats
  const topGroups = overview?.groups
    ?.slice()
    .sort((a, b) => b.moderationToday - a.moderationToday)
    .slice(0, 3) ?? [];

  const automationTotal = automationStats?.total ?? 0;
  const automationSuccessRate =
    automationTotal > 0
      ? (automationStats?.completed ?? 0) / automationTotal
      : 1;

  return (
    <div className="space-y-8">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={<Users className="h-4 w-4" />}
          description="All registered users"
        />
        <KpiCard
          title="Total Products"
          value={stats?.totalMessages ?? 0}
          icon={<Package className="h-4 w-4" />}
          description="Total messages tracked"
          variant="muted"
        />
        <KpiCard
          title="Active Groups"
          value={overview?.totalGroups ?? 0}
          icon={<Layers className="h-4 w-4" />}
          description="Managed groups"
        />
        <KpiCard
          title="Active Warnings"
          value={warningStats?.activeWarnings ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          description="Currently active"
          variant="destructive"
        />
        <KpiCard
          title="Pending Jobs"
          value={automationStats?.pending ?? 0}
          icon={<Zap className="h-4 w-4" />}
          description="Awaiting processing"
        />
      </div>

      {/* Three-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Recent Moderation Activity (5 items) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Link href="/dashboard/moderation/logs">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No recent moderation activity.</p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">Action</th>
                        <th className="px-3 py-2 text-left font-medium">Actor</th>
                        <th className="px-3 py-2 text-left font-medium">Target</th>
                        <th className="px-3 py-2 text-left font-medium">Group</th>
                        <th className="px-3 py-2 text-left font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <Badge variant={actionBadgeVariant(log.action)}>
                              {log.action}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                            {log.actorId}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                            {log.targetId ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {log.group?.title ?? "-"}
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
                <div className="md:hidden space-y-3">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant={actionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(log.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Actor</span>
                        <span className="font-mono">{log.actorId}</span>
                      </div>
                      {log.targetId && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Target</span>
                          <span className="font-mono">{log.targetId}</span>
                        </div>
                      )}
                      {log.group?.title && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Group</span>
                          <span>{log.group.title}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Automation Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-muted-foreground">Completed</span>
                  </div>
                  <div className="text-xl font-bold">{automationStats?.completed ?? 0}</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-muted-foreground">Failed</span>
                  </div>
                  <div className="text-xl font-bold">{automationStats?.failed ?? 0}</div>
                </div>
              </div>
              <SuccessRateBar rate={automationSuccessRate} label="Success Rate" />
              <div className="text-xs text-muted-foreground">
                {automationTotal} total jobs processed
              </div>
            </CardContent>
          </Card>

          {/* Group Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Group Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No group data available.</p>
              ) : (
                <div className="space-y-4">
                  {topGroups.map((group) => (
                    <div key={group.groupId} className="space-y-1">
                      <div className="font-medium text-sm">{group.title}</div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{group.memberCount} members</Badge>
                        <Badge variant="secondary">{group.spamToday} spam</Badge>
                        <Badge variant="secondary">{group.moderationToday} mod actions</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Link href="/dashboard/moderation/groups">
                  <Button variant="outline" size="sm">
                    All groups <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/dashboard/moderation/groups">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Layers className="h-3 w-3" /> Groups
                  </Button>
                </Link>
                <Link href="/dashboard/products">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Package className="h-3 w-3" /> Products
                  </Button>
                </Link>
                <Link href="/dashboard/moderation/analytics">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <BarChart3 className="h-3 w-3" /> Analytics
                  </Button>
                </Link>
                <Link href="/dashboard/broadcast">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Radio className="h-3 w-3" /> Broadcast
                  </Button>
                </Link>
                <Link href="/dashboard/automation/jobs">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Zap className="h-3 w-3" /> Jobs
                  </Button>
                </Link>
                <Link href="/dashboard/community/reputation">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Trophy className="h-3 w-3" /> Reputation
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
