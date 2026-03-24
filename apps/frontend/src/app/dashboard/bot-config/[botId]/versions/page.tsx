"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BotInstance, BotConfigVersion } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Clock, Package, Hash, FileText, LayoutGrid, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function VersionsPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [bot, setBot] = useState<BotInstance | null>(null);
  const [versions, setVersions] = useState<BotConfigVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [botData, versionData] = await Promise.all([
        api.getBotInstance(botId),
        api.getBotConfigVersions(botId).catch(() => [] as BotConfigVersion[]),
      ]);
      setBot(botData);
      setVersions(versionData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await api.publishBotConfig(botId);
      if (bot) setBot({ ...bot, configVersion: result.version });
      const updatedVersions = await api.getBotConfigVersions(botId).catch(() => [] as BotConfigVersion[]);
      setVersions(updatedVersions);
      toast.success(`Config published as v${result.version}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to publish config");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-muted rounded" />
          <div className="h-8 w-48 bg-muted rounded" />
        </div>
        <div className="h-32 bg-muted rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!bot) return <p className="py-8 text-center text-muted-foreground">Bot not found</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/bot-config/${botId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="text-sm text-muted-foreground">{bot.name} &middot; @{bot.botUsername || "unknown"}</p>
        </div>
        <Button onClick={handlePublish} disabled={publishing}>
          <Save className="mr-2 h-4 w-4" />
          {publishing ? "Publishing..." : "Publish New Version"}
        </Button>
      </div>

      {/* Current Version Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Package className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Version</p>
              <p className="text-3xl font-bold">v{bot.configVersion}</p>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Last updated</p>
            <p className="font-medium text-foreground">{new Date(bot.updatedAt).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Published Versions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 text-lg font-medium text-muted-foreground">No versions published yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Click &quot;Publish New Version&quot; to create the first version snapshot.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => {
                const isCurrent = v.version === bot.configVersion;
                const isExpanded = expandedVersion === v.version;
                const snapshot = (v as any).snapshot;

                return (
                  <div key={v.version}>
                    <button
                      onClick={() => setExpandedVersion(isExpanded ? null : v.version)}
                      className="flex w-full items-center justify-between rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">v{v.version}</span>
                            {isCurrent && (
                              <Badge variant="default" className="text-xs">Current</Badge>
                            )}
                          </div>
                          {v.publishedAt && (
                            <p className="text-xs text-muted-foreground">
                              Published {new Date(v.publishedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {v.publishedBy && (
                          <span className="text-sm text-muted-foreground">by {v.publishedBy}</span>
                        )}
                        <svg
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && snapshot && (
                      <div className="ml-12 mt-2 mb-2 rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-3">Config snapshot at time of publish</p>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{snapshot.commands}</p>
                              <p className="text-xs text-muted-foreground">Commands</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{snapshot.responses}</p>
                              <p className="text-xs text-muted-foreground">Responses</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{snapshot.menus}</p>
                              <p className="text-xs text-muted-foreground">Menus</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {isExpanded && !snapshot && (
                      <div className="ml-12 mt-2 mb-2 rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">No snapshot data available for this version.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
