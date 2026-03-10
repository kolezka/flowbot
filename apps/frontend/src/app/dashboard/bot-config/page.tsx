"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BotInstance } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";

export default function BotConfigPage() {
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBotInstances().then(setBots).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bot Configuration</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bots.map((bot) => (
          <Link key={bot.id} href={`/dashboard/bot-config/${bot.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{bot.name}</CardTitle>
                  </div>
                  <Badge variant={bot.isActive ? "default" : "secondary"}>{bot.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">@{bot.botUsername || "unknown"}</p>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span>{bot._count?.commands ?? 0} commands</span>
                  <span>{bot._count?.responses ?? 0} responses</span>
                  <span>v{bot.configVersion}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {bots.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No bots configured</h3>
          <p className="text-sm text-muted-foreground mt-1">Bot instances will appear here once registered</p>
        </div>
      )}
    </div>
  );
}
