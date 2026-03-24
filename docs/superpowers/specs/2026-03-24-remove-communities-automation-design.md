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
| Communities | `communities/` (16 files) | 14 endpoints — CRUD, config, members, warnings, logs, scheduled messages |
| Automation | `automation/` (5 files) | 5 endpoints — health, jobs, job detail, stats, logs |
| Reputation | `reputation/` (full module) | Leaderboard, scores, account/identity/community endpoints |
| Broadcast | `broadcast/` (full module) | Broadcast CRUD and execution |
| Crosspost | `moderation/crosspost/` (sub-module) | Template CRUD and enrichment |

**app.module.ts** — remove imports for: `CommunitiesModule`, `AutomationModule`, `ReputationModule`, `BroadcastModule`. Remove crosspost references from moderation module if applicable.

### Frontend (apps/frontend/src/)

| Path | Description |
|------|-------------|
| `app/dashboard/communities/` | List, create, detail, members, warnings pages + loading skeletons |
| `app/dashboard/automation/` | Health, jobs, crosspost-templates pages |
| `app/dashboard/community/reputation/` | Reputation leaderboard page |
| `app/dashboard/broadcast/` | Broadcast page (if exists) |

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

**Relations to clean:** `PlatformAccount.communityMemberships`, `BotInstance.communities`

### Migration Scripts (scripts/)

- Remove `migrate-slice2-communities.ts`
- Clean community/broadcast references from `migrate-slice4-broadcast.ts`, `migrate-slice5-reputation-analytics.ts`, `migrate-slice7-cleanup.ts`

### Dangling References

- `moderation/crosspost/crosspost.service.ts` — queries `Community` table (removed with crosspost sub-module)
- Analytics module — verify no references to `CommunityAnalyticsSnapshot`
- Trigger tasks — `analytics-snapshot.ts` currently writes to legacy tables only, no community references expected

## What Stays

- **Flow Builder** — replacement for Automation (cron scheduling, cross-platform sends)
- **Connector Pool** — replacement for client session management
- **Bot Config** — bot instances, commands, responses, menus
- **Connections** — platform connections (MTProto, WhatsApp, Discord)
- **Identity** — PlatformAccount, UserIdentity
- **Webhooks** — webhook endpoints
- **Moderation** (minus crosspost) — legacy groups, members, warnings, logs
- **All connector packages** — telegram-bot, telegram-user, whatsapp-user, discord-bot

## Follow-up (Not in Scope)

- **Connection logs page** — view bot/user activity logs through Connections UI
- Further legacy moderation module cleanup

## Execution Plan

### Commit 1: API modules removal
- Delete `apps/api/src/communities/`
- Delete `apps/api/src/automation/`
- Delete `apps/api/src/reputation/`
- Delete `apps/api/src/broadcast/`
- Delete `apps/api/src/moderation/crosspost/`
- Clean up `app.module.ts` and any cross-references

### Commit 2: Frontend removal
- Delete dashboard pages: `communities/`, `automation/`, `community/`, `broadcast/`
- Remove sidebar nav entries
- Remove types and API methods from `lib/api.ts`

### Commit 3: Schema & migration
- Remove models from `schema.prisma`
- Remove related relations from remaining models
- Run `pnpm db generate && pnpm db build`
- Generate Prisma migration to drop tables
- Remove migration scripts

### Commit 4: Verification
- Typecheck all workspaces
- Run API tests
- Run frontend lint
- Verify builds succeed

## Risks

- **Low:** TypeScript compiler will catch any missed references after deletion
- **Low:** No production database means no data loss risk
- **Medium:** Cross-post enrichment in moderation module references Community table — resolved by removing crosspost sub-module entirely
