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
  ModerationLogsResponse,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Shield, Zap, AlertTriangle, Activity,
  ArrowRight, Layers, Package, Trophy, BarChart3,
  Radio, Eye,
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
  value: number;
  icon: React.ReactNode;
  description: string;
}

function KpiCard({ title, value, icon, description }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
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
        api.getModerationLogs({ limit: 10 }),
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
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const topGroups = overview?.groups
    ?.slice()
    .sort((a, b) => b.moderationToday - a.moderationToday)
    .slice(0, 3) ?? [];

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
          title="Active Groups"
          value={overview?.totalGroups ?? 0}
          icon={<Layers className="h-4 w-4" />}
          description="Managed groups"
        />
        <KpiCard
          title="Messages Today"
          value={overview?.totalMessagesToday ?? 0}
          icon={<Activity className="h-4 w-4" />}
          description="Across all groups"
        />
        <KpiCard
          title="Active Warnings"
          value={warningStats?.activeWarnings ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          description="Currently active"
        />
        <KpiCard
          title="Pending Jobs"
          value={automationStats?.pending ?? 0}
          icon={<Zap className="h-4 w-4" />}
          description="Awaiting processing"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Recent Moderation Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Moderation Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent moderation activity.</p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Action</th>
                      <th className="px-3 py-2 text-left font-medium">Actor ID</th>
                      <th className="px-3 py-2 text-left font-medium">Target ID</th>
                      <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Group</th>
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
                        <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                          {log.group?.title ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {timeAgo(log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4">
              <Link href="/dashboard/moderation/logs">
                <Button variant="outline" size="sm">
                  View all logs <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Group Health */}
          <Card>
            <CardHeader>
              <CardTitle>Group Health</CardTitle>
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
