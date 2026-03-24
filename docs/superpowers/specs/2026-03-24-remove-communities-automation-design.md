# Remove Communities & Automation Modules

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Big Bang removal of Communities, Automation, Broadcast, Crosspost, and Reputation

## Context

The Flowbot platform has evolved: the **Flow Builder** with cron scheduling and cross-platform send nodes now replaces the legacy Automation module (broadcast jobs, cross-post templates, client session monitoring). The **Connector Pool** architecture replaces client session management. Communities were a multi-platform abstraction over groups/channels, but the platform no longer needs a dedicated community management layer — bots interact with groups directly through connectors.

There is no production database, so we can drop tables without migration concerns.

## Decision

Remove all code and database tables for: Communities, Automation, Broadcast, Crosspost (under moderation), and Reputation. Connection logs (replacement for community-scoped logs) will be a separate follow-up feature.

## What Gets Removed

### API Modules (apps/api/src/)

| Module | Path | Endpoints Removed |
|--------|------|-------------------|
| Communities | `communities/` (~22 files) | 14 endpoints — CRUD, config, members, warnings, logs, scheduled messages |
| Automation | `automation/` (5 files) | 5 endpoints — health, jobs, job detail, stats, logs |
| Reputation | `reputation/` (full module) | Leaderboard, scores, account/identity/community endpoints |
| Broadcast | `broadcast/` (full module) | Broadcast CRUD and execution |
| Crosspost | `moderation/crosspost/` (sub-module) | Template CRUD and enrichment |

**app.module.ts** — remove imports for: `CommunitiesModule`, `AutomationModule`, `ReputationModule`, `BroadcastModule`. Remove crosspost references from moderation module if applicable.

### API Events Module Cleanup (apps/api/src/events/)

The Events module stays, but automation plumbing must be removed:
- `event-types.ts` — remove `AutomationEvent` interface (`broadcast.created`, `broadcast.completed`, `broadcast.failed`)
- `event-bus.service.ts` — remove `emitAutomation()` and `onAutomation()` methods
- `ws.gateway.ts` — remove automation event subscription and `'automation'` WebSocket room
- `sse.controller.ts` — remove automation event streaming
- Update corresponding test files

### API Analytics Module Cleanup (apps/api/src/analytics/)

- `analytics.service.ts` — remove `getCommunityTimeSeries()` method (queries `prisma.community` and `prisma.communityAnalyticsSnapshot`)
- `analytics.controller.ts` — remove `GET /api/analytics/communities/:communityId` endpoint

### Trigger Tasks (apps/trigger/src/)

**Delete entirely:**
- `trigger/broadcast.ts` — queries `broadcastMessage` table
- `trigger/cross-post.ts` — uses `crossPostTemplate`
- `__tests__/broadcast-logic.test.ts`
- `__tests__/cross-post-logic.test.ts`

**Clean up:**
- `lib/flow-engine/dispatcher.ts` — remove `dispatchActionToCommunity` function (queries `prisma.community`)
- `lib/flow-engine/index.ts` — remove export of `dispatchActionToCommunity`
- `__tests__/flow-dispatcher.test.ts` — remove `describe('dispatchActionToCommunity')` block
- `lib/flow-engine/advanced-nodes.ts` — remove `'broadcastMessage.count'` from `DB_QUERY_ALLOWLIST`

### Flow Templates

- `apps/api/src/flows/flow-templates.ts` — remove `broadcast-flow` and `cross-post-flow` templates
- `apps/trigger/src/lib/flow-engine/templates.ts` — remove same templates

### Frontend (apps/frontend/src/)

| Path | Description |
|------|-------------|
| `app/dashboard/communities/` | List, create, detail, members, warnings pages + loading skeletons |
| `app/dashboard/automation/` | Health, jobs, crosspost-templates pages |
| `app/dashboard/community/reputation/` | Reputation leaderboard page |
| `app/dashboard/broadcast/` | Broadcast page (if exists) |

**Dashboard overview page (`app/dashboard/page.tsx`):**
- Remove `AutomationStats` type import
- Remove `automationStats` state variable and `api.getAutomationStats()` call
- Remove automation stats display (`automationStats?.pending`)
- Remove quick action linking to `/dashboard/communities`

**Sidebar (components/sidebar.tsx):** Remove nav entries for Communities, Automation (Broadcast, Health, Jobs, Cross-post), and Reputation.

**API Client (lib/api.ts):** Remove ~12 community methods, ~5 automation methods, broadcast methods, reputation/leaderboard methods, and all associated TypeScript types.

