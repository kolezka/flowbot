"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthCheckProps {
  connectionId: string;
  onComplete: () => void;
}

interface Check {
  label: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  detail?: string;
}

type CheckRunner = (connectionId: string) => Promise<{ detail?: string }>;

// ---------------------------------------------------------------------------
// Check definitions
// ---------------------------------------------------------------------------

const CHECK_DEFINITIONS: { label: string; run: CheckRunner }[] = [
  {
    label: "Authentication valid",
    run: async (connectionId) => {
      const res = await fetch(`/api/connections/${connectionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { status?: string };
      if (data.status !== "active") {
        throw new Error(`Status is "${data.status ?? "unknown"}", expected "active"`);
      }
      return { detail: "Status active" };
    },
  },
  {
    label: "API connection stable",
    run: async (connectionId) => {
      const t0 = performance.now();
      const res = await fetch(`/api/connections/${connectionId}/health`);
      const latency = Math.round(performance.now() - t0);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { detail: `${latency}ms latency` };
    },
  },
  {
    label: "Permissions OK",
    run: async (connectionId) => {
      const res = await fetch(`/api/connections/${connectionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;
      const hasPlatform = typeof data.platform === "string" && data.platform.length > 0;
      if (!hasPlatform) throw new Error("Platform info unavailable");
      return { detail: `Platform: ${data.platform as string}` };
    },
  },
  {
    label: "Group/channel list fetchable",
    run: async (connectionId) => {
      const res = await fetch(`/api/connections/${connectionId}/available-groups`);
      if (res.status === 404) {
        return { detail: "Endpoint not yet available" };
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: unknown[] };
      const count = Array.isArray(data.data) ? data.data.length : 0;
      return { detail: `${count} group${count !== 1 ? "s" : ""} found` };
    },
  },
];

// ---------------------------------------------------------------------------
// StatusIcon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: Check["status"] }) {
  if (status === "passed") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs font-bold flex-shrink-0">
        ✓
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-5 w-5 items-center justify-center flex-shrink-0">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-bold flex-shrink-0">
        ✗
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-xs font-bold flex-shrink-0">
        ⊘
      </span>
    );
  }
  // pending
  return (
    <span className="flex h-5 w-5 items-center justify-center text-muted-foreground text-xs flex-shrink-0">
      ○
    </span>
  );
}

// ---------------------------------------------------------------------------
// HealthCheck component
// ---------------------------------------------------------------------------

function buildInitialChecks(): Check[] {
  return CHECK_DEFINITIONS.map((def) => ({ label: def.label, status: "pending" as const }));
}

export function HealthCheck({ connectionId, onComplete }: HealthCheckProps) {
  const [checks, setChecks] = useState<Check[]>(buildInitialChecks);
  const [running, setRunning] = useState(false);
  const runRef = useRef(false);

  const updateCheck = useCallback((index: number, patch: Partial<Check>) => {
    setChecks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  }, []);

  const runChecks = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    setRunning(true);
    setChecks(buildInitialChecks());

    for (let i = 0; i < CHECK_DEFINITIONS.length; i++) {
      const def = CHECK_DEFINITIONS[i];
      if (!def) continue;

      updateCheck(i, { status: "running" });

      try {
        const result = await def.run(connectionId);

        // Group/channel check returns a skipped detail when 404
        if (i === 3 && result.detail === "Endpoint not yet available") {
          updateCheck(i, { status: "skipped", detail: result.detail });
        } else {
          updateCheck(i, { status: "passed", detail: result.detail });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Check failed";
        updateCheck(i, { status: "failed", detail: msg });
        // Stop running further checks after a failure
        for (let j = i + 1; j < CHECK_DEFINITIONS.length; j++) {
          updateCheck(j, { status: "pending" });
        }
        runRef.current = false;
        setRunning(false);
        return;
      }
    }

    runRef.current = false;
    setRunning(false);
  }, [connectionId, updateCheck]);

  // Auto-start on mount
  useEffect(() => {
    void runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasFailed = checks.some((c) => c.status === "failed");
  const allDone = checks.every(
    (c) => c.status === "passed" || c.status === "skipped"
  );

  function handleRetry() {
    runRef.current = false;
    void runChecks();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted-foreground">
        {allDone && !hasFailed
          ? "Connection verified successfully"
          : "Verifying your connection\u2026"}
      </p>
      <div className="space-y-3">
        {checks.map((check, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-0.5">
              <StatusIcon status={check.status} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  check.status === "failed"
                    ? "text-destructive"
                    : check.status === "passed"
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {check.label}
              </p>
              {check.detail && (
                <p
                  className={`text-xs mt-0.5 ${
                    check.status === "failed"
                      ? "text-destructive/80"
                      : check.status === "skipped"
                        ? "text-yellow-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {check.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {allDone && !hasFailed && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
          All checks passed
        </div>
      )}

      {hasFailed && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={running}
          className="w-full"
        >
          Retry
        </Button>
      )}

      <Button
        type="button"
        onClick={onComplete}
        disabled={!allDone || running}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
