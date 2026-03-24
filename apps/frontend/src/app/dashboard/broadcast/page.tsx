"use client";

import { useEffect, useState } from "react";
import { api, Broadcast, Community, MultiPlatformBroadcast } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AVAILABLE_PLATFORMS = ["telegram", "discord"] as const;
type Platform = typeof AVAILABLE_PLATFORMS[number];

export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<MultiPlatformBroadcast[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Create form state
  const [text, setText] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["telegram"]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    loadBroadcasts();
  }, [page]);

  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  useEffect(() => {
    loadCommunities();
  }, [selectedPlatforms]);

  const loadBroadcasts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMultiPlatformBroadcasts({ page, limit: pageSize });
      setBroadcasts(data.data);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to load broadcasts");
    } finally {
      setLoading(false);
    }
  };

  const loadCommunities = async () => {
    setCommunitiesLoading(true);
    try {
      const results: Community[] = [];
      for (const platform of selectedPlatforms) {
        const data = await api.getCommunities({ platform, limit: 100, isActive: true });
        results.push(...data.data);
      }
      setCommunities(results);
      // Remove deselected communities when platform changes
      setSelectedCommunities((prev) =>
        prev.filter((id) => results.some((c) => c.id === id)),
      );
    } catch {
      // silently ignore — not critical
    } finally {
      setCommunitiesLoading(false);
    }
  };

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  };

  const toggleCommunity = (id: string) => {
    setSelectedCommunities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || selectedPlatforms.length === 0 || selectedCommunities.length === 0) return;

    setSubmitting(true);
    try {
      await api.createMultiPlatformBroadcast({
        content: { text: text.trim() },
        platforms: selectedPlatforms,
        targetCommunities: selectedCommunities,
      });
      setText("");
      setSelectedCommunities([]);
      setActionFeedback("Broadcast created successfully");
      loadBroadcasts();
    } catch (err: any) {
      alert(err.message || "Failed to create broadcast");
    } finally {
      setSubmitting(false);
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      case "failed":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const platformBadgeVariant = (platform: string) => {
    switch (platform) {
      case "telegram":
        return "secondary" as const;
      case "discord":
        return "outline" as const;
      default:
        return "outline" as const;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Broadcast</h1>

      {actionFeedback && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
          {actionFeedback}
        </div>
      )}

      {/* Create Broadcast Form */}
      <Card>
        <CardHeader>
          <CardTitle>New Broadcast</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Platform selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Platforms</label>
              <div className="flex gap-4">
                {AVAILABLE_PLATFORMS.map((platform) => (
                  <label key={platform} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(platform)}
                      onChange={() => togglePlatform(platform)}
                      className="rounded"
                    />
                    <span className="text-sm capitalize">{platform}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Message text */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Message Text
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (structured content with media/embed supported via API)
                </span>
              </label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Enter broadcast message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
            </div>

            {/* Community picker */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Target Communities
                {communitiesLoading && (
                  <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
                )}
              </label>
              {communities.length === 0 && !communitiesLoading ? (
                <p className="text-sm text-muted-foreground">
                  No active communities found for the selected platform(s).
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                  {communities.map((community) => (
                    <label
                      key={community.id}
                      className="flex items-center gap-2 cursor-pointer rounded p-1 hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCommunities.includes(community.id)}
                        onChange={() => toggleCommunity(community.id)}
                        className="rounded"
                      />
                      <span className="text-sm flex-1">
                        {community.name || community.platformCommunityId}
                      </span>
                      <Badge variant={platformBadgeVariant(community.platform)} className="text-xs">
                        {community.platform}
                      </Badge>
                    </label>
                  ))}
                </div>
              )}
              {selectedCommunities.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedCommunities.length} community/communities selected
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={
                submitting ||
                selectedPlatforms.length === 0 ||
                selectedCommunities.length === 0
              }
            >
              {submitting ? "Creating..." : "Create Broadcast"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Broadcast List */}
      <Card>
        <CardHeader>
          <CardTitle>Broadcasts</CardTitle>
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
                  <TableHead>ID</TableHead>
                  <TableHead>Text</TableHead>
                  <TableHead>Platforms</TableHead>
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
                ) : broadcasts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No broadcasts found
                    </TableCell>
                  </TableRow>
                ) : (
                  broadcasts.map((broadcast) => (
                    <TableRow key={broadcast.id}>
                      <TableCell className="font-mono text-xs">
                        {broadcast.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[280px] truncate">
                          {broadcast.content.text}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {broadcast.platforms.map((p) => (
                            <Badge key={p} variant={platformBadgeVariant(p)} className="text-xs capitalize">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{broadcast.targetCommunities.length} communities</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(broadcast.status)}>
                          {broadcast.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(broadcast.createdAt).toLocaleString()}
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
                {Math.min(page * pageSize, total)} of {total} broadcasts
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
