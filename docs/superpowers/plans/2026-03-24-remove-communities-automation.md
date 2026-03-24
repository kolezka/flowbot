# Remove Communities & Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Communities, Automation, Broadcast, Crosspost, and Reputation code and database tables from the Flowbot monorepo.

**Architecture:** This is a pure deletion/cleanup operation across 4 layers: API modules, trigger tasks, frontend pages, and Prisma schema. Each commit removes one layer cleanly. TypeScript compiler catches any missed references.

**Tech Stack:** NestJS (API), Next.js (Frontend), Prisma 7 (Schema), Trigger.dev (Background tasks)

**Spec:** `docs/superpowers/specs/2026-03-24-remove-communities-automation-design.md`

---

## Task 1: Delete API Module Directories

**Files:**
- Delete: `apps/api/src/communities/` (entire directory, ~22 files)
- Delete: `apps/api/src/automation/` (entire directory, ~5 files)
- Delete: `apps/api/src/reputation/` (entire directory)
- Delete: `apps/api/src/broadcast/` (entire directory)
- Delete: `apps/api/src/moderation/crosspost/` (sub-directory)

- [ ] **Step 1: Delete the five module directories**

```bash
rm -rf apps/api/src/communities
rm -rf apps/api/src/automation
rm -rf apps/api/src/reputation
rm -rf apps/api/src/broadcast
rm -rf apps/api/src/moderation/crosspost
```

- [ ] **Step 2: Verify directories are gone**

```bash
ls apps/api/src/communities apps/api/src/automation apps/api/src/reputation apps/api/src/broadcast apps/api/src/moderation/crosspost 2>&1
```

Expected: all "No such file or directory"

---

## Task 2: Clean Up app.module.ts

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Remove import statements**

Remove these lines:
- Line 8: `import { BroadcastModule } from './broadcast/broadcast.module';`
- Line 10: `import { ReputationModule } from './reputation/reputation.module';`
- Line 17: `import { AutomationModule } from './automation/automation.module';`
- Line 21: `import { CommunitiesModule } from './communities/communities.module';`

- [ ] **Step 2: Remove module registrations from imports array**

Remove from the `imports: [...]` array (lines 26-48):
- `BroadcastModule` (line 35)
- `ReputationModule` (line 37)
- `AutomationModule` (line 44)
- `CommunitiesModule` (line 46)

- [ ] **Step 3: Verify no remaining references**

```bash
grep -n 'Communities\|Automation\|Reputation\|Broadcast' apps/api/src/app.module.ts
```

Expected: no output

---

## Task 3: Clean Up Moderation Module (Remove Crosspost)

**Files:**
- Modify: `apps/api/src/moderation/moderation.module.ts`

- [ ] **Step 1: Remove CrossPostModule import and references**

- Line 7: remove `import { CrossPostModule } from './crosspost/crosspost.module';`
- Remove `CrossPostModule` from the `imports` array
- Remove `CrossPostModule` from the `exports` array

- [ ] **Step 2: Verify no remaining crosspost references**

```bash
grep -rn 'crosspost\|CrossPost' apps/api/src/moderation/moderation.module.ts
```

Expected: no output

---

## Task 4: Clean Up Events Module

**Files:**
- Modify: `apps/api/src/events/event-types.ts` (remove lines 14-25: `AutomationEvent` interface)
- Modify: `apps/api/src/events/event-bus.service.ts` (remove lines 20-23: `emitAutomation`, lines 33-35: `onAutomation`, and the `AutomationEvent` import)
- Modify: `apps/api/src/events/ws.gateway.ts` (remove lines 35-37: automation listener, remove `'automation'` from validRooms at line 66)
- Modify: `apps/api/src/events/sse.controller.ts` (remove line 28: automation subscription, remove `'automation'` from default rooms at lines 42-46, remove automation event detection at line 53)

- [ ] **Step 1: Remove AutomationEvent interface and clean AppEvent union from event-types.ts**

Remove the entire `AutomationEvent` interface (lines 14-25). Also remove `| AutomationEvent` from the `AppEvent` union type (line 54).

- [ ] **Step 2: Remove automation methods from event-bus.service.ts**

Remove `emitAutomation()` method (lines 20-23) and `onAutomation()` method (lines 33-35). Remove the `AutomationEvent` import.

- [ ] **Step 3: Remove automation references from ws.gateway.ts**

