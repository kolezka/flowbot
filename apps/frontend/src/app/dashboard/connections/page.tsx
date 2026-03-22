"use client";

import { useRouter } from "next/navigation";
import { ConnectionHub } from "@/components/connections/ConnectionHub";

export default function ConnectionsPage() {
  const router = useRouter();

  return (
    <ConnectionHub
      onNewConnection={() => router.push("/dashboard/connections/auth")}
      onReauth={(id) => console.log("reauth", id)}
      onConfigureScope={(id) => console.log("configureScope", id)}
      onDelete={(id) => console.log("delete", id)}
      onRestart={(id) => console.log("restart", id)}
      onEditName={(id) => console.log("editName", id)}
      onViewLogs={(id) => router.push(`/dashboard/connections/${id}`)}
    />
  );
}
