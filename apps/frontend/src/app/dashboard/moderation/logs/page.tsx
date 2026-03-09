"use client";

import { useEffect, useState } from "react";
import { api, ModerationLog } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ACTION_TYPES = [
  "warn", "mute", "unmute", "kick", "ban", "unban",
  "delete_message", "restrict", "unrestrict", "filter_triggered",
];

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

  const sortIndicator = (field: string) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("action")}
                  >
                    Action{sortIndicator("action")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("actorId")}
                  >
                    Actor{sortIndicator("actorId")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("targetId")}
                  >
                    Target{sortIndicator("targetId")}
                  </TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("createdAt")}
                  >
                    Time{sortIndicator("createdAt")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : sortedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No moderation logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={actionBadgeVariant(log.action)}>
                            {log.action}
                          </Badge>
                          {log.automated && (
                            <Badge variant="outline">Auto</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.actorId}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.targetId || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm">
                          {log.reason || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.group?.title || "-"}
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