Remove the `onAutomation` subscription block (lines 35-37). Remove `'automation'` from the `validRooms` array at line 66.

- [ ] **Step 4: Remove automation references from sse.controller.ts**

Remove `AutomationEvent` from import (line 8) and from `RoomEvent` type alias (line 12 — change to `type RoomEvent = ModerationEvent | SystemEvent`). Remove `onAutomation` subscription (line 28). Remove `'automation'` from default rooms list (lines 42-46). Remove the automation event detection (`'jobId' in event`) at line 53.

- [ ] **Step 5: Update corresponding test files**

Fix any test files under `apps/api/src/events/` that reference `AutomationEvent`, `emitAutomation`, or `onAutomation`. Remove automation-specific test cases, keep the rest. Also clean up `health-poller.service.spec.ts` mock which includes `emitAutomation` and `onAutomation` in the `EventBusService` mock object.

```bash
grep -rn 'AutomationEvent\|emitAutomation\|onAutomation\|automation' apps/api/src/events/*.spec.ts
```

- [ ] **Step 6: Verify no remaining automation references in events module**

```bash
grep -rn 'automation\|AutomationEvent' apps/api/src/events/
```

Expected: no output (or only unrelated occurrences)

---

## Task 5: Clean Up Analytics Module

**Files:**
- Modify: `apps/api/src/analytics/analytics.controller.ts` (remove lines 42-56: `getCommunityTimeSeries` endpoint)
- Modify: `apps/api/src/analytics/analytics.service.ts` (remove lines 154-195: `getCommunityTimeSeries` method)

- [ ] **Step 1: Remove community endpoint from analytics controller**

Remove the `@Get('communities/:communityId')` handler (lines 42-56).

- [ ] **Step 2: Remove getCommunityTimeSeries from analytics service**

Remove the `getCommunityTimeSeries` method (lines 154-195). Note: keep the `NotFoundException` import — it's still used by `getTimeSeries` and `getSummary` methods.

- [ ] **Step 3: Update analytics test files if they exist**

```bash
grep -rn 'communityTimeSeries\|getCommunityTimeSeries' apps/api/src/analytics/
```

Remove any matching test cases.

---

## Task 6: Delete Trigger Tasks & Clean Up Flow Engine

