# Connection Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the connections list + multi-page auth wizard with a status-first hub page, sheet-based auth, inline error recovery, auto health checks, and a searchable scope manager.

**Architecture:** Sheet-based auth flow (Radix Sheet) replaces page navigation. New `list_groups` action in connector packages enables the visual scope picker. Hub page uses the existing connection/health API with enhanced UI.

**Tech Stack:** Next.js 16, React 19, Radix UI (Sheet, Dialog, DropdownMenu), Tailwind 4, Socket.IO, NestJS

**Spec:** `docs/superpowers/specs/2026-03-22-ui-ux-overhaul-design.md` — Section 1

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/frontend/src/components/connections/ConnectionHub.tsx` | Create | Hub page layout, health strip, filter bar |
| `apps/frontend/src/components/connections/ConnectionCard.tsx` | Create | Single connection row with status, health badge, actions |
| `apps/frontend/src/components/connections/AuthSheet.tsx` | Create | Sheet container with step state machine |
| `apps/frontend/src/components/connections/auth-steps/PlatformSelect.tsx` | Create | Platform cards + Telegram type sub-selection |
| `apps/frontend/src/components/connections/auth-steps/NameAndCredentials.tsx` | Create | Connection name + platform-specific auth input |
| `apps/frontend/src/components/connections/auth-steps/Verification.tsx` | Create | Code input (MTProto), QR scan (WhatsApp), immediate (tokens) |
| `apps/frontend/src/components/connections/auth-steps/HealthCheck.tsx` | Create | Auto-running health checklist |
| `apps/frontend/src/components/connections/ScopeManager.tsx` | Create | Searchable group picker with checkboxes |
| `apps/frontend/src/components/connections/ReauthSheet.tsx` | Create | Pre-filled re-auth variant |
| `apps/frontend/src/app/dashboard/connections/page.tsx` | Modify | Replace contents with ConnectionHub |
| `apps/frontend/src/app/dashboard/connections/[id]/page.tsx` | Modify | Replace scope editor with ScopeManager |
| `apps/frontend/src/lib/api.ts` | Modify | Add `getAvailableGroups()` method |
| `apps/api/src/connections/connections.controller.ts` | Modify | Add `GET /:id/available-groups` endpoint |
| `apps/api/src/connections/connections.service.ts` | Modify | Add `getAvailableGroups()` calling connector pool |
| `packages/telegram-bot-connector/src/actions/` | Modify | Register `list_groups` action |
| `packages/telegram-user-connector/src/actions/` | Modify | Register `list_groups` action |
| `packages/discord-bot-connector/src/actions/` | Modify | Register `list_groups` action |
| `packages/whatsapp-user-connector/src/actions/` | Modify | Register `list_groups` action |

---

### Task 1: ConnectionCard Component

**Files:**
- Create: `apps/frontend/src/components/connections/ConnectionCard.tsx`

- [ ] **Step 1: Create ConnectionCard component**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Connection {
  id: string;
  name: string;
  platform: string;
  connectionType: string;
  status: string;
  lastActiveAt?: string;
  errorCount?: number;
  error?: string;
  botInstanceId?: string;
}

interface ConnectionCardProps {
  connection: Connection;
  onReauth: (id: string) => void;
  onConfigureScope: (id: string) => void;
  onDelete: (id: string) => void;
  onRestart: (id: string) => void;
  onEditName: (id: string) => void;
  onViewLogs: (id: string) => void;
}

const PLATFORM_ICONS: Record<string, { bg: string; icon: string }> = {
  telegram: { bg: "#2AABEE", icon: "✈" },
  discord: { bg: "#5865F2", icon: "🎮" },
  whatsapp: { bg: "#25D366", icon: "💬" },
};

const STATUS_CONFIG: Record<string, { color: string; dotColor: string; label: string }> = {
  active: { color: "rgba(16,185,129,0.1)", dotColor: "#10b981", label: "Healthy" },
  error: { color: "rgba(239,68,68,0.1)", dotColor: "#ef4444", label: "Auth Error" },
  inactive: { color: "rgba(255,255,255,0.06)", dotColor: "rgba(255,255,255,0.3)", label: "Inactive" },
  authenticating: { color: "rgba(245,158,11,0.1)", dotColor: "#f59e0b", label: "Authenticating" },
};

function formatLastActive(dateStr?: string): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ConnectionCard({
  connection,
  onReauth,
  onConfigureScope,
  onDelete,
  onRestart,
}: ConnectionCardProps) {
  const platform = PLATFORM_ICONS[connection.platform] ?? { bg: "#666", icon: "?" };
  const status = STATUS_CONFIG[connection.status] ?? STATUS_CONFIG.inactive;
  const isError = connection.status === "error";

  return (
    <div
      className={`flex items-center gap-3.5 rounded-lg border px-4 py-3.5 transition-colors ${
        isError
          ? "border-red-500/20 bg-red-500/[0.03]"
          : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
    >
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: status.dotColor }}
      />
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base"
        style={{ backgroundColor: platform.bg }}
      >
        {platform.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{connection.name}</div>
        <div className="text-xs text-muted-foreground">
          {connection.platform} · {connection.connectionType}
          {connection.error ? ` · ${connection.error}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-xs text-muted-foreground">
        {formatLastActive(connection.lastActiveAt)}
      </div>
      <Badge
        variant={isError ? "destructive" : "secondary"}
        className="shrink-0 text-xs"
      >
        {status.label}
      </Badge>
      {isError && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
          onClick={() => onReauth(connection.id)}
        >
          Re-auth
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
            ⋯
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEditName(connection.id)}>
            Edit name
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onConfigureScope(connection.id)}>
            Configure scope
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewLogs(connection.id)}>
            View logs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRestart(connection.id)}>
            Restart
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(connection.id)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 2: Verify component renders without errors**

Run: `cd /Users/me/Development/flowbot && pnpm frontend build 2>&1 | head -20`
Expected: No TypeScript errors for the new file

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/connections/ConnectionCard.tsx
git commit -m "feat(frontend): add ConnectionCard component with status indicators"
```

---

### Task 2: ConnectionHub Page Component

**Files:**
- Create: `apps/frontend/src/components/connections/ConnectionHub.tsx`
- Modify: `apps/frontend/src/app/dashboard/connections/page.tsx`

- [ ] **Step 1: Create ConnectionHub component**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionCard } from "./ConnectionCard";

interface Connection {
  id: string;
  name: string;
  platform: string;
  connectionType: string;
  status: string;
  lastActiveAt?: string;
  errorCount?: number;
  error?: string;
  botInstanceId?: string;
}

interface HealthSummary {
  total: number;
  active: number;
  error: number;
  inactive: number;
}

interface ConnectionHubProps {
  onNewConnection: () => void;
  onReauth: (id: string) => void;
  onConfigureScope: (id: string) => void;
  onDelete: (id: string) => void;
  onRestart: (id: string) => void;
}

const PLATFORMS = ["all", "telegram", "discord", "whatsapp"] as const;
type Platform = (typeof PLATFORMS)[number];

export function ConnectionHub({
  onNewConnection,
  onReauth,
  onConfigureScope,
  onDelete,
  onRestart,
}: ConnectionHubProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform>("all");
  const [search, setSearch] = useState("");

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/connections?limit=100");
      const json = await res.json();
      setConnections(json.data ?? []);
    } catch {
      // silently fail, connections remain empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const health = useMemo<HealthSummary>(() => {
    const summary = { total: connections.length, active: 0, error: 0, inactive: 0 };
    for (const c of connections) {
      if (c.status === "active") summary.active++;
      else if (c.status === "error") summary.error++;
      else summary.inactive++;
    }
    return summary;
  }, [connections]);

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return connections.filter((c) => {
      if (platform !== "all" && c.platform !== platform) return false;
      if (search && !c.name.toLowerCase().includes(lowerSearch)) return false;
      return true;
    });
  }, [connections, platform, search]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
        <div>
          <h1 className="text-xl font-semibold">Connections</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {health.active} active · {health.error > 0 ? `${health.error} error · ` : ""}
            {health.total} total
          </p>
        </div>
        <Button onClick={onNewConnection}>+ New Connection</Button>
      </div>

      {/* Health strip */}
      <div className="flex border-b border-white/[0.06]">
        <div className="flex-1 bg-emerald-500/[0.06] px-5 py-4">
          <div className="text-2xl font-semibold text-emerald-400">{health.active}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Active</div>
        </div>
        <div className="flex-1 bg-red-500/[0.06] px-5 py-4">
          <div className="text-2xl font-semibold text-red-400">{health.error}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Error</div>
        </div>
        <div className="flex-1 px-5 py-4">
          <div className="text-2xl font-semibold">{health.inactive}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Inactive</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-6 py-3">
        <div className="flex gap-1 rounded-md bg-white/[0.04] p-0.5">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                platform === p
                  ? "bg-white/10 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Input
          placeholder="Search connections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 text-sm"
        />
      </div>

      {/* Connection list */}
      <div className="flex flex-col gap-2 p-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {connections.length === 0
              ? "No connections yet. Click \"+ New Connection\" to get started."
              : "No connections match your filters."}
          </div>
        ) : (
          filtered.map((c) => (
            <ConnectionCard
              key={c.id}
              connection={c}
              onReauth={onReauth}
              onConfigureScope={onConfigureScope}
              onDelete={onDelete}
              onRestart={onRestart}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the connections page to use ConnectionHub**

Replace `apps/frontend/src/app/dashboard/connections/page.tsx` with a thin wrapper that imports ConnectionHub and passes callbacks that open sheets / navigate.

- [ ] **Step 3: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/connections/ConnectionHub.tsx apps/frontend/src/app/dashboard/connections/page.tsx
git commit -m "feat(frontend): add ConnectionHub page with health strip and filters"
```

---

### Task 3: Auth Sheet — Step State Machine

**Files:**
- Create: `apps/frontend/src/components/connections/AuthSheet.tsx`
- Create: `apps/frontend/src/components/connections/auth-steps/PlatformSelect.tsx`
- Create: `apps/frontend/src/components/connections/auth-steps/NameAndCredentials.tsx`

- [ ] **Step 1: Create PlatformSelect step component**

Renders three platform cards. Telegram shows a sub-selection (Bot Token vs Account). Calls `onSelect(platform, connectionType)`.

- [ ] **Step 2: Create NameAndCredentials step component**

Single form with connection name input + platform-specific credential input (bot token field for telegram-bot/discord-bot, phone number for telegram-user mtproto, connection name only for whatsapp). Calls `onSubmit({ name, credential })`.

- [ ] **Step 3: Create AuthSheet container with step state machine**

```tsx
"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PlatformSelect } from "./auth-steps/PlatformSelect";
import { NameAndCredentials } from "./auth-steps/NameAndCredentials";
import { Verification } from "./auth-steps/Verification";
import { HealthCheck } from "./auth-steps/HealthCheck";

type Step = "platform" | "credentials" | "verification" | "health" | "scope";

interface AuthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface AuthState {
  platform: string;
  connectionType: string;
  name: string;
  connectionId: string;
  sessionId: string;
}

const STEP_LABELS: Record<Step, string> = {
  platform: "Platform",
  credentials: "Setup",
  verification: "Verify",
  health: "Health Check",
  scope: "Scope",
};

export function AuthSheet({ open, onOpenChange, onComplete }: AuthSheetProps) {
  const [step, setStep] = useState<Step>("platform");
  const [state, setState] = useState<Partial<AuthState>>({});

  const steps: Step[] = ["platform", "credentials", "verification", "health", "scope"];
  const currentIndex = steps.indexOf(step);

  function handleClose(isOpen: boolean) {
    if (!isOpen && step !== "platform") {
      // Could add confirmation dialog here
    }
    if (!isOpen) {
      setStep("platform");
      setState({});
    }
    onOpenChange(isOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[440px] overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>New Connection</SheetTitle>
        </SheetHeader>

        {/* Breadcrumb */}
        <nav className="mb-6 flex gap-1.5 text-xs text-muted-foreground">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              {i > 0 && <span>›</span>}
              <span className={i === currentIndex ? "text-foreground" : ""}>
                {STEP_LABELS[s]}
              </span>
            </span>
          ))}
        </nav>

        {step === "platform" && (
          <PlatformSelect
            onSelect={(platform, connectionType) => {
              setState((prev) => ({ ...prev, platform, connectionType }));
              setStep("credentials");
            }}
          />
        )}
        {step === "credentials" && (
          <NameAndCredentials
            platform={state.platform!}
            connectionType={state.connectionType!}
            onBack={() => setStep("platform")}
            onSubmit={({ name, connectionId, sessionId }) => {
              setState((prev) => ({ ...prev, name, connectionId, sessionId }));
              // Bot tokens and Discord skip verification
              const skipVerification =
                state.connectionType === "bot_token" ||
                state.platform === "discord";
              setStep(skipVerification ? "health" : "verification");
            }}
          />
        )}
        {step === "verification" && (
          <Verification
            connectionId={state.connectionId!}
            sessionId={state.sessionId!}
            platform={state.platform!}
            connectionType={state.connectionType!}
            onBack={() => setStep("credentials")}
            onComplete={() => setStep("health")}
          />
        )}
        {step === "health" && (
          <HealthCheck
            connectionId={state.connectionId!}
            onComplete={() => setStep("scope")}
          />
        )}
        {step === "scope" && (
          <ScopeManager
            connectionId={state.connectionId!}
            onComplete={() => {
              onComplete();
              handleClose(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
```

Note: Add `import { ScopeManager } from "../ScopeManager"` at the top once Task 8 is complete. Until then, comment out the scope step or add a placeholder `function ScopeManager(props: any) { return null; }` to pass build checks.

- [ ] **Step 4: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/connections/AuthSheet.tsx apps/frontend/src/components/connections/auth-steps/
git commit -m "feat(frontend): add AuthSheet with step state machine and platform/credentials steps"
```

---

### Task 4: Verification Step with Inline Retry

**Files:**
- Create: `apps/frontend/src/components/connections/auth-steps/Verification.tsx`

- [ ] **Step 1: Create Verification component**

Handles three verification modes:
- **MTProto (telegram-user):** individual code digit inputs, 2FA password (conditional), inline error with retry counter, "Resend code" link
- **WhatsApp:** QR code display with WebSocket listener for `qr`/`connected`/`timeout` events (port logic from existing `WhatsAppAuthWizard.tsx:304 lines`)
- **Fallback:** should never reach here for bot tokens (they skip verification)

Key behaviors:
- Error message inline below inputs with attempt counter
- "Resend code" calls `startConnectionAuth` again with same phone
- Back button preserves all entered data
- WhatsApp QR auto-advances on `connected` WebSocket event

Uses existing API methods: `submitConnectionAuthStep()` (line 1803 in api.ts)

- [ ] **Step 2: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/connections/auth-steps/Verification.tsx
git commit -m "feat(frontend): add Verification step with inline retry and WhatsApp QR support"
```

---

### Task 5: Health Check Step

**Files:**
- Create: `apps/frontend/src/components/connections/auth-steps/HealthCheck.tsx`

- [ ] **Step 1: Create HealthCheck component**

Auto-runs a sequence of checks after auth completes:
1. Authentication valid — calls `GET /api/connections/:id` and checks `status === 'active'`
2. API connection stable — calls pool health endpoint for the instance, displays round-trip latency in ms (uses `getConnectionHealth()` from api.ts line 1775)
3. Permissions OK — platform-dependent check (Telegram bot: getMe, Discord: guild list access)
4. Group/channel list fetchable — calls `getAvailableGroups(connectionId)` to verify scope picker will work

Display: sequential checklist with green ✓ appearing one by one, spinner on current check, error state with retry button.

```tsx
interface HealthCheckProps {
  connectionId: string;
  onComplete: () => void;
}

interface Check {
  label: string;
  status: "pending" | "running" | "passed" | "failed";
  detail?: string;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/connections/auth-steps/HealthCheck.tsx
git commit -m "feat(frontend): add HealthCheck step with sequential verification"
```

---

### Task 6: `list_groups` Action in Connector Packages

**Files:**
- Modify: `packages/telegram-bot-connector/src/actions/` — add list_groups action
- Modify: `packages/telegram-user-connector/src/actions/` — add list_groups action
- Modify: `packages/discord-bot-connector/src/actions/` — add list_groups action
- Modify: `packages/whatsapp-user-connector/src/actions/` — add list_groups action

- [ ] **Step 1: Check existing action registration pattern**

Read one existing action file (e.g., `packages/telegram-bot-connector/src/actions/`) to understand the `ActionRegistry` pattern from platform-kit.

- [ ] **Step 2: Add `list_groups` to telegram-bot-connector**

Uses grammY `bot.api.getMyChats()` or equivalent. Returns `{ groups: [{ id, name, memberCount }] }`.

- [ ] **Step 3: Add `list_groups` to telegram-user-connector**

Uses GramJS `client.getDialogs()` filtered to groups/channels. Returns same shape.

- [ ] **Step 4: Add `list_groups` to discord-bot-connector**

Uses Discord.js `client.guilds.cache`. Returns `{ groups: [{ id, name, memberCount }] }`.

- [ ] **Step 5: Add `list_groups` to whatsapp-user-connector**

Uses Baileys `sock.groupFetchAllParticipating()`. Returns same shape.

- [ ] **Step 6: Run connector tests**

```bash
pnpm telegram-bot-connector test
pnpm telegram-user-connector test
pnpm discord-bot-connector test
pnpm whatsapp-user-connector test
```

- [ ] **Step 7: Commit**

```bash
git add packages/telegram-bot-connector/src/actions/ packages/telegram-user-connector/src/actions/ packages/discord-bot-connector/src/actions/ packages/whatsapp-user-connector/src/actions/
git commit -m "feat(connectors): add list_groups action to all four connector packages"
```

---

### Task 7: Available Groups API Endpoint

**Files:**
- Modify: `apps/api/src/connections/connections.controller.ts`
- Modify: `apps/api/src/connections/connections.service.ts`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Step 1: Add service method**

In `connections.service.ts`, add `getAvailableGroups(connectionId: string)` that:
1. Looks up the connection from DB to get platform, connectionType, and instance ID
2. Calls the connector pool `POST /execute` with `{ action: 'list_groups', instanceId }`
3. Returns the groups array

- [ ] **Step 2: Add controller endpoint**

In `connections.controller.ts`, add `@Get(':id/available-groups')` that calls the service.

- [ ] **Step 3: Add frontend API method**

In `apps/frontend/src/lib/api.ts`, add:

```typescript
async getAvailableGroups(connectionId: string): Promise<{ groups: Array<{ id: string; name: string; memberCount: number }> }> {
  return this.request(`/connections/${connectionId}/available-groups`);
}
```

- [ ] **Step 4: Run API tests**

```bash
pnpm api test -- --testPathPattern=connections
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/connections/ apps/frontend/src/lib/api.ts
git commit -m "feat(api): add GET /connections/:id/available-groups endpoint"
```

---

### Task 8: ScopeManager Component

**Files:**
- Create: `apps/frontend/src/components/connections/ScopeManager.tsx`

- [ ] **Step 1: Create ScopeManager component**

Searchable group picker that:
1. Calls `getAvailableGroups(connectionId)` on mount
2. Displays checkbox list with group name, ID, member count
3. Search input filters by name
4. Selected groups tracked in state
5. "Save & Finish" saves scope. For bot_token connections with a `botInstanceId`, calls `updateBotScope(botInstanceId, { groupIds })`. For other connection types (mtproto, baileys), a new API method `updateConnectionScope(connectionId, { groupIds })` is needed — add this to `connections.service.ts` and `connections.controller.ts` alongside the `available-groups` endpoint in Task 7.
6. Falls back to manual ID input if API returns error (with explanation message)

```tsx
interface ScopeManagerProps {
  connectionId: string;
  onComplete: () => void;
}

interface Group {
  id: string;
  name: string;
  memberCount: number;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/connections/ScopeManager.tsx
git commit -m "feat(frontend): add ScopeManager with searchable group picker"
```

---

### Task 9: ReauthSheet Component

**Files:**
- Create: `apps/frontend/src/components/connections/ReauthSheet.tsx`

- [ ] **Step 1: Create ReauthSheet component**

Variant of AuthSheet that:
1. Receives existing connection data (id, name, platform, connectionType, phone/token)
2. Opens at the credentials step (skips platform selection)
3. Pre-fills name and phone number
4. Shows warning banner: "Your session expired. Re-enter credentials. Settings and scope preserved."
5. After successful re-auth, runs health check then closes (no scope step — already configured)

- [ ] **Step 2: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/connections/ReauthSheet.tsx
git commit -m "feat(frontend): add ReauthSheet for inline error recovery"
```

---

### Task 10: Wire Everything Together in Page

**Files:**
- Modify: `apps/frontend/src/app/dashboard/connections/page.tsx`
- Modify: `apps/frontend/src/app/dashboard/connections/[id]/page.tsx`

- [ ] **Step 1: Update connections page**

Wire ConnectionHub callbacks to open AuthSheet (new connection), ReauthSheet (re-auth), navigate to detail page (configure scope), and call API methods (delete, restart).

- [ ] **Step 2: Update connection detail page**

Replace the existing scope editor section with `<ScopeManager connectionId={id} onComplete={refresh} />`.

- [ ] **Step 3: Manual test**

Run: `pnpm frontend dev`
Verify:
1. Hub page loads with health strip and connection list
2. "+ New Connection" opens auth sheet
3. Platform selection → credentials → verify → health check → scope flows correctly
4. Error connections show "Re-auth" button
5. Scope manager loads groups from API (or falls back to manual input)

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/dashboard/connections/
git commit -m "feat(frontend): wire ConnectionHub, AuthSheet, and ScopeManager into pages"
```

---

### Task 11: Cleanup Old Auth Pages

**Files:**
- Delete: `apps/frontend/src/app/dashboard/connections/auth/page.tsx`
- Delete: `apps/frontend/src/app/dashboard/connections/auth/loading.tsx`
- Delete: `apps/frontend/src/app/dashboard/connections/components/WhatsAppAuthWizard.tsx`

- [ ] **Step 1: Verify no imports reference the old files**

Search for imports of the old auth page and WhatsAppAuthWizard to ensure nothing else depends on them.

- [ ] **Step 2: Delete old files**

```bash
rm apps/frontend/src/app/dashboard/connections/auth/page.tsx
rm apps/frontend/src/app/dashboard/connections/auth/loading.tsx
rm apps/frontend/src/app/dashboard/connections/components/WhatsAppAuthWizard.tsx
```

- [ ] **Step 3: Verify build still passes**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add -u apps/frontend/src/app/dashboard/connections/
git commit -m "refactor(frontend): remove old auth wizard pages replaced by AuthSheet"
```
