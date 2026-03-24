"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  api,
  AutomationJob,
  AutomationStats,
  ClientLog,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type TabValue = "jobs" | "logs";

const STATUS_OPTIONS = ["pending", "completed", "failed", "in_progress"];
const LOG_LEVELS = ["info", "warn", "error", "debug"];

function statusBadgeVariant(status: string) {
  switch (status) {
    case "completed":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    case "pending":
      return "secondary" as const;
    case "in_progress":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function logLevelBadgeVariant(level: string) {
  switch (level) {
    case "error":
      return "destructive" as const;
    case "warn":
      return "secondary" as const;
    case "info":
      return "default" as const;
    case "debug":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

export default function AutomationJobsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>("jobs");

  // Stats
  const [stats, setStats] = useState<AutomationStats | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Logs state
  const [logs, setLogs] = useState<ClientLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getAutomationStats();
      setStats(data);
    } catch {
      // stats are non-critical
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    setError(null);
    try {
      const data = await api.getAutomationJobs({
        page: jobsPage,
        limit: pageSize,
        status: statusFilter || undefined,
      });
      setJobs(data.data);
      setJobsTotal(data.total);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load jobs";
      setError(message);
    } finally {
      setJobsLoading(false);
    }
  }, [jobsPage, statusFilter]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setError(null);
    try {
      const data = await api.getAutomationLogs({
        page: logsPage,
        limit: pageSize,
        level: levelFilter || undefined,
      });
      setLogs(data.data);
      setLogsTotal(data.total);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load logs";
      setError(message);
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, levelFilter]);

  // Load data based on active tab
  useEffect(() => {
    loadStats();
    if (activeTab === "jobs") {
      loadJobs();
    } else {
      loadLogs();
    }
  }, [activeTab, loadStats, loadJobs, loadLogs]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadStats();
        if (activeTab === "jobs") {
          loadJobs();
        } else {
          loadLogs();
        }
      }, 10000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, activeTab, loadStats, loadJobs, loadLogs]);

  const jobsTotalPages = Math.ceil(jobsTotal / pageSize);
  const logsTotalPages = Math.ceil(logsTotal / pageSize);
  const successRate =
    stats && stats.total > 0
      ? ((stats.completed / stats.total) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Automation Jobs</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.pending ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.completed ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.failed ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Auto-refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "jobs" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("jobs")}
          >
            Jobs
          </Button>
          <Button
            variant={activeTab === "logs" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("logs")}
          >
            Logs
          </Button>
        </div>
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

      {/* Jobs Tab */}
      {activeTab === "jobs" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Automation Jobs ({jobsTotal})</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Status</Label>
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(val) => {
                    setStatusFilter(val === "all" ? "" : val);
                    setJobsPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]" />
                    <TableHead>Status</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead>Targets</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : jobs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No jobs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => (
                      <>
                        <TableRow
                          key={job.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedJobId(
                              expandedJobId === job.id ? null : job.id
                            )
                          }
                        >
                          <TableCell className="text-center text-muted-foreground">
                            {expandedJobId === job.id ? "\u25BC" : "\u25B6"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(job.status)}>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px] truncate text-sm">
                              {job.text}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {job.targetChatIds.length} chat(s)
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(job.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(job.updatedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                        {expandedJobId === job.id && (
                          <TableRow key={`${job.id}-detail`}>
                            <TableCell colSpan={6}>
                              <div className="space-y-3 p-4 bg-muted/50 rounded-md">
                                <div>
                                  <span className="text-sm font-medium">
                                    ID:{" "}
                                  </span>
                                  <span className="text-sm font-mono">
                                    {job.id}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sm font-medium">
                                    Full Text:{" "}
                                  </span>
                                  <pre className="mt-1 text-sm whitespace-pre-wrap bg-background p-2 rounded border">
                                    {job.text}
                                  </pre>
                                </div>
                                <div>
                                  <span className="text-sm font-medium">
                                    Target Chat IDs:{" "}
                                  </span>
                                  <span className="text-sm font-mono">
                                    {job.targetChatIds.join(", ")}
                                  </span>
                                </div>
                                {job.results && (
                                  <div>
                                    <span className="text-sm font-medium">
                                      Results:{" "}
                                    </span>
                                    <pre className="mt-1 text-sm whitespace-pre-wrap bg-background p-2 rounded border">
                                      {JSON.stringify(job.results, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {jobsTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(jobsPage - 1) * pageSize + 1} to{" "}
                  {Math.min(jobsPage * pageSize, jobsTotal)} of {jobsTotal}{" "}
                  jobs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                    disabled={jobsPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setJobsPage((p) => Math.min(jobsTotalPages, p + 1))
                    }
                    disabled={jobsPage === jobsTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Client Logs ({logsTotal})</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Level</Label>
                <Select
                  value={levelFilter || "all"}
                  onValueChange={(val) => {
                    setLevelFilter(val === "all" ? "" : val);
                    setLogsPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {LOG_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant={logLevelBadgeVariant(log.level)}>
                            {log.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[500px] text-sm">
                            {log.message}
                          </div>
                          {log.details && (
                            <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap max-w-[500px]">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {logsTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(logsPage - 1) * pageSize + 1} to{" "}
                  {Math.min(logsPage * pageSize, logsTotal)} of {logsTotal}{" "}
                  logs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={logsPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLogsPage((p) => Math.min(logsTotalPages, p + 1))
                    }
                    disabled={logsPage === logsTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
