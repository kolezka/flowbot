"use client";

import { useEffect, useState } from "react";
import {
  api,
  AnalyticsOverview,
  AnalyticsSummary,
  GroupOverviewItem,
  AggregatedPeriod,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/export-button";

function PeriodTable({ period, label }: { period: AggregatedPeriod; label: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{label}</h4>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-1 text-muted-foreground">Messages</td>
            <td className="py-1 text-right font-medium">{period.totalMessages.toLocaleString()}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 text-muted-foreground">Member Growth</td>
            <td className="py-1 text-right font-medium">
              <span className={period.memberGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                {period.memberGrowth >= 0 ? "+" : ""}{period.memberGrowth}
              </span>
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-1 text-muted-foreground">Spam Detected</td>
            <td className="py-1 text-right font-medium">{period.totalSpam}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 text-muted-foreground">Links Blocked</td>
            <td className="py-1 text-right font-medium">{period.totalLinksBlocked}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 text-muted-foreground">Warnings</td>
            <td className="py-1 text-right font-medium">{period.totalWarnings}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 text-muted-foreground">Mutes</td>
            <td className="py-1 text-right font-medium">{period.totalMutes}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 text-muted-foreground">Bans</td>
            <td className="py-1 text-right font-medium">{period.totalBans}</td>
          </tr>
          <tr>
            <td className="py-1 text-muted-foreground">Deleted Messages</td>
            <td className="py-1 text-right font-medium">{period.totalDeleted}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadSummary(selectedGroupId);
    } else {
      setSummary(null);
    }
  }, [selectedGroupId]);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAnalyticsOverview();
      setOverview(data);
      if (data.groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(data.groups[0]!.groupId);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load analytics";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async (groupId: string) => {
    setSummaryLoading(true);
    try {
      const data = await api.getAnalyticsSummary(groupId);
      setSummary(data);
    } catch (err: unknown) {
      console.error("Failed to load group summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading analytics...</div>
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

  if (!overview) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Groups</p>
            <p className="text-2xl font-bold">{overview.totalGroups}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Members</p>
            <p className="text-2xl font-bold">
              {overview.totalMembers.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Messages Today</p>
            <p className="text-2xl font-bold">
              {overview.totalMessagesToday.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Spam Today</p>
            <p className="text-2xl font-bold text-red-600">
              {overview.totalSpamToday}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Moderation Today</p>
            <p className="text-2xl font-bold">
              {overview.totalModerationToday}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Groups Table */}
      <Card>
        <CardHeader>
          <CardTitle>Group Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.groups.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 font-medium">Group</th>
                  <th className="py-2 font-medium text-right">Members</th>
                  <th className="py-2 font-medium text-right">Messages</th>
                  <th className="py-2 font-medium text-right">Spam</th>
                  <th className="py-2 font-medium text-right">Moderation</th>
                  <th className="py-2 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {overview.groups.map((group: GroupOverviewItem) => (
                  <tr key={group.groupId} className="border-b">
                    <td className="py-2">{group.title}</td>
                    <td className="py-2 text-right">{group.memberCount}</td>
                    <td className="py-2 text-right">{group.messagesToday}</td>
                    <td className="py-2 text-right">
                      {group.spamToday > 0 ? (
                        <Badge variant="destructive">{group.spamToday}</Badge>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="py-2 text-right">{group.moderationToday}</td>
                    <td className="py-2 text-right">
                      <Button
                        variant={
                          selectedGroupId === group.groupId
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedGroupId(group.groupId)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active groups with analytics data.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Group Summary */}
      {selectedGroupId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {summary ? summary.groupTitle : "Loading..."} — Detailed Summary
              </CardTitle>
              <ExportButton
                endpoint={`/api/analytics/groups/${selectedGroupId}/export`}
                filename={`analytics-${selectedGroupId}-${new Date().toISOString().slice(0, 10)}`}
              />
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <p className="text-muted-foreground">Loading summary...</p>
            ) : summary ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Badge variant="secondary">
                    Current Members: {summary.currentMemberCount}
                  </Badge>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  <PeriodTable period={summary.last7d} label="Last 7 Days" />
                  <PeriodTable period={summary.last30d} label="Last 30 Days" />
                  <PeriodTable period={summary.allTime} label="All Time" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a group to view its summary.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