### Database (packages/db/prisma/schema.prisma) — 12+ tables dropped

**Communities (6 tables):**
- `Community`
- `CommunityConfig`
- `CommunityTelegramConfig`
- `CommunityDiscordConfig`
- `CommunityMember`
- `CommunityAnalyticsSnapshot`

**Automation (4 tables):**
- `BroadcastMessage`
- `ClientLog`
- `ClientSession`
- `CrossPostTemplate`

**Reputation:**
- `ReputationScore` (if exclusively used by reputation module — verify before dropping)

**Relations to clean:**
- `PlatformAccount.communityMemberships` — remove relation field
- `PlatformAccount.lastCommunityId` — remove field
- `BotInstance.communities` — remove relation field

**Note:** `UserIdentity.reputationScore` field (Int, default 0) is referenced by `flows/correlation.service.ts` and `trigger/lib/event-correlator.ts`. Keep the field for now; it's a generic score not tied to the `ReputationScore` table.

**Note:** `FlowTriggerEvent.communityId` in `flows/flow-trigger-event.ts` carries a platform chat/guild ID, not a reference to the `Community` table. Keep but consider renaming to `chatId` in follow-up.

### Migration Scripts (scripts/)

Remove all migration scripts — no production database means they are no longer needed:
- `migrate-slice1-identity.ts`
- `migrate-slice2-communities.ts`
- `migrate-slice3-connections.ts`
- `migrate-slice4-broadcast.ts`
- `migrate-slice5-reputation-analytics.ts`
- `migrate-slice7-cleanup.ts`

### Documentation

- Update `CLAUDE.md` to remove references to Communities, Automation, Broadcast, Crosspost, Reputation modules and their endpoints/tables

## What Stays

- **Flow Builder** — replacement for Automation (cron scheduling, cross-platform sends)
- **Connector Pool** — replacement for client session management
- **Bot Config** — bot instances, commands, responses, menus
- **Connections** — platform connections (MTProto, WhatsApp, Discord)
- **Identity** — PlatformAccount, UserIdentity (including `reputationScore` field)
- **Webhooks** — webhook endpoints
- **Moderation** (minus crosspost) — legacy groups, members, warnings, logs, scheduled messages
- **All connector packages** — telegram-bot, telegram-user, whatsapp-user, discord-bot

## Follow-up (Not in Scope)

- **Connection logs page** — view bot/user activity logs through Connections UI
- Rename `FlowTriggerEvent.communityId` to `chatId` for clarity
- Further legacy moderation module cleanup

## Execution Plan

### Commit 1: API & Trigger removal
- Delete `apps/api/src/communities/`
- Delete `apps/api/src/automation/`
- Delete `apps/api/src/reputation/`
- Delete `apps/api/src/broadcast/`
- Delete `apps/api/src/moderation/crosspost/`
- Clean up `app.module.ts` — remove module imports
- Clean up Events module — remove `AutomationEvent`, `emitAutomation`, `onAutomation`, automation WS/SSE references
- Clean up Analytics module — remove community time series endpoint and method
- Delete trigger tasks: `broadcast.ts`, `cross-post.ts` and their tests
- Clean up trigger flow engine: remove `dispatchActionToCommunity`, `broadcastMessage.count` allowlist entry
- Remove `broadcast-flow` and `cross-post-flow` from flow templates (both API and trigger)

### Commit 2: Frontend removal
- Delete dashboard pages: `communities/`, `automation/`, `community/`, `broadcast/`
- Clean up dashboard overview page — remove automation stats, community quick action
- Remove sidebar nav entries
- Remove types and API methods from `lib/api.ts`

### Commit 3: Schema & migration
- Remove models from `schema.prisma`
- Remove `PlatformAccount.communityMemberships`, `PlatformAccount.lastCommunityId`, `BotInstance.communities`
- Run `pnpm db generate && pnpm db build`
- Generate Prisma migration to drop tables
- Remove all migration scripts from `scripts/`

### Commit 4: Docs & verification
- Update `CLAUDE.md`
- Typecheck all workspaces
- Run API tests (some will be removed with modules)
- Run frontend lint
- Verify builds succeed

## Risks

- **Low:** TypeScript compiler will catch any missed references after deletion
- **Low:** No production database means no data loss risk
- **Low:** Events module cleanup is surgical — only removing automation-specific plumbing
- **Low:** `UserIdentity.reputationScore` kept to avoid breaking correlation services
