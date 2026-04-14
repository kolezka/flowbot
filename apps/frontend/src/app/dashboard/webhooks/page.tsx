"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { WebhookEndpoint } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Plus, Copy, Trash2, Globe } from "lucide-react";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    api.getWebhooks().then(setWebhooks).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName) return;
    const webhook = await api.createWebhook({ name: newName });
    setWebhooks([webhook, ...webhooks]);
    setNewName("");
    setShowCreate(false);
  };

  const handleDelete = async (id: string) => {
    await api.deleteWebhook(id);
    setWebhooks(webhooks.filter((w) => w.id !== id));
  };

  const copyUrl = (token: string) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/incoming/${token}`;
    navigator.clipboard.writeText(url);
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Webhook</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex items-end gap-3 pt-6">
            <div className="flex-1"><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My webhook" /></div>
            <Button onClick={handleCreate}>Create</Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {webhooks.map((webhook) => (
          <Card key={webhook.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{webhook.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">...{webhook.token.slice(-12)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{webhook.callCount} calls</span>
                <Badge variant={webhook.isActive ? "default" : "secondary"}>{webhook.isActive ? "Active" : "Inactive"}</Badge>
                <Button variant="ghost" size="icon" onClick={() => copyUrl(webhook.token)} title="Copy URL"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(webhook.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {webhooks.length === 0 && (
          <EmptyState
            icon={Globe}
            title="No webhooks yet"
            description="Create a webhook to receive external events"
          />
        )}
      </div>
    </div>
  );
}
