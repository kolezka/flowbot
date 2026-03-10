"use client";

import { useSocketEvent, useWebSocket } from "@/lib/websocket";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface JobProgress {
  jobId: string;
  status: string;
  progress?: number;
}

export function JobProgressBar({ jobId, className }: { jobId: string; className?: string }) {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const { joinRoom, leaveRoom } = useWebSocket();

  useEffect(() => {
    joinRoom("automation");
    return () => leaveRoom("automation");
  }, [joinRoom, leaveRoom]);

  const handleEvent = useCallback((event: any) => {
    if (event.jobId === jobId) {
      setProgress({
        jobId: event.jobId,
        status: event.type.split(".").pop() ?? "unknown",
        progress: event.data?.progress,
      });
    }
  }, [jobId]);

  useSocketEvent("automation", handleEvent);

  if (!progress) return null;

  const pct = progress.progress ?? (progress.status === "completed" ? 100 : 50);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{progress.status}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            progress.status === "completed" ? "bg-green-500" :
            progress.status === "failed" ? "bg-red-500" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
