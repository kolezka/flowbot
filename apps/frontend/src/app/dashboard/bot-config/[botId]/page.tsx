"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BotInstance, BotConfigVersion } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save, Terminal, MessageSquare, LayoutGrid, Globe, Clock } from "lucide-react";

export default function BotDetailPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [bot, setBot] = useState<BotInstance | null>(null);
  const [versions, setVersions] = useState<BotConfigVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getBotInstance(botId),
      api.getBotConfigVersions(botId).catch(() => [] as BotConfigVersion[]),
    ])
      .then(([botData, versionData]) => {
        setBot(botData);
        setVersions(versionData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [botId]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await api.publishBotConfig(botId);
      if (bot) setBot({ ...bot, configVersion: result.version });
      const updatedVersions = await api.getBotConfigVersions(botId).catch(() => [] as BotConfigVersion[]);
      setVersions(updatedVersions);
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div className="animate-pulse h-64 bg-muted rounded-xl" />;
  if (!bot) return <p>Bot not found</p>;

  const subPages = [
    { label: "Commands", href: `/dashboard/bot-config/${botId}/commands`, icon: Terminal, count: bot.commands?.length ?? bot._count?.commands ?? 0 },
    { label: "Responses", href: `/dashboard/bot-config/${botId}/responses`, icon: MessageSquare, count: bot.responses?.length ?? bot._count?.responses ?? 0 },
    { label: "Menus", href: `/dashboard/bot-config/${botId}/menus`, icon: LayoutGrid, count: bot.menus?.length ?? bot._count?.menus ?? 0 },
    { label: "i18n Strings", href: `/dashboard/bot-config/${botId}/i18n`, icon: Globe, count: null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{bot.name}</h1>
          <p className="text-muted-foreground">@{bot.botUsername || "unknown"} &middot; v{bot.configVersion}</p>
        </div>
        <Button onClick={handlePublish} disabled={publishing}>
          <Save className="mr-2 h-4 w-4" />
          {publishing ? "Publishing..." : "Publish Config"}
        </Button>
      </div>

      {/* Sub-page navigation */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {subPages.map((page) => (
          <Link key={page.href} href={page.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-3 py-4">
                <page.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{page.label}</p>
                  {page.count !== null && (
                    <p className="text-xs text-muted-foreground">{page.count} items</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Commands summary */}
      <Card>
        <CardHeader><CardTitle>Commands</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {bot.commands?.slice(0, 5).map((cmd) => (
              <div key={cmd.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <span className="font-mono text-sm">/{cmd.command}</span>
                  {cmd.description && <span className="ml-2 text-sm text-muted-foreground">{cmd.description}</span>}
                </div>
                <Badge variant={cmd.isEnabled ? "default" : "secondary"}>
                  {cmd.isEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            ))}
            {(!bot.commands || bot.commands.length === 0) && (
              <p className="py-4 text-center text-muted-foreground">No commands configured</p>
            )}
            {bot.commands && bot.commands.length > 5 && (
              <Link href={`/dashboard/bot-config/${botId}/commands`} className="block text-center text-sm text-primary hover:underline py-2">
                View all {bot.commands.length} commands
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Responses summary */}
      <Card>
        <CardHeader><CardTitle>Responses ({bot.responses?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {bot.responses?.slice(0, 5).map((resp) => (
              <div key={resp.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <span className="font-mono text-sm">{resp.key}</span>
                  <Badge variant="secondary" className="ml-2">{resp.locale}</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate max-w-xs">{resp.text}</p>
              </div>
            ))}
            {bot.responses && bot.responses.length > 5 && (
              <Link href={`/dashboard/bot-config/${botId}/responses`} className="block text-center text-sm text-primary hover:underline py-2">
                View all {bot.responses.length} responses
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Menus summary */}
      <Card>
        <CardHeader><CardTitle>Menus ({bot.menus?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {bot.menus?.map((menu) => (
              <div key={menu.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{menu.name}</p>
                <p className="text-xs text-muted-foreground">{menu.buttons.length} buttons</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No versions published yet. Click &quot;Publish Config&quot; to create the first version.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.version} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={v.version === bot.configVersion ? "default" : "secondary"}>
                      v{v.version}
                    </Badge>
                    {v.version === bot.configVersion && (
                      <span className="text-xs text-green-600 font-medium">Current</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Published {new Date(v.publishedAt).toLocaleString()}
                    {v.publishedBy && <span className="ml-2">by {v.publishedBy}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