**Files:**
- Delete: `apps/trigger/src/trigger/broadcast.ts`
- Delete: `apps/trigger/src/trigger/cross-post.ts`
- Delete: `apps/trigger/src/__tests__/broadcast-logic.test.ts`
- Delete: `apps/trigger/src/__tests__/cross-post-logic.test.ts`
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts` (remove lines 37-68: `dispatchActionToCommunity`)
- Modify: `apps/trigger/src/lib/flow-engine/index.ts` (remove line 2: export)
- Modify: `apps/trigger/src/__tests__/flow-dispatcher.test.ts` (remove `describe('dispatchActionToCommunity')` block)
- Modify: `apps/trigger/src/lib/flow-engine/advanced-nodes.ts` (remove `'broadcastMessage.count'` from `DB_QUERY_ALLOWLIST` at line 109)

- [ ] **Step 1: Delete trigger task files and their tests**

```bash
rm -f apps/trigger/src/trigger/broadcast.ts
rm -f apps/trigger/src/trigger/cross-post.ts
rm -f apps/trigger/src/__tests__/broadcast-logic.test.ts
rm -f apps/trigger/src/__tests__/cross-post-logic.test.ts
```

- [ ] **Step 2: Remove dispatchActionToCommunity from dispatcher.ts**

Remove the function at lines 37-68. Also remove any Community-related imports (e.g., `prisma.community`).

- [ ] **Step 3: Remove export from flow-engine/index.ts**

Remove line 2: `export { dispatchActionToCommunity } from './dispatcher.js';`

- [ ] **Step 4: Remove test block from flow-dispatcher.test.ts**

Remove the entire `describe('dispatchActionToCommunity')` block from the test file.

- [ ] **Step 5: Remove broadcastMessage.count from advanced-nodes.ts**

Remove `'broadcastMessage.count',` from `DB_QUERY_ALLOWLIST` at line 109.

- [ ] **Step 6: Verify no remaining references**

```bash
grep -rn 'dispatchActionToCommunity\|broadcastMessage' apps/trigger/src/
```

Expected: no output

---

## Task 7: Refactor event-correlator.ts (ReputationScore table removal)

**Files:**
- Modify: `apps/trigger/src/lib/event-correlator.ts` (line 38: `prisma.reputationScore.findUnique`)

The `event-correlator.ts` queries `prisma.reputationScore.findUnique()` at line 38 and reads `reputation?.totalScore` at line 77. Since we're dropping the `ReputationScore` table in Task 16, this must be refactored to read from `UserIdentity.reputationScore` instead (which is kept).

- [ ] **Step 1: Refactor reputationScore lookup**

Replace the `prisma.reputationScore.findUnique` call (lines 37-40) with reading from the `identity` object already fetched at line 33. Change line 77 to use `identity?.reputationScore ?? 0` instead of `reputation?.totalScore ?? 0`.

Before:
```typescript
// 2. Get reputation score
const reputation = await prisma.reputationScore.findUnique({
  where: { telegramId },
});
// ...
reputationScore: reputation?.totalScore ?? 0,
```

After:
```typescript
// 2. Get reputation score from identity (ReputationScore table removed)
// ...
reputationScore: identity?.reputationScore ?? 0,
```

- [ ] **Step 2: Verify no remaining ReputationScore table references in trigger**

```bash
grep -rn 'reputationScore\.find\|prisma\.reputationScore' apps/trigger/src/
```

Expected: no output

---

## Task 8: Remove Flow Templates

**Files:**
- Modify: `apps/api/src/flows/flow-templates.ts` (remove `broadcast-flow` at lines 144-157, `cross-post-flow` at lines 161-181)
- Modify: `apps/trigger/src/lib/flow-engine/templates.ts` (remove `broadcast-flow` at lines 79-102, `cross-post-flow` at lines 104-139)

- [ ] **Step 1: Remove broadcast-flow and cross-post-flow from API flow-templates.ts**

Remove the two template objects from the templates array.

- [ ] **Step 2: Remove broadcast-flow and cross-post-flow from trigger templates.ts**

Remove the two template objects from the templates array.

- [ ] **Step 3: Verify no remaining references**

```bash
grep -rn 'broadcast-flow\|cross-post-flow' apps/api/src/flows/ apps/trigger/src/
```

Expected: no output

---

## Task 9: Commit API & Trigger Changes

- [ ] **Step 1: Stage and commit**

```bash
git add -A apps/api/src/ apps/trigger/src/
git commit -m "refactor: remove Communities, Automation, Broadcast, Crosspost, and Reputation API modules

Delete entire module directories: communities, automation, reputation, broadcast,
moderation/crosspost. Clean up events module (AutomationEvent plumbing), analytics
(community time series), trigger tasks (broadcast, cross-post), flow engine
(dispatchActionToCommunity), and flow templates (broadcast-flow, cross-post-flow)."
```

---

## Task 10: Delete Frontend Page Directories

**Files:**
- Delete: `apps/frontend/src/app/dashboard/communities/` (9 files)
- Delete: `apps/frontend/src/app/dashboard/automation/` (6 files)
- Delete: `apps/frontend/src/app/dashboard/community/` (2 files)
- Delete: `apps/frontend/src/app/dashboard/broadcast/` (2 files)

- [ ] **Step 1: Delete the four page directories**

```bash
rm -rf apps/frontend/src/app/dashboard/communities
rm -rf apps/frontend/src/app/dashboard/automation
rm -rf apps/frontend/src/app/dashboard/community
rm -rf apps/frontend/src/app/dashboard/broadcast
```

- [ ] **Step 2: Verify directories are gone**

```bash
ls apps/frontend/src/app/dashboard/communities apps/frontend/src/app/dashboard/automation apps/frontend/src/app/dashboard/community apps/frontend/src/app/dashboard/broadcast 2>&1
```

Expected: all "No such file or directory"

---

## Task 11: Clean Up Sidebar Navigation

**Files:**
- Modify: `apps/frontend/src/components/sidebar.tsx`

- [ ] **Step 1: Remove Communities nav section**

Remove the Communities section object (lines 92-97):
```typescript
{
  label: "Communities",
  icon: Building2,
  children: [
    { label: "Overview", href: "/dashboard/communities", icon: Building2 },
  ],
},
```

- [ ] **Step 2: Remove Community/Reputation nav section**

Remove the Community section object (lines 126-135):
```typescript
{
  label: "Community",
  icon: Heart,
  children: [
    { label: "Reputation", href: "/dashboard/community/reputation", icon: Trophy },
  ],
},
```

- [ ] **Step 3: Remove Automation nav section**

Remove the Automation section object (lines 137-145):
```typescript
{
  label: "Automation",
  icon: Zap,
  children: [
    { label: "Broadcast", href: "/dashboard/broadcast", icon: Radio },
    { label: "Health", href: "/dashboard/automation/health", icon: Activity },
    { label: "Jobs", href: "/dashboard/automation/jobs", icon: Activity },
    { label: "Cross-post", href: "/dashboard/automation/crosspost-templates", icon: Copy },
  ],
},
```

- [ ] **Step 4: Remove unused icon imports**

Remove any icon imports that are no longer used after removing the nav entries (e.g., `Building2`, `Heart`, `Trophy`, `Zap`, `Radio`, `Copy` — verify each is not used elsewhere before removing).

---

## Task 12: Clean Up Dashboard Overview Page

**Files:**
- Modify: `apps/frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Remove AutomationStats import**

