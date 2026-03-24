"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BotInstance } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Bot, Plus } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { validateBotToken } from "@/lib/token-validation";

export default function BotConfigPage() {
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("telegram");
  const [botToken, setBotToken] = useState("");
  const [tokenHint, setTokenHint] = useState<string | null>(null);

  const loadBots = useCallback(async () => {
    try {
      const data = await api.getBotInstances();
      setBots(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load bots");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  const resetForm = () => {
    setName("");
    setPlatform("telegram");
    setBotToken("");
    setTokenHint(null);
  };

  const handleClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createBotInstance({
        name: name.trim(),
        platform,
        botToken: botToken.trim() || undefined,
      });
      toast.success("Bot created successfully");
      handleClose();
      await loadBots();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create bot");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 shadow">
              <Skeleton className="mb-3 h-5 w-32" />
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bot Configuration</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Add Bot
        </Button>
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
          <p className="text-sm text-muted-foreground mt-1">Add a bot instance to get started</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Add your first bot
          </Button>
        </div>
      )}

      <DialogContent open={dialogOpen} onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Add Bot</DialogTitle>
          <DialogDescription>Create a new bot instance. For Telegram bots, provide the token from @BotFather.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bot-name">Name</Label>
            <Input
              id="bot-name"
              placeholder="My Bot"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bot-platform">Platform</Label>
            <Select value={platform} onValueChange={(v) => { setPlatform(v); setTokenHint(validateBotToken(v, botToken)); }}>
              <SelectTrigger id="bot-platform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bot-token">Bot Token</Label>
            <Input
              id="bot-token"
              placeholder={platform === "telegram" ? "123456789:AABBccDDee..." : "Discord bot token"}
              value={botToken}
              onChange={(e) => {
                setBotToken(e.target.value);
                setTokenHint(validateBotToken(platform, e.target.value));
              }}
            />
            {tokenHint && botToken.trim() && (
              <p className="text-xs text-amber-600">{tokenHint}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? "Creating..." : "Create Bot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </div>
  );
}
