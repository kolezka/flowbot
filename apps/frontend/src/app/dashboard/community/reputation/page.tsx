"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  LeaderboardEntry,
  LeaderboardResponse,
  ManagedGroup,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function ScoreBar({ entry }: { entry: LeaderboardEntry }) {
  const total =
    entry.messageFactor +
    entry.tenureFactor +
    entry.warningPenalty +
    entry.moderationBonus;

  if (total === 0) return <div className="h-2 w-full rounded bg-muted" />;

  const pct = (val: number) => Math.max((val / total) * 100, 0);

  return (
    <div className="flex h-2 w-full overflow-hidden rounded">
      {entry.messageFactor > 0 && (
        <div
          className="bg-blue-500"
          style={{ width: `${pct(entry.messageFactor)}%` }}
          title={`Messages: ${entry.messageFactor}`}
        />
      )}
      {entry.tenureFactor > 0 && (
        <div
          className="bg-green-500"
          style={{ width: `${pct(entry.tenureFactor)}%` }}
          title={`Tenure: ${entry.tenureFactor}`}
        />
      )}
      {entry.warningPenalty > 0 && (
        <div
          className="bg-red-500"
          style={{ width: `${pct(entry.warningPenalty)}%` }}
          title={`Warnings: -${entry.warningPenalty}`}
        />
      )}
      {entry.moderationBonus > 0 && (
        <div
          className="bg-purple-500"
          style={{ width: `${pct(entry.moderationBonus)}%` }}
          title={`Moderation: +${entry.moderationBonus}`}
        />
      )}
    </div>
  );
}

export default function ReputationLeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [groups, setGroups] = useState<ManagedGroup[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGroups({ limit: 100 })
      .then((res) => setGroups(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [groupId]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getReputationLeaderboard({
        limit: 50,
        groupId: groupId || undefined,
      });
      setData(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load leaderboard";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reputation</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Scored Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.stats.averageScore ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Median Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.stats.medianScore ?? "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={groupId || "all"}
                onValueChange={(val) => setGroupId(val === "all" ? "" : val)}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.title || g.chatId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
          Messages
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
          Tenure
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
          Warnings
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-500" />
          Moderation
        </div>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Reputation Leaderboard{data ? ` (${data.total})` : ""}
          </CardTitle>
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
                  <TableHead className="w-[60px]">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="w-[100px] text-right">Score</TableHead>
                  <TableHead className="w-[200px]">Breakdown</TableHead>
                  <TableHead className="w-[80px] text-right">Msg</TableHead>
                  <TableHead className="w-[80px] text-right">Tenure</TableHead>
                  <TableHead className="w-[80px] text-right">Warn</TableHead>
                  <TableHead className="w-[80px] text-right">Mod</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : !data || data.entries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No reputation data found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.entries.map((entry) => (
                    <TableRow key={entry.telegramId}>
                      <TableCell className="font-mono text-center">
                        {entry.rank}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/users/${entry.telegramId}/profile`}
                          className="hover:underline"
                        >
                          <div className="font-medium">
                            {entry.firstName || entry.username || "Unknown"}
                          </div>
                          {entry.username && (
                            <div className="text-xs text-muted-foreground">
                              @{entry.username}
                            </div>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${scoreColor(entry.totalScore)}`}
                      >
                        {entry.totalScore}
                      </TableCell>
                      <TableCell>
                        <ScoreBar entry={entry} />
                      </TableCell>
                      <TableCell className="text-right text-sm text-blue-600 dark:text-blue-400">
                        {entry.messageFactor}
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-600 dark:text-green-400">
                        {entry.tenureFactor}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600 dark:text-red-400">
                        {entry.warningPenalty > 0
                          ? `-${entry.warningPenalty}`
                          : "0"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-purple-600 dark:text-purple-400">
                        {entry.moderationBonus > 0
                          ? `+${entry.moderationBonus}`
                          : "0"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
