"use client";

import { usePlatform, type Platform } from "@/lib/platform-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "all", label: "All" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
];

export function PlatformFilter() {
  const { platform, setPlatform } = usePlatform();

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      {PLATFORMS.map((p) => (
        <Button
          key={p.value}
          variant={platform === p.value ? "default" : "ghost"}
          size="sm"
          className={cn("h-7 px-3 text-xs")}
          onClick={() => setPlatform(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
