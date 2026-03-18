# UI Enhancement Plan — Manager-Bot & Flowbot Dashboard

## Overview

This plan identifies missing UI capabilities for the manager-bot (group moderation) and flowbot (e-commerce + automation) systems, and proposes concrete tasks to fill those gaps.

## Goals

1. Provide comprehensive web-based management for all manager-bot features currently only accessible via Telegram bot commands
2. Expose tg-client automation monitoring and job management through the dashboard
3. Improve the existing dashboard with better navigation, UX patterns, and missing CRUD operations
4. Maintain a single unified dashboard (extend `apps/frontend`) rather than creating separate frontends

## Scope

**In scope:**
- Manager-bot moderation features that lack dashboard UI
- TG-client job/automation monitoring
- Group configuration management via web UI
- Scheduled messages management
- Cross-post template management
- Reputation and analytics visualization improvements
- Dashboard UX improvements (navigation, responsive design, auth)

**Out of scope:**
- New backend services or bots
- Mobile app development
- Real-time Telegram message streaming
- End-user (non-admin) facing UI

## Planning Documents

| Document | Purpose |
|----------|---------|
| [ui-01-research-summary.md](./ui-01-research-summary.md) | Architecture findings, current state analysis |
| [ui-02-gap-analysis.md](./ui-02-gap-analysis.md) | Missing UI areas, comparison of approaches |
| [ui-03-recommended-direction.md](./ui-03-recommended-direction.md) | Chosen strategy with rationale |
| [ui-10-task-001-navigation-redesign.md](./ui-10-task-001-navigation-redesign.md) | Dashboard navigation overhaul |
| [ui-11-task-002-group-config-editor.md](./ui-11-task-002-group-config-editor.md) | Full group configuration editor |
| [ui-12-task-003-scheduled-messages-ui.md](./ui-12-task-003-scheduled-messages-ui.md) | Scheduled messages management |
| [ui-13-task-004-crosspost-templates-ui.md](./ui-13-task-004-crosspost-templates-ui.md) | Cross-post template management |
| [ui-14-task-005-automation-jobs-ui.md](./ui-14-task-005-automation-jobs-ui.md) | TG-client automation job monitoring |
| [ui-15-task-006-reputation-dashboard.md](./ui-15-task-006-reputation-dashboard.md) | Reputation leaderboard and details |
| [ui-16-task-007-analytics-charts.md](./ui-16-task-007-analytics-charts.md) | Analytics page with real charts |
| [ui-17-task-008-member-actions.md](./ui-17-task-008-member-actions.md) | Member management actions from dashboard |
| [ui-18-task-009-keyword-filters-ui.md](./ui-18-task-009-keyword-filters-ui.md) | Keyword filter management |
| [ui-19-task-010-dashboard-auth.md](./ui-19-task-010-dashboard-auth.md) | Authentication for the dashboard |

## Execution Status

All 10 tasks are **complete**. Both `pnpm api build` and `pnpm frontend build` pass successfully.

| Task | Status | Notes |
|------|--------|-------|
| 001 — Navigation Redesign | Completed | Sidebar with collapsible sections, mobile overlay |
| 002 — Group Config Editor | Completed | 8-tab editor for all 29 GroupConfig fields |
| 003 — Scheduled Messages UI | Completed | Full CRUD with API module + frontend page |
| 004 — Cross-post Templates UI | Completed | Full CRUD with API module + frontend page |
| 005 — Automation Jobs UI | Completed | Job monitoring with auto-refresh, stats, logs |
| 006 — Reputation Dashboard | Completed | Leaderboard with score breakdown visualization |
| 007 — Analytics Charts | Completed | recharts-based charts (member growth, moderation, spam) |
| 008 — Member Actions | Completed | Warn/mute/ban/unban from dashboard |
| 009 — Keyword Filters UI | Completed | Covered by Task 002's Content tab (TagInput for keywordFilters) |
| 010 — Dashboard Auth | Completed | Shared secret auth with JWT-like tokens |

### New Routes Added
- `/login` — Authentication page
- `/dashboard/moderation/scheduled-messages` — Scheduled message management
- `/dashboard/moderation/analytics` — Enhanced with recharts charts
- `/dashboard/automation/crosspost-templates` — Cross-post template CRUD
- `/dashboard/automation/jobs` — Job monitoring with logs
- `/dashboard/community/reputation` — Reputation leaderboard

### New API Modules
- `apps/api/src/auth/` — Authentication (global guard + login/verify endpoints)
- `apps/api/src/moderation/scheduled-messages/` — Scheduled messages CRUD
- `apps/api/src/moderation/crosspost/` — Cross-post templates CRUD
- `apps/api/src/automation/` — Job monitoring + client logs
- `apps/api/src/reputation/` — Extended with leaderboard endpoint
- `apps/api/src/moderation/members/` — Extended with warn/mute/ban/unban actions

### New Environment Variables
- `DASHBOARD_SECRET` — Shared password for dashboard login
- `JWT_SECRET` (optional) — Separate HMAC signing key

## Original Execution Order

### Phase 1: Foundation (tasks 001, 010)
- Navigation redesign (001) — structural prerequisite for all other UI work
- Dashboard auth (010) — security prerequisite before exposing management actions

### Phase 2: Core Management (tasks 002, 003, 008)
- Group config editor (002) — most-requested management capability
- Scheduled messages UI (003) — operational workflow currently bot-only
- Member actions (008) — complete the member management story

### Phase 3: Automation & Monitoring (tasks 004, 005)
- Cross-post templates (004) — template management needs web UI
- Automation jobs (005) — monitoring and control for tg-client

### Phase 4: Analytics & Insights (tasks 006, 007, 009)
- Reputation dashboard (006) — community health visibility
- Analytics charts (007) — replace table-based analytics with charts
- Keyword filters (009) — filter management convenience
