"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionCard } from "./ConnectionCard";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/get-error-message";

interface Connection {
  id: string;
  name: string;
  platform: string;
  connectionType: string;
  status: string;
  lastActiveAt?: string;
  errorCount?: number;
  error?: string;
  botInstanceId?: string;
}

interface HealthSummary {
  total: number;
  active: number;
  error: number;
  inactive: number;
}

interface ConnectionHubProps {
  onNewConnection: () => void;
  onReauth: (id: string) => void;
  onConfigureScope: (id: string) => void;
  onDelete: (id: string) => void;
  onRestart: (id: string) => void;
  onEditName: (id: string) => void;
  onViewLogs: (id: string) => void;
}

const PLATFORMS = ["all", "telegram", "discord", "whatsapp"] as const;
type Platform = (typeof PLATFORMS)[number];

export function ConnectionHub({
  onNewConnection,
  onReauth,
  onConfigureScope,
  onDelete,
  onRestart,
  onEditName,
  onViewLogs,
}: ConnectionHubProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>("all");
  const [search, setSearch] = useState("");

  const fetchConnections = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.getConnections({ limit: 100 });
      setConnections(data ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load connections"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const health = useMemo<HealthSummary>(() => {
    const summary = { total: connections.length, active: 0, error: 0, inactive: 0 };
    for (const c of connections) {
      if (c.status === "active") summary.active++;
      else if (c.status === "error") summary.error++;
      else summary.inactive++;
    }
    return summary;
  }, [connections]);

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return connections.filter((c) => {
      if (platform !== "all" && c.platform !== platform) return false;
      if (search && !c.name.toLowerCase().includes(lowerSearch)) return false;
      return true;
    });
  }, [connections, platform, search]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold">Failed to load connections</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button
          size="sm"
          className="mt-4"
          onClick={() => {
            setLoading(true);
            fetchConnections();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
        <div>
          <h1 className="text-2xl font-bold">Connections</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {health.active} active · {health.error > 0 ? `${health.error} error · ` : ""}
            {health.total} total
          </p>
        </div>
        <Button onClick={onNewConnection}>+ New Connection</Button>
      </div>

      {/* Health strip */}
      <div className="flex border-b border-white/[0.06]">
        <div className="flex-1 bg-emerald-500/[0.06] px-5 py-4">
          <div className="text-2xl font-semibold text-emerald-400">{health.active}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Active</div>
        </div>
        <div className="flex-1 bg-red-500/[0.06] px-5 py-4">
          <div className="text-2xl font-semibold text-red-400">{health.error}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Error</div>
        </div>
        <div className="flex-1 px-5 py-4">
          <div className="text-2xl font-semibold">{health.inactive}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Inactive</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-6 py-3">
        <div className="flex gap-1 rounded-md bg-white/[0.04] p-0.5">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                platform === p
                  ? "bg-white/10 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Input
          placeholder="Search connections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 text-sm"
        />
      </div>

      {/* Connection list */}
      <div className="flex flex-col gap-2 p-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {connections.length === 0
              ? 'No connections yet. Click "+ New Connection" to get started.'
              : "No connections match your filters."}
          </div>
        ) : (
          filtered.map((c) => (
            <ConnectionCard
              key={c.id}
              connection={c}
              onReauth={onReauth}
              onConfigureScope={onConfigureScope}
              onDelete={onDelete}
              onRestart={onRestart}
              onEditName={onEditName}
              onViewLogs={onViewLogs}
            />
          ))
        )}
      </div>
    </div>
  );
}
