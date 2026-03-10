"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { BotInstance } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export default function BotDetailPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [bot, setBot] = useState<BotInstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBotInstance(botId).then(setBot).catch(console.error).finally(() => setLoading(false));
  }, [botId]);

  const handlePublish = async () => {
    const result = await api.publishBotConfig(botId);
    if (bot) setBot({ ...bot, configVersion: result.version });
  };

  if (loading) return <div className="animate-pulse h-64 bg-muted rounded-xl" />;
  if (!bot) return <p>Bot not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{bot.name}</h1>
          <p className="text-muted-foreground">@{bot.botUsername || "unknown"} &middot; v{bot.configVersion}</p>
        </div>
        <Button onClick={handlePublish}><Save className="mr-2 h-4 w-4" />Publish Config</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Commands</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {bot.commands?.map((cmd) => (
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Responses ({bot.responses?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {bot.responses?.map((resp) => (
              <div key={resp.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <span className="font-mono text-sm">{resp.key}</span>
                  <Badge variant="secondary" className="ml-2">{resp.locale}</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate max-w-xs">{resp.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
