"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, OrderEvent } from "@/lib/api";
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

const EVENT_TYPE_OPTIONS = ["order_placed", "order_shipped"];

function processedBadgeVariant(processed: boolean) {
  return processed ? ("default" as const) : ("secondary" as const);
}

export default function OrderEventsPage() {
  // Events state
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [processedFilter, setProcessedFilter] = useState<string>("");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrderEvents({
        page,
        limit: pageSize,
        eventType: eventTypeFilter || undefined,
        processed:
          processedFilter === "processed"
            ? true
            : processedFilter === "pending"
              ? false
              : undefined,
      });
      setEvents(data.data);
      setTotal(data.total);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load order events";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, eventTypeFilter, processedFilter]);

  // Load data
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadEvents();
      }, 10000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, loadEvents]);

  const totalPages = Math.ceil(total / pageSize);

  function truncateJson(data: unknown, maxLen = 80): string {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + "...";
  }

  return (
    <div className="space-y-4">
      {/* Header + Auto-refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order Events</h1>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Events ({total})</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Event Type</Label>
                <Select
                  value={eventTypeFilter || "all"}
                  onValueChange={(val) => {
                    setEventTypeFilter(val === "all" ? "" : val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {EVENT_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Status</Label>
                <Select
                  value={processedFilter || "all"}
                  onValueChange={(val) => {
                    setProcessedFilter(val === "all" ? "" : val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]" />
                  <TableHead>Event Type</TableHead>
                  <TableHead>Order Preview</TableHead>
                  <TableHead>Targets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No order events found
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <>
                      <TableRow
                        key={event.id}
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedEventId(
                            expandedEventId === event.id ? null : event.id
                          )
                        }
                      >
                        <TableCell className="text-center text-muted-foreground">
                          {expandedEventId === event.id ? "\u25BC" : "\u25B6"}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">
                            {event.eventType}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px] truncate text-sm text-muted-foreground font-mono">
                            {truncateJson(event.orderData)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {event.targetChatIds.length} chat(s)
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={processedBadgeVariant(event.processed)}
                          >
                            {event.processed ? "Processed" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(event.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                      {expandedEventId === event.id && (
                        <TableRow key={`${event.id}-detail`}>
                          <TableCell colSpan={6}>
                            <div className="space-y-3 p-4 bg-muted/50 rounded-md">
                              <div>
                                <span className="text-sm font-medium">
                                  ID:{" "}
                                </span>
                                <span className="text-sm font-mono">
                                  {event.id}
                                </span>
                              </div>
                              {event.jobId && (
                                <div>
                                  <span className="text-sm font-medium">
                                    Job ID:{" "}
                                  </span>
                                  <span className="text-sm font-mono">
                                    {event.jobId}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-sm font-medium">
                                  Order Data:{" "}
                                </span>
                                <pre className="mt-1 text-sm whitespace-pre-wrap bg-background p-2 rounded border">
                                  {JSON.stringify(event.orderData, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <span className="text-sm font-medium">
                                  Target Chat IDs:{" "}
                                </span>
                                <span className="text-sm font-mono">
                                  {event.targetChatIds.join(", ")}
                                </span>
                              </div>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, total)} of {total} events
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
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
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