Remove `AutomationStats` from the import at line 10.

- [ ] **Step 2: Remove automationStats state and fetch**

Remove:
- State variable at line 571: `const [automationStats, setAutomationStats] = useState<AutomationStats | null>(null);`
- The `api.getAutomationStats()` call at line 594
- The result assignment at line 602: `if (results[2]?.status === "fulfilled") setAutomationStats(results[2].value);`
- Usage at line 634: `const pendingJobs = automationStats?.pending ?? 0;`

**Important:** After removing `api.getAutomationStats()` from the `Promise.allSettled` array, the result indices shift. If it was at index 2, then `results[3]` becomes `results[2]`, `results[4]` becomes `results[3]`, etc. Update ALL subsequent `results[N]` references to use the correct new indices.

- [ ] **Step 3: Remove Communities quick action**

Remove the quick action object linking to `/dashboard/communities` (lines 420-426).

- [ ] **Step 4: Remove any pendingJobs display**

Search for and remove any UI elements that display `pendingJobs` or automation stats.

---

## Task 13: Clean Up API Client (lib/api.ts)

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Step 1: Remove Community types**

Remove interfaces at lines 756-831: `Community`, `CommunityConfig`, `CommunityTelegramConfig`, `CommunityMember`.

- [ ] **Step 2: Remove Automation types**

Remove interfaces at lines 394-433: `AutomationJob`, `AutomationJobListResponse`, `AutomationStats`, `ClientLog`, `ClientLogListResponse`.

- [ ] **Step 3: Remove Broadcast types**

Remove interfaces at lines 44-85: `Broadcast`, `MultiPlatformBroadcast`, `MultiPlatformBroadcastsResponse`, `BroadcastsResponse`, `CreateBroadcastDto`.

- [ ] **Step 4: Remove Reputation/Leaderboard types**

Remove interfaces at lines 435-457: `LeaderboardEntry`, `LeaderboardStats`, `LeaderboardResponse`.

- [ ] **Step 5: Remove Health/Automation types**

Remove interfaces at lines 459-488: `TgClientHealth`, `JobMetrics`, `HealthResponse`.

- [ ] **Step 6: Remove Community API methods**

Remove all methods at lines 1659-1759: `getCommunities`, `getCommunity`, `getCommunityConfig`, `updateCommunityConfig`, `getCommunityTelegramConfig`, `updateCommunityTelegramConfig`, `getCommunityMembers`, `getCommunityWarnings`, `getCommunityLogs`, `createCommunity`, `deleteCommunity`, `updateCommunity`.

- [ ] **Step 7: Remove Automation API methods**

Remove all methods at lines 1255-1289: `getAutomationJobs`, `getAutomationJob`, `getAutomationStats`, `getAutomationLogs`, `getAutomationHealth`.

- [ ] **Step 8: Remove Broadcast API methods**

Remove all methods at lines 970-1033: `getBroadcasts`, `getBroadcast`, `createBroadcast`, `updateBroadcast`, `deleteBroadcast`, `retryBroadcast`, `createMultiPlatformBroadcast`, `getMultiPlatformBroadcasts`.

- [ ] **Step 9: Remove Reputation API methods**

