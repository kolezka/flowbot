"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { TgClientSession } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [session, setSession] = useState<TgClientSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTgClientSession(params.id as string)
      .then(setSession)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="animate-pulse h-64 bg-muted rounded-xl" />;
  if (!session) return <p>Session not found</p>;

  const handleDeactivate = async () => {
    await api.deactivateTgClientSession(session.id);
    setSession({ ...session, isActive: false });
  };

  const handleRotate = async () => {
    const newSession = await api.rotateTgClientSession(session.id);
    router.push(`/dashboard/tg-client/sessions/${newSession.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Session Details</h1>
        <Badge variant={session.isActive ? "default" : "secondary"}>
          {session.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Session Info</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-muted-foreground">ID</dt><dd className="font-mono text-sm">{session.id}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Phone</dt><dd>{session.phoneNumber || "N/A"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Display Name</dt><dd>{session.displayName || "N/A"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Type</dt><dd>{session.sessionType}</dd></div>
            <div><dt className="text-sm text-muted-foreground">DC</dt><dd>{session.dcId || "Unknown"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Errors</dt><dd>{session.errorCount}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Last Used</dt><dd>{new Date(session.lastUsedAt).toLocaleString()}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Created</dt><dd>{new Date(session.createdAt).toLocaleString()}</dd></div>
          </dl>
          {session.lastError && (
            <div className="mt-4 rounded-lg bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Last Error</p>
              <p className="text-sm">{session.lastError}</p>
              {session.lastErrorAt && <p className="text-xs text-muted-foreground mt-1">{new Date(session.lastErrorAt).toLocaleString()}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {session.isActive && (
          <>
            <Button variant="outline" onClick={handleRotate}>Rotate Session</Button>
            <Button variant="destructive" onClick={handleDeactivate}>Deactivate</Button>
          </>
        )}
      </div>
    </div>
  );
}
