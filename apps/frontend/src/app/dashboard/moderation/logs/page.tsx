"use client";

import { useEffect, useState } from "react";
import { api, ModerationLog } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExportButton } from "@/components/export-button";
import { ResponsiveTable, Column } from "@/components/responsive-table";

const ACTION_TYPES = [
  "warn", "mute", "unmute", "kick", "ban", "unban",
  "delete_message", "restrict", "unrestrict", "filter_triggered",
];

const actionBadgeVariant = (action: string) => {
  switch (action) {
    case "ban":
    case "kick":
      return "destructive" as const;
    case "warn":
    case "mute":
    case "restrict":
      return "secondary" as const;
    case "unban":
    case "unmute":
    case "unrestrict":
      return "default" as const;
    default:
      return "outline" as const;
  }
};

export default function ModerationLogsPage() {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const pageSize = 20;

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, startDate, endDate]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getModerationLogs({
        page,
        limit: pageSize,
        action: actionFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLogs(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load logs";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedLogs = [...logs].sort((a, b) => {
    const aVal = a[sortField as keyof ModerationLog];
    const bVal = b[sortField as keyof ModerationLog];
    if (aVal === undefined || bVal === undefined) return 0;
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const sortIndicator = (field: string) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const logColumns: Column<ModerationLog>[] = [
    {
      header: `Action${sortIndicator("action")}`,
      accessor: (log) => (
        <div className="flex items-center gap-1">
          <Badge variant={actionBadgeVariant(log.action)}>
            {log.action}
          </Badge>
          {log.automated && (
            <Badge variant="outline">Auto</Badge>
          )}
        </div>
      ),
      headerClassName: "cursor-pointer select-none",
    },
    {
      header: `Actor${sortIndicator("actorId")}`,
      accessor: "actorId",
      cellClassName: "font-mono text-xs",
      headerClassName: "cursor-pointer select-none",
    },
    {
      header: `Target${sortIndicator("targetId")}`,
      accessor: (log) => log.targetId || "-",
      cellClassName: "font-mono text-xs",
      headerClassName: "cursor-pointer select-none",
    },
    {
      header: "Reason",
      accessor: (log) => (
        <div className="max-w-[200px] truncate text-sm">
          {log.reason || "-"}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      header: "Group",
      accessor: (log) => log.group?.title || "-",
      cellClassName: "text-sm",
    },
    {
      header: `Time${sortIndicator("createdAt")}`,
      accessor: (log) => new Date(log.createdAt).toLocaleString(),
      cellClassName: "text-sm text-muted-foreground whitespace-nowrap",
      headerClassName: "cursor-pointer select-none",
    },
  ];

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Moderation Logs</h1>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select
                value={actionFilter}
                onValueChange={(val) => {
                  setActionFilter(val === "all" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {ACTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-[180px]"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActionFilter("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
            <ExportButton
              endpoint="/api/moderation/logs/export"
              filename={`moderation-logs-${new Date().toISOString().slice(0, 10)}`}
              filters={{
                action: actionFilter || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Moderation Logs ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          <ResponsiveTable
            columns={logColumns}
            data={sortedLogs}
            keyExtractor={(log) => log.id}
            loading={loading}
            emptyMessage="No moderation logs found"
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, total)} of {total} logs
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