Remove method at lines 1296-1305: `getReputationLeaderboard`.

- [ ] **Step 10: Verify no remaining removed type references**

```bash
grep -n 'AutomationStats\|AutomationJob\|CommunityConfig\|CommunityMember\|LeaderboardEntry\|HealthResponse\|BroadcastsResponse' apps/frontend/src/lib/api.ts
```

Expected: no output

---

## Task 14: Remove E2E Tests

**Files:**
- Delete: `apps/frontend/e2e/automation.spec.ts`
- Delete: `apps/frontend/e2e/broadcast.spec.ts`
- Modify: `apps/frontend/e2e/crud-interactions.spec.ts` (remove broadcast test cases)
- Modify: `apps/frontend/e2e/integration-smoke.spec.ts` (remove broadcast lifecycle and page navigation tests)
- Modify: `apps/frontend/e2e/smoke.spec.ts` (remove broadcast, automation, and reputation page references)
- Modify: `apps/frontend/e2e/global-teardown.ts` (remove broadcast cleanup logic)

- [ ] **Step 1: Check for E2E tests referencing removed pages**

```bash
grep -rn 'communities\|automation\|broadcast\|reputation' apps/frontend/e2e/
```

- [ ] **Step 2: Delete dedicated test files**

```bash
rm -f apps/frontend/e2e/automation.spec.ts
rm -f apps/frontend/e2e/broadcast.spec.ts
```

- [ ] **Step 3: Clean references from remaining E2E files**

Remove broadcast/automation/reputation test cases and references from:
- `crud-interactions.spec.ts` — remove broadcast test cases
- `integration-smoke.spec.ts` — remove broadcast lifecycle and page navigation tests
- `smoke.spec.ts` — remove broadcast, automation, and reputation page references
- `global-teardown.ts` — remove broadcast cleanup logic

---

## Task 15: Commit Frontend Changes

- [ ] **Step 1: Stage and commit**

```bash
git add -A apps/frontend/src/ apps/frontend/e2e/
git commit -m "refactor: remove Communities, Automation, Broadcast, and Reputation frontend

Delete dashboard pages: communities/, automation/, community/reputation/, broadcast/.
Clean up sidebar navigation, dashboard overview (automation stats, community quick action),
and API client types/methods. Remove automation E2E tests."
```

---

## Task 16: Remove Prisma Models

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Remove Community models**

Remove these model blocks:
- `Community` (lines 116-143)
- `CommunityConfig` (lines 145-189)
- `CommunityTelegramConfig` (lines 191-208)
- `CommunityDiscordConfig` (lines 210-224)
- `CommunityMember` (lines 226-251)
- `CommunityAnalyticsSnapshot` (lines 472-493)

- [ ] **Step 2: Remove Automation models**

Remove these model blocks:
- `BroadcastMessage` (lines 529-541)
- `ClientLog` (lines 543-552)
- `ClientSession` (lines 554-572)
- `CrossPostTemplate` (lines 511-523)

- [ ] **Step 3: Remove ReputationScore model**

First verify it's only used by the reputation module:
```bash
grep -rn 'reputationScore\|ReputationScore' apps/api/src/ apps/trigger/src/ --include='*.ts' | grep -v 'node_modules'
```

If only referenced by deleted modules and `UserIdentity.reputationScore` field (which stays), remove the `ReputationScore` model.

- [ ] **Step 4: Clean up PlatformAccount relations**

Remove from `PlatformAccount` model:
- `communityMemberships CommunityMember[]` relation field
- `lastCommunityId String?` field

- [ ] **Step 5: Clean up BotInstance relations**

Remove from `BotInstance` model:
- `communities Community[]` relation field

- [ ] **Step 6: Verify schema integrity**

```bash
grep -n 'Community\|BroadcastMessage\|ClientLog\|ClientSession\|CrossPostTemplate\|ReputationScore' packages/db/prisma/schema.prisma
```

Expected: no output (except `UserIdentity.reputationScore` field which stays)

---

## Task 17: Regenerate Prisma Client & Create Migration

**Files:**
- Modify: `packages/db/`

- [ ] **Step 1: Generate Prisma client**

```bash
pnpm db generate
```

Expected: success

- [ ] **Step 2: Build db package**

```bash
pnpm db build
```

Expected: success

- [ ] **Step 3: Create Prisma migration**

