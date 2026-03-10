"use client";

import { useState, useCallback } from "react";
import { useSocketEvent } from "@/lib/websocket";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  const handleModeration = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  const handleAutomation = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  useSocketEvent("moderation", handleModeration);
  useSocketEvent("automation", handleAutomation);

  const reset = () => setCount(0);

  return (
    <button type="button" onClick={reset} className={cn("relative", className)}>
      <Bell className="h-5 w-5 text-muted-foreground" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
