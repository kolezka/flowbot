"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectionHub } from "@/components/connections/ConnectionHub";
import { AuthSheet } from "@/components/connections/AuthSheet";
import { ReauthSheet } from "@/components/connections/ReauthSheet";

export default function ConnectionsPage() {
  const router = useRouter();
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [reauthConnection, setReauthConnection] = useState<{
    id: string;
    name: string;
    platform: string;
    connectionType: string;
  } | null>(null);

  return (
    <>
      <ConnectionHub
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
            window.location.reload();
          }
        }}
        onRestart={async (id) => {
          await fetch(`/api/connections/${id}/restart`, { method: "POST" });
          window.location.reload();
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
          window.location.reload();
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
            window.location.reload();
          }}
          connection={reauthConnection}
        />
      )}
    </>
  );
}