```bash
cd packages/db && npx prisma migrate dev --name drop-communities-automation-broadcast-reputation
```

Expected: migration created and applied, tables dropped

---

## Task 18: Remove Migration Scripts

**Files:**
- Delete: `scripts/migrate-slice1-identity.ts`
- Delete: `scripts/migrate-slice2-communities.ts`
- Delete: `scripts/migrate-slice3-connections.ts`
- Delete: `scripts/migrate-slice4-broadcast.ts`
- Delete: `scripts/migrate-slice5-reputation-analytics.ts`
- Delete: `scripts/migrate-slice7-cleanup.ts`

- [ ] **Step 1: Delete all migration scripts**

```bash
rm -f scripts/migrate-slice1-identity.ts
rm -f scripts/migrate-slice2-communities.ts
rm -f scripts/migrate-slice3-connections.ts
rm -f scripts/migrate-slice4-broadcast.ts
rm -f scripts/migrate-slice5-reputation-analytics.ts
rm -f scripts/migrate-slice7-cleanup.ts
```

- [ ] **Step 2: Check if scripts/ directory has other files that should stay**

```bash
ls scripts/
```

If empty, remove the directory. If other scripts exist, leave them.

---

## Task 19: Commit Schema & Migration Changes

- [ ] **Step 1: Stage and commit**

```bash
git add -A packages/db/ scripts/
git commit -m "refactor: drop Communities, Automation, Broadcast, and Reputation database tables

Remove 11 Prisma models: Community, CommunityConfig, CommunityTelegramConfig,
CommunityDiscordConfig, CommunityMember, CommunityAnalyticsSnapshot, BroadcastMessage,
ClientLog, ClientSession, CrossPostTemplate, ReputationScore. Clean up PlatformAccount
and BotInstance relations. Remove all legacy migration scripts."
```

---

## Task 20: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Database Schema section**

Remove from **Domains:**
- `Communities (new)` line listing Community, CommunityConfig, CommunityTelegramConfig, CommunityDiscordConfig, CommunityMember
- `Analytics (new)` line listing CommunityAnalyticsSnapshot
- `Legacy (kept for migration)` — remove BroadcastMessage, ClientLog, ClientSession, CrossPostTemplate references

- [ ] **Step 2: Update App Structure — API section**

Remove from module listings:
- `communities (CRUD + config + members + strategies + community-scoped warnings/logs/scheduled-messages)`
- `broadcast (multi-platform support)`
- `reputation (account/identity/community endpoints)`
- Remove `automation` if listed

- [ ] **Step 3: Update App Structure — Frontend section**

Remove from page listings:
- `communities/`
- `automation/`
- `community/reputation`
- `broadcast/`

- [ ] **Step 4: Update Migration Scripts section**

Remove the entire Migration Scripts section or note that scripts have been removed.

- [ ] **Step 5: Update Commands section if needed**

Remove any commands specific to removed modules.

---

## Task 21: Verification

- [ ] **Step 1: Typecheck API**

```bash
cd apps/api && pnpm build
```

Expected: success (no type errors)

- [ ] **Step 2: Typecheck frontend**

```bash
pnpm frontend lint
```

Expected: success

- [ ] **Step 3: Typecheck connector pool**

```bash
pnpm connector-pool typecheck
```

Expected: success

- [ ] **Step 4: Typecheck trigger**

```bash
pnpm trigger typecheck
```

Expected: success

- [ ] **Step 5: Run API tests**

```bash
pnpm api test
```

Expected: pass (tests for deleted modules should be gone, remaining tests should pass)

- [ ] **Step 6: Run trigger tests**

```bash
pnpm trigger test
```

Expected: pass

- [ ] **Step 7: Run frontend build**

```bash
pnpm frontend build
```

Expected: success

- [ ] **Step 8: Global grep for any remaining references**

```bash
grep -rn 'CommunitiesModule\|AutomationModule\|ReputationModule\|BroadcastModule\|CrossPostModule' apps/ packages/ --include='*.ts' --include='*.tsx'
```

Expected: no output

---

## Task 22: Final Commit & Docs

- [ ] **Step 1: Stage and commit CLAUDE.md and any remaining fixes**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md after removing Communities & Automation modules"
```

- [ ] **Step 2: Verify clean git status**

```bash
git status
```

Expected: clean working tree (except untracked files from before)
