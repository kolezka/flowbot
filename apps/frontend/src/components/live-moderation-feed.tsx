"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket, useSocketEvent } from "@/lib/websocket";
import { Shield, AlertTriangle, Ban, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModerationEvent {
  type: string;
  groupId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

const eventIcons: Record<string, typeof Shield> = {
  "warning.created": AlertTriangle,
  "member.banned": Ban,
  "member.muted": Ban,
  "log.created": MessageSquare,
};

export function LiveModerationFeed({ className }: { className?: string }) {
  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { joinRoom, leaveRoom } = useWebSocket();

  useEffect(() => {
    joinRoom("moderation");
    return () => leaveRoom("moderation");
  }, [joinRoom, leaveRoom]);

  const handleEvent = useCallback((event: ModerationEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 100));
  }, []);

  useSocketEvent("moderation", handleEvent);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events, paused]);

  return (
    <div className={cn("rounded-xl border bg-card shadow", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Live Moderation Feed</h3>
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Resume live feed" : "Pause live feed"}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions"
        role="log"
      >
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No events yet. Waiting for activity...
          </div>
        ) : (
          events.map((event, i) => {
            const Icon = eventIcons[event.type] ?? Shield;
            return (
              <div key={i} className="flex items-start gap-3 border-b border-border px-4 py-2 last:border-0">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{event.type.replace(".", ": ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
