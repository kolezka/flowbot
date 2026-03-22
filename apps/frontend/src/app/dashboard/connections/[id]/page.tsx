"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PlatformConnectionType, BotInstance } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformBadge } from "@/components/platform-badge";
import { ArrowLeft, Trash2, Plus } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    active: { variant: "default", label: "Active" },
    error: { variant: "destructive", label: "Error" },
    inactive: { variant: "secondary", label: "Inactive" },
    authenticating: { variant: "outline", label: "Authenticating" },
  };
  const config = variants[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getConnectionTypeLabel(connectionType: string): string {
  switch (connectionType) {
    case "mtproto": return "Telegram User Account (MTProto)";
    case "bot_token": return "Bot Token";
    case "oauth": return "OAuth";
    case "baileys": return "WhatsApp (Baileys)";
    case "api_key": return "API Key";
    default: return connectionType;
  }
}

// ---------------------------------------------------------------------------
// Scope editor — shown only for bot_token connections with a botInstanceId
// ---------------------------------------------------------------------------

function ScopeEditor({ botInstanceId }: { botInstanceId: string }) {
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [newGroupId, setNewGroupId] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getBotInstance(botInstanceId).then((bot: BotInstance) => {
      const scope = bot.metadata?.scope as { groupIds?: string[]; userIds?: string[] } | undefined;
      if (scope) {
        setGroupIds(scope.groupIds ?? []);
        setUserIds(scope.userIds ?? []);
      }
    }).catch(() => {});
  }, [botInstanceId]);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      await api.updateBotScope(botInstanceId, { groupIds, userIds });
      setSaved(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save scope";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const addGroupId = () => {
    const trimmed = newGroupId.trim();
    if (trimmed && !groupIds.includes(trimmed)) {
      setGroupIds([...groupIds, trimmed]);
      setSaved(false);
    }
    setNewGroupId("");
  };

  const removeGroupId = (id: string) => {
    setGroupIds(groupIds.filter((g) => g !== id));
    setSaved(false);
  };

  const addUserId = () => {
    const trimmed = newUserId.trim();
    if (trimmed && !userIds.includes(trimmed)) {
      setUserIds([...userIds, trimmed]);
      setSaved(false);
    }
    setNewUserId("");
  };

  const removeUserId = (id: string) => {
    setUserIds(userIds.filter((u) => u !== id));
    setSaved(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bot Scope Configuration</CardTitle>
        <CardDescription>
          Restrict which groups and users this bot responds to. Leave both lists empty to allow all.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Group IDs */}
        <div className="space-y-2">
          <Label>Allowed Group IDs</Label>
          <div className="space-y-1">
            {groupIds.length === 0 && (
              <p className="text-sm text-muted-foreground">No groups scoped — bot responds in all groups.</p>
            )}
            {groupIds.map((id) => (
              <div key={id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5">
                <span className="text-sm font-mono">{id}</span>
                <button
                  type="button"
                  onClick={() => removeGroupId(id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove group ${id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Group chat ID (e.g. -1001234567890)"
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGroupId(); } }}
            />
            <Button variant="outline" size="sm" onClick={addGroupId} disabled={!newGroupId.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* User IDs */}
        <div className="space-y-2">
          <Label>Allowed User IDs</Label>
          <div className="space-y-1">
            {userIds.length === 0 && (
              <p className="text-sm text-muted-foreground">No users scoped — bot responds to all users.</p>
            )}
            {userIds.map((id) => (
              <div key={id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5">
                <span className="text-sm font-mono">{id}</span>
                <button
                  type="button"
                  onClick={() => removeUserId(id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove user ${id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="User ID (e.g. 123456789)"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUserId(); } }}
            />
            <Button variant="outline" size="sm" onClick={addUserId} disabled={!newUserId.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-green-600">Scope saved successfully.</p>}

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Scope"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main detail page
// ---------------------------------------------------------------------------

export default function ConnectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [connection, setConnection] = useState<PlatformConnectionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api.getConnection(params.id)
      .then(setConnection)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load connection";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDeactivate = async () => {
    if (!connection) return;
    setDeactivating(true);
    try {
      const updated = await api.deactivateConnection(connection.id);
      setConnection(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to deactivate connection";
      setError(msg);
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/connections" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Connections
        </Link>
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error ?? "Connection not found."}
        </div>
      </div>
    );
  }

  const showScopeEditor =
    connection.connectionType === "bot_token" && !!connection.botInstanceId;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/dashboard/connections" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Connections
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{connection.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {getConnectionTypeLabel(connection.connectionType)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PlatformBadge platform={connection.platform} />
          {statusBadge(connection.status)}
        </div>
      </div>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono">{connection.id}</span>

            <span className="text-muted-foreground">Platform</span>
            <span className="capitalize">{connection.platform}</span>

            <span className="text-muted-foreground">Type</span>
            <span>{getConnectionTypeLabel(connection.connectionType)}</span>

            <span className="text-muted-foreground">Status</span>
            <span>{statusBadge(connection.status)}</span>

            <span className="text-muted-foreground">Error count</span>
            <span>{connection.errorCount}</span>

            {connection.lastErrorMessage && (
              <>
                <span className="text-muted-foreground">Last error</span>
                <span className="text-destructive text-xs">{connection.lastErrorMessage}</span>
              </>
            )}

            {connection.lastActiveAt && (
              <>
                <span className="text-muted-foreground">Last active</span>
                <span>{new Date(connection.lastActiveAt).toLocaleString()}</span>
              </>
            )}

            <span className="text-muted-foreground">Created</span>
            <span>{new Date(connection.createdAt).toLocaleString()}</span>
          </div>

          {connection.status === "active" && (
            <div className="pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? "Deactivating..." : "Deactivate Connection"}
              </Button>
            </div>
          )}

          {connection.status !== "active" && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/connections/auth")}
              >
                Re-authenticate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bot scope section */}
      {showScopeEditor && (
        <ScopeEditor botInstanceId={connection.botInstanceId!} />
      )}
    </div>
  );
}
