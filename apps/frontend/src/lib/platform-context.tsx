"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Platform = "all" | "telegram" | "discord" | "slack" | "whatsapp" | "custom";

interface PlatformContextValue {
  platform: Platform;
  setPlatform: (p: Platform) => void;
  queryParam: string | undefined;
}

const PlatformContext = createContext<PlatformContextValue>({
  platform: "all",
  setPlatform: () => {},
  queryParam: undefined,
});

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatformState] = useState<Platform>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("flowbot-platform-filter") as Platform) || "all";
    }
    return "all";
  });

  const setPlatform = useCallback((p: Platform) => {
    setPlatformState(p);
    if (typeof window !== "undefined") {
      localStorage.setItem("flowbot-platform-filter", p);
    }
  }, []);

  const queryParam = platform === "all" ? undefined : platform;

  return (
    <PlatformContext.Provider value={{ platform, setPlatform, queryParam }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
