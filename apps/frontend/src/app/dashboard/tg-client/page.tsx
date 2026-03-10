"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { TgClientSession, TransportHealth } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Smartphone, AlertTriangle, Plus } from "lucide-react";

export default function TgClientPage() {
  const [sessions, setSessions] = useState<TgClientSession[]>([]);
  const [health, setHealth] = useState<TransportHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getTgClientSessions({ limit: 10 }),
      api.getTransportHealth(),
    ]).then(([sessResp, healthResp]) => {
      setSessions(sessResp.data);
      setHealth(healthResp);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-xl" /><div className="h-64 bg-muted rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">TG Client Management</h1>
        <Link href="/dashboard/tg-client/auth">
          <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Session</Button>
        </Link>
      </div>

      {health && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{health.activeSessions}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Healthy</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{health.healthySessions}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{health.errorSessions}</div></CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Sessions</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/dashboard/tg-client/sessions/${session.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{session.displayName || session.phoneNumber || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{session.sessionType} &middot; DC {session.dcId || "?"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.errorCount > 0 && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  <Badge variant={session.isActive ? "default" : "secondary"}>
                    {session.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </Link>
            ))}
            {sessions.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No sessions found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
