"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ConnectionHub } from "@/components/connections/ConnectionHub";
import { AuthSheet } from "@/components/connections/AuthSheet";
import { ReauthSheet } from "@/components/connections/ReauthSheet";

export default function ConnectionsPage() {
  const router = useRouter();
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reauthConnection, setReauthConnection] = useState<{
    id: string;
    name: string;
    platform: string;
    connectionType: string;
  } | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <ConnectionHub
        key={refreshKey}
        onNewConnection={() => setAuthSheetOpen(true)}
        onReauth={(id) => {
          fetch(`/api/connections/${id}`)
            .then((r) => r.json())
            .then((conn: { id: string; name: string; platform: string; connectionType: string }) =>
              setReauthConnection(conn)
            )
            .catch(console.error);
        }}
        onConfigureScope={(id) => router.push(`/dashboard/connections/${id}`)}
        onDelete={async (id) => {
          if (confirm("Delete this connection?")) {
            await fetch(`/api/connections/${id}`, { method: "DELETE" });
            triggerRefresh();
          }
        }}
        onRestart={async (id) => {
          await fetch(`/api/connections/${id}/restart`, { method: "POST" });
          triggerRefresh();
        }}
        onEditName={(id) => {
          router.push(`/dashboard/connections/${id}`);
        }}
        onViewLogs={(id) => router.push(`/dashboard/connections/${id}`)}
      />

      <AuthSheet
        open={authSheetOpen}
        onOpenChange={setAuthSheetOpen}
        onComplete={() => {
          setAuthSheetOpen(false);
          triggerRefresh();
        }}
      />

      {reauthConnection && (
        <ReauthSheet
          open={!!reauthConnection}
          onOpenChange={(open) => {
            if (!open) setReauthConnection(null);
          }}
          onComplete={() => {
            setReauthConnection(null);
            triggerRefresh();
          }}
          connection={reauthConnection}
        />
      )}
    </>
  );
}
