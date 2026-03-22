"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, BotInstance } from "@/lib/api";
import { usePlatform } from "@/lib/platform-context";
import { PlatformBadge } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateCommunityPage() {
  const router = useRouter();
  const { platform, queryParam } = usePlatform();
  const [name, setName] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [selectedBot, setSelectedBot] = useState("");
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (queryParam) {
      api.getBotInstances({ platform: queryParam }).then(setBots).catch(() => {});
    }
  }, [queryParam]);

  const handleSubmit = async () => {
    if (!queryParam || platform === "all") {
      setError("Please select a specific platform from the nav filter first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.createCommunity({
        platform: queryParam,
        platformCommunityId: platformId,
        name,
        botInstanceId: selectedBot || undefined,
      });
      router.push("/dashboard/communities");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create community";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Add Community</h1>
      <Card>
        <CardHeader>
          <CardTitle>Community Details</CardTitle>
          <CardDescription>
            Add a group or community manually. Platform is set from the nav filter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Platform</Label>
            <div className="mt-1">
              {queryParam ? (
                <PlatformBadge platform={queryParam} />
              ) : (
                <p className="text-sm text-destructive">Select a platform from the nav filter</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Community"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="platformId">Platform ID</Label>
            <Input
              id="platformId"
              placeholder="Group/Chat ID"
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bot">Connected Bot (optional)</Label>
            <select
              id="bot"
              value={selectedBot}
              onChange={(e) => setSelectedBot(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">None</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} {bot.botUsername ? `(@${bot.botUsername})` : ""}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleSubmit}
            disabled={!name || !platformId || !queryParam || platform === "all" || loading}
          >
            {loading ? "Creating..." : "Create Community"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
