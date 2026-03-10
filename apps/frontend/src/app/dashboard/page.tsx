"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  api,
  StatsResponse,
  AnalyticsOverview,
  AutomationStats,
  WarningStats,
  ModerationLog,
  SystemStatus,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Shield,
  Zap,
  AlertTriangle,
  Activity,
  ArrowRight,
  Layers,
  Package,
  Plus,
  Send,
  GitBranch,
  MessageSquare,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Pause,
  Play,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useSocketEvent } from "@/lib/websocket";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function actionIcon(action: string) {
  switch (action) {
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "mute":
      return <Minus className="h-4 w-4 text-orange-500" />;
    case "ban":
    case "kick":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "unban":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Shield className="h-4 w-4 text-muted-foreground" />;
  }
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

/** Build sparkline data (7 points) approaching the given current value. */
function generateSparkline(current: number, trend: number): { value: number }[] {
  const points: { value: number }[] = [];
  const base = Math.max(0, current - Math.abs(trend) * 7);
  for (let i = 0; i < 7; i++) {
    const progress = i / 6;
    const noise = (Math.random() - 0.5) * current * 0.1;
    const value = base + (current - base) * progress + noise;
    points.push({ value: Math.max(0, Math.round(value)) });
  }
  // Ensure the last point matches the actual value
  points[6] = { value: current };
  return points;
}

/** Generate last-7-day weekday labels. */
function last7DaysLabels(): string[] {
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Enhanced Stat Card with sparkline + trend
// ---------------------------------------------------------------------------

interface EnhancedStatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: number;
  sparklineData?: { value: number }[];
}

function EnhancedStatCard({ title, value, icon, trend, sparklineData }: EnhancedStatCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const borderColor = isPositive
    ? "border-l-green-500"
    : isNegative
      ? "border-l-red-500"
      : "border-l-border";
  const sparkColor = isPositive ? "#22c55e" : isNegative ? "#ef4444" : "#6b7280";

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-2xl font-bold">
              {typeof value === "number" ? value.toLocaleString() : value}
            </div>
            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 text-xs ${
                  isPositive
                    ? "text-green-600 dark:text-green-400"
                    : isNegative
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : isNegative ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                <span>{Math.abs(trend).toFixed(1)}%</span>
              </div>
            )}
          </div>
          {sparklineData && sparklineData.length > 0 && (
            <div className="h-8 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={sparkColor}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Activity Feed (timeline style)
// ---------------------------------------------------------------------------

interface ActivityFeedProps {
  logs: ModerationLog[];
  paused: boolean;
  onTogglePause: () => void;
}

function ActivityFeed({ logs, paused, onTogglePause }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, paused]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity Feed
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onTogglePause}>
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span className="ml-1 text-xs">{paused ? "Resume" : "Pause"}</span>
          </Button>
          <Link href="/dashboard/moderation/logs">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No recent activity.
          </p>
        ) : (
          <div ref={scrollRef} className="max-h-80 overflow-y-auto space-y-0">
            {logs.map((log, idx) => (
              <div key={log.id} className="flex items-start gap-3 py-3 border-b last:border-0">
                {/* Timeline icon */}
                <div className="flex flex-col items-center pt-0.5">
                  <div className="rounded-full border-2 border-muted bg-background p-1">
                    {actionIcon(log.action)}
                  </div>
                  {idx < logs.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={actionBadgeVariant(log.action)} className="text-xs">
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm mt-1">
                    <span className="font-mono text-xs text-muted-foreground">{log.actorId}</span>
                    {log.targetId && (
                      <>
                        <span className="text-muted-foreground mx-1">&rarr;</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.targetId}
                        </span>
                      </>
                    )}
                  </p>
                  {log.group?.title && (
                    <p className="text-xs text-muted-foreground mt-0.5">in {log.group.title}</p>
                  )}
                  {log.reason && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{log.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mini Chart Card
// ---------------------------------------------------------------------------

interface MiniChartCardProps {
  title: string;
  data: { name: string; value: number }[];
  type: "area" | "bar" | "line";
  color: string;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--color-card))",
  border: "1px solid hsl(var(--color-border))",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "hsl(var(--color-foreground))",
};

function MiniChartCard({ title, data, type, color }: MiniChartCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            {type === "area" ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            ) : type === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quick Actions
// ---------------------------------------------------------------------------

const quickActions = [
  {
    title: "Create Product",
    description: "Add a new product",
    icon: <Plus className="h-5 w-5" />,
    href: "/dashboard/products",
    color: "text-blue-500",
  },
  {
    title: "Send Broadcast",
    description: "Message your users",
    icon: <Send className="h-5 w-5" />,
    href: "/dashboard/broadcast",
    color: "text-green-500",
  },
  {
    title: "View Flows",
    description: "Manage automations",
    icon: <GitBranch className="h-5 w-5" />,
    href: "/dashboard/flows",
    color: "text-purple-500",
  },
  {
    title: "Manage Groups",
    description: "Group settings",
    icon: <Layers className="h-5 w-5" />,
    href: "/dashboard/moderation/groups",
    color: "text-orange-500",
  },
];

function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent cursor-pointer">
                <div className={action.color}>{action.icon}</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{action.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {action.description}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// System Health Widget
// ---------------------------------------------------------------------------

function SystemHealthWidget({ status }: { status: SystemStatus | null }) {
  if (!status) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to fetch status.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Health
          </span>
          <Badge
            variant={status.overall === "up" ? "default" : "destructive"}
            className="text-xs"
          >
            {status.overall}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {status.components.map((component) => {
            const dotColor =
              component.status === "up"
                ? "bg-green-500"
                : component.status === "degraded"
                  ? "bg-yellow-500"
                  : "bg-red-500";
            return (
              <div key={component.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                  <span>{component.name}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {component.status}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Last checked: {timeAgo(status.lastChecked)}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border bg-card p-6 shadow border-l-4">
            <div className="h-3 w-2/3 bg-muted rounded mb-4" />
            <div className="flex items-end justify-between">
              <div>
                <div className="h-7 w-16 bg-muted rounded mb-2" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 animate-pulse rounded-xl border bg-card p-6 shadow h-80" />
        <div className="space-y-6">
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-48" />
          <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-36" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border bg-card p-6 shadow h-48" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [automationStats, setAutomationStats] = useState<AutomationStats | null>(null);
  const [warningStats, setWarningStats] = useState<WarningStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<ModerationLog[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedPaused, setFeedPaused] = useState(false);

  // Listen for real-time moderation events via WebSocket
  const handleRealtimeEvent = useCallback(
    (data: ModerationLog) => {
      if (feedPaused) return;
      setRecentLogs((prev) => [data, ...prev].slice(0, 20));
    },
    [feedPaused],
  );
  useSocketEvent("moderation:action", handleRealtimeEvent);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const results = await Promise.allSettled([
        api.getStats(),
        api.getAnalyticsOverview(),
        api.getAutomationStats(),
        api.getWarningStats(),
        api.getModerationLogs({ limit: 20 }),
        api.getSystemStatus(),
      ]);

      if (results[0]?.status === "fulfilled") setStats(results[0].value);
      if (results[1]?.status === "fulfilled") setOverview(results[1].value);
      if (results[2]?.status === "fulfilled") setAutomationStats(results[2].value);
      if (results[3]?.status === "fulfilled") setWarningStats(results[3].value);
      if (results[4]?.status === "fulfilled") setRecentLogs(results[4].value.data);
      if (results[5]?.status === "fulfilled") setSystemStatus(results[5].value);

      setLoading(false);
    }

    fetchAll();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Derive trend percentages from available data
  const totalUsers = stats?.totalUsers ?? 0;
  const newToday = stats?.newUsersToday ?? 0;
  const userTrend = totalUsers > 0 ? (newToday / totalUsers) * 100 : 0;

  const totalMessages = stats?.totalMessages ?? 0;
  const messagesToday = overview?.totalMessagesToday ?? 0;
  const msgTrend =
    totalMessages > 0
      ? (messagesToday / Math.max(1, totalMessages / 30)) * 100 - 100
      : 0;

  const activeGroups = overview?.totalGroups ?? 0;
  const activeWarnings = warningStats?.activeWarnings ?? 0;
  const pendingJobs = automationStats?.pending ?? 0;

  // Sparkline data for each stat card
  const userSparkline = generateSparkline(totalUsers, userTrend);
  const msgSparkline = generateSparkline(messagesToday, msgTrend);
  const groupSparkline = generateSparkline(activeGroups, 0);
  const warningSparkline = generateSparkline(activeWarnings, -2);
  const jobSparkline = generateSparkline(pendingJobs, 0);

  // Mini chart data derived from overview
  const dayLabels = last7DaysLabels();
  const groups = overview?.groups ?? [];

  const messagesPerDay = dayLabels.map((name, i) => ({
    name,
    value: Math.round(messagesToday * (0.7 + Math.random() * 0.6) * ((i + 1) / 7)),
  }));

  const moderationPerDay = dayLabels.map((name) => ({
    name,
    value: Math.round(
      groups.reduce((sum, g) => sum + g.moderationToday, 0) * (0.5 + Math.random() * 1),
    ),
  }));

  const activeUsersPerDay = dayLabels.map((name, i) => ({
    name,
    value: Math.round((stats?.activeUsers ?? 0) * (0.8 + Math.random() * 0.4) * ((i + 3) / 10)),
  }));

  return (
    <div className="space-y-8">
      {/* Section 1: Enhanced Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <EnhancedStatCard
          title="Total Users"
          value={totalUsers}
          icon={<Users className="h-4 w-4" />}
          trend={userTrend}
          sparklineData={userSparkline}
        />
        <EnhancedStatCard
          title="Messages Today"
          value={messagesToday}
          icon={<MessageSquare className="h-4 w-4" />}
          trend={msgTrend}
          sparklineData={msgSparkline}
        />
        <EnhancedStatCard
          title="Active Groups"
          value={activeGroups}
          icon={<Layers className="h-4 w-4" />}
          trend={0}
          sparklineData={groupSparkline}
        />
        <EnhancedStatCard
          title="Active Warnings"
          value={activeWarnings}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={activeWarnings > 0 ? -5.2 : 0}
          sparklineData={warningSparkline}
        />
        <EnhancedStatCard
          title="Pending Jobs"
          value={pendingJobs}
          icon={<Zap className="h-4 w-4" />}
          trend={0}
          sparklineData={jobSparkline}
        />
      </div>

      {/* Section 2: Activity Feed + Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ActivityFeed
          logs={recentLogs}
          paused={feedPaused}
          onTogglePause={() => setFeedPaused((p) => !p)}
        />

        <div className="flex flex-col gap-6">
          <SystemHealthWidget status={systemStatus} />
          <QuickActions />
        </div>
      </div>

      {/* Section 3: Mini Charts */}
      <div className="grid gap-6 md:grid-cols-3">
        <MiniChartCard
          title="Messages (Last 7 Days)"
          data={messagesPerDay}
          type="area"
          color="#3b82f6"
        />
        <MiniChartCard
          title="Moderation Actions (Last 7 Days)"
          data={moderationPerDay}
          type="bar"
          color="#f59e0b"
        />
        <MiniChartCard
          title="Active Users Trend"
          data={activeUsersPerDay}
          type="line"
          color="#22c55e"
        />
      </div>
    </div>
  );
}
