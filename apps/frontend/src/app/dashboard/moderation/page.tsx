"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ModerationLogStats, WarningStats, ManagedGroup, ModerationLog } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ModerationOverviewPage() {
  const [groups, setGroups] = useState<ManagedGroup[]>([]);
  const [groupCount, setGroupCount] = useState(0);
  const [logStats, setLogStats] = useState<ModerationLogStats | null>(null);
  const [warningStats, setWarningStats] = useState<WarningStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsRes, logStatsRes, warningStatsRes, recentLogsRes] =
        await Promise.all([
          api.getGroups({ page: 1, limit: 5 }),
          api.getModerationLogStats(),
          api.getWarningStats(),
          api.getModerationLogs({ page: 1, limit: 5 }),
        ]);
      setGroups(groupsRes.data);
      setGroupCount(groupsRes.total);
      setLogStats(logStatsRes);
      setWarningStats(warningStatsRes);
      setRecentLogs(recentLogsRes.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load moderation data";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading moderation overview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Managed Groups</p>
            <p className="text-2xl font-bold">{groupCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Actions</p>
            <p className="text-2xl font-bold">{logStats?.totalActions ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active Warnings</p>
            <p className="text-2xl font-bold">{warningStats?.activeWarnings ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Automated Actions</p>
            <p className="text-2xl font-bold">{logStats?.automatedCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Type Breakdown */}
      {logStats?.actionsByType && Object.keys(logStats.actionsByType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Actions by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(logStats.actionsByType).map(([action, count]) => (
                <div
                  key={action}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <Badge variant="secondary">{action}</Badge>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Groups */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Groups</CardTitle>
            <Link href="/dashboard/moderation/groups">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {groups.length > 0 ? (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{group.title || `Chat ${group.chatId}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.memberCount} members
                      </p>
                    </div>
                    <Badge variant={group.isActive ? "default" : "secondary"}>
                      {group.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No managed groups.</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Actions</CardTitle>
            <Link href="/dashboard/moderation/logs">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentLogs.length > 0 ? (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.automated ? "secondary" : "default"}>
                          {log.action}
                        </Badge>
                        {log.automated && <Badge variant="outline">Auto</Badge>}
                      </div>
                      {log.reason && (
                        <p className="text-xs text-muted-foreground">{log.reason}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent actions.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
